-- Metas financeiras compartilhadas e seus aportes.

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  description text,
  target_cents bigint not null check (target_cents > 0),
  current_cents bigint not null default 0 check (current_cents >= 0),
  target_date date,
  color text not null default '#9fe870',
  status text not null default 'active' check (status in ('active', 'completed', 'paused')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  contributed_by uuid not null references public.profiles(id),
  amount_cents bigint not null check (amount_cents > 0),
  contributed_on date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create index goals_household_status_idx on public.goals (household_id, status, target_date);
create index goal_contributions_goal_date_idx on public.goal_contributions (goal_id, contributed_on desc);

create trigger set_goals_updated_at
  before update on public.goals
  for each row execute procedure public.set_updated_at();

alter table public.goals enable row level security;
alter table public.goal_contributions enable row level security;

create policy "goals_member_access" on public.goals
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "goal_contributions_member_access" on public.goal_contributions
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create or replace function public.add_goal_contribution(
  target_goal_id uuid,
  contribution_cents bigint,
  contribution_date date,
  contribution_notes text default null
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  goal_record public.goals%rowtype;
  contribution_id uuid;
  new_total bigint;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado'; end if;
  if contribution_cents <= 0 then raise exception 'Valor inválido'; end if;

  select * into goal_record from public.goals where id = target_goal_id for update;
  if goal_record.id is null or not public.is_household_member(goal_record.household_id) then
    raise exception 'Meta inválida';
  end if;
  if goal_record.status = 'paused' then raise exception 'Meta pausada'; end if;

  insert into public.goal_contributions (
    goal_id, household_id, contributed_by, amount_cents, contributed_on, notes
  ) values (
    goal_record.id, goal_record.household_id, auth.uid(), contribution_cents,
    contribution_date, contribution_notes
  ) returning id into contribution_id;

  new_total := goal_record.current_cents + contribution_cents;
  update public.goals
  set current_cents = new_total,
      status = case when new_total >= target_cents then 'completed' else 'active' end,
      updated_at = now()
  where id = goal_record.id;

  return contribution_id;
end;
$$;

grant execute on function public.add_goal_contribution(uuid, bigint, date, text) to authenticated;
