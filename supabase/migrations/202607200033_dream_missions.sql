-- Missões curtas e positivas vinculadas aos sonhos da família.

create table public.dream_missions (
  id uuid primary key default gen_random_uuid(),
  dream_id uuid not null references public.dreams(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  target_cents bigint not null check (target_cents > 0),
  current_cents bigint not null default 0 check (current_cents >= 0),
  starts_on date not null default current_date,
  ends_on date not null check (ends_on >= starts_on),
  reward_text text check (reward_text is null or char_length(reward_text) <= 120),
  status text not null default 'active' check (status in ('active', 'completed')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index dream_missions_household_status_idx on public.dream_missions (household_id, status, ends_on);
create index dream_missions_dream_idx on public.dream_missions (dream_id, starts_on, ends_on);

create trigger set_dream_missions_updated_at before update on public.dream_missions
  for each row execute procedure public.set_updated_at();

alter table public.dream_missions enable row level security;

create policy "dream_missions_member_access" on public.dream_missions for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create or replace function public.add_dream_contribution(
  target_dream_id uuid,
  contribution_cents bigint,
  contribution_date date,
  contribution_note text default null
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  dream_record public.dreams%rowtype;
  contribution_id uuid;
  new_total bigint;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado'; end if;
  if contribution_cents <= 0 then raise exception 'Valor inválido'; end if;

  select * into dream_record from public.dreams where id = target_dream_id for update;
  if dream_record.id is null or not public.is_household_member(dream_record.household_id) then
    raise exception 'Sonho inválido';
  end if;
  if dream_record.status = 'paused' then raise exception 'Sonho pausado'; end if;

  insert into public.dream_contributions (
    dream_id, household_id, contributed_by, amount_cents, contributed_on, note
  ) values (
    dream_record.id, dream_record.household_id, auth.uid(), contribution_cents,
    contribution_date, contribution_note
  ) returning id into contribution_id;

  new_total := dream_record.saved_cents + contribution_cents;
  update public.dreams
  set saved_cents = new_total,
      status = case when new_total >= target_cents then 'achieved' else 'active' end,
      updated_at = now()
  where id = dream_record.id;

  update public.dream_missions
  set current_cents = current_cents + contribution_cents,
      status = case when current_cents + contribution_cents >= target_cents then 'completed' else 'active' end,
      updated_at = now()
  where dream_id = dream_record.id
    and household_id = dream_record.household_id
    and status = 'active'
    and contribution_date between starts_on and ends_on;

  return contribution_id;
end;
$$;

grant execute on function public.add_dream_contribution(uuid, bigint, date, text) to authenticated;
