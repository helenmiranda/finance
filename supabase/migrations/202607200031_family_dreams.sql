-- Sonhos compartilhados: propósito, progresso e aportes da família.

create table public.dreams (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  why_text text not null check (char_length(why_text) between 1 and 280),
  target_cents bigint not null check (target_cents > 0),
  saved_cents bigint not null default 0 check (saved_cents >= 0),
  target_date date,
  emoji text not null default '✨' check (char_length(emoji) between 1 and 12),
  color text not null default '#9fe870',
  status text not null default 'active' check (status in ('active', 'achieved', 'paused')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dream_contributions (
  id uuid primary key default gen_random_uuid(),
  dream_id uuid not null references public.dreams(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  contributed_by uuid not null references public.profiles(id),
  amount_cents bigint not null check (amount_cents > 0),
  contributed_on date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create index dreams_household_status_idx on public.dreams (household_id, status, target_date);
create index dream_contributions_dream_date_idx on public.dream_contributions (dream_id, contributed_on desc);

create trigger set_dreams_updated_at before update on public.dreams
  for each row execute procedure public.set_updated_at();

alter table public.dreams enable row level security;
alter table public.dream_contributions enable row level security;

create policy "dreams_member_access" on public.dreams for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "dream_contributions_member_access" on public.dream_contributions for all
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

  return contribution_id;
end;
$$;

grant execute on function public.add_dream_contribution(uuid, bigint, date, text) to authenticated;
