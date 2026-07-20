-- Agenda de contas futuras sem duplicar despesas já realizadas no cartão.

create table public.payables (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete restrict,
  category_id uuid references public.categories(id) on delete set null,
  title text not null check (char_length(title) between 1 and 120),
  notes text,
  schedule_type text not null check (schedule_type in ('one_time', 'installment', 'recurring')),
  amount_cents bigint not null check (amount_cents > 0),
  occurrence_count smallint not null check (occurrence_count between 1 and 60),
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payable_occurrences (
  id uuid primary key default gen_random_uuid(),
  payable_id uuid not null references public.payables(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  due_on date not null,
  amount_cents bigint not null check (amount_cents > 0),
  occurrence_number smallint not null check (occurrence_number > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  paid_on date,
  transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payable_id, occurrence_number)
);

create index payables_household_status_idx on public.payables (household_id, status);
create index payable_occurrences_household_due_idx on public.payable_occurrences (household_id, due_on, status);

create trigger set_payables_updated_at before update on public.payables
  for each row execute procedure public.set_updated_at();
create trigger set_payable_occurrences_updated_at before update on public.payable_occurrences
  for each row execute procedure public.set_updated_at();

alter table public.payables enable row level security;
alter table public.payable_occurrences enable row level security;
create policy "payables_member_access" on public.payables for all
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "payable_occurrences_member_access" on public.payable_occurrences for all
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

create or replace function public.create_payable_schedule(
  target_account_id uuid,
  target_category_id uuid,
  payable_title text,
  payable_notes text,
  schedule_kind text,
  schedule_amount_cents bigint,
  first_due_date date,
  total_occurrences integer
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  account_record public.accounts%rowtype;
  payable_uuid uuid := gen_random_uuid();
  item integer;
  item_amount bigint;
  remainder bigint;
  category_kind text;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado'; end if;
  if schedule_kind not in ('one_time', 'installment', 'recurring') then raise exception 'Tipo inválido'; end if;
  if schedule_amount_cents <= 0 or total_occurrences < 1 or total_occurrences > 60 then raise exception 'Valores inválidos'; end if;
  if schedule_kind = 'one_time' and total_occurrences <> 1 then raise exception 'Quantidade inválida'; end if;

  select * into account_record from public.accounts where id = target_account_id and is_active;
  if account_record.id is null or not public.is_household_member(account_record.household_id) then raise exception 'Conta inválida'; end if;
  if target_category_id is not null then
    select kind into category_kind from public.categories where id = target_category_id and household_id = account_record.household_id and is_active;
    if category_kind is distinct from 'expense' then raise exception 'Categoria inválida'; end if;
  end if;

  insert into public.payables (id, household_id, account_id, category_id, title, notes, schedule_type, amount_cents, occurrence_count, created_by)
  values (payable_uuid, account_record.household_id, account_record.id, target_category_id, payable_title, payable_notes, schedule_kind, schedule_amount_cents, total_occurrences, auth.uid());

  remainder := case when schedule_kind = 'installment' then schedule_amount_cents % total_occurrences else 0 end;
  for item in 1..total_occurrences loop
    item_amount := case when schedule_kind = 'installment'
      then schedule_amount_cents / total_occurrences + case when item <= remainder then 1 else 0 end
      else schedule_amount_cents end;
    insert into public.payable_occurrences (payable_id, household_id, due_on, amount_cents, occurrence_number)
    values (payable_uuid, account_record.household_id, (first_due_date + make_interval(months => item - 1))::date, item_amount, item);
  end loop;
  return payable_uuid;
end;
$$;

create or replace function public.pay_payable_occurrence(target_occurrence_id uuid, payment_date date)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  occurrence_record public.payable_occurrences%rowtype;
  payable_record public.payables%rowtype;
  transaction_uuid uuid;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado'; end if;
  select * into occurrence_record from public.payable_occurrences where id = target_occurrence_id for update;
  if occurrence_record.id is null or occurrence_record.status <> 'pending' or not public.is_household_member(occurrence_record.household_id) then raise exception 'Conta inválida'; end if;
  select * into payable_record from public.payables where id = occurrence_record.payable_id;

  insert into public.transactions (household_id, account_id, category_id, created_by, type, description, amount_cents, occurred_on, notes)
  values (occurrence_record.household_id, payable_record.account_id, payable_record.category_id, auth.uid(), 'expense', payable_record.title, occurrence_record.amount_cents, payment_date, payable_record.notes)
  returning id into transaction_uuid;

  update public.payable_occurrences set status = 'paid', paid_on = payment_date, transaction_id = transaction_uuid where id = occurrence_record.id;
  if not exists (select 1 from public.payable_occurrences where payable_id = payable_record.id and status = 'pending') then
    update public.payables set status = 'completed' where id = payable_record.id;
  end if;
  return transaction_uuid;
end;
$$;

create or replace function public.cancel_payable_occurrence(target_occurrence_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  occurrence_record public.payable_occurrences%rowtype;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado'; end if;
  select * into occurrence_record from public.payable_occurrences where id = target_occurrence_id for update;
  if occurrence_record.id is null or occurrence_record.status <> 'pending' or not public.is_household_member(occurrence_record.household_id) then raise exception 'Conta inválida'; end if;
  update public.payable_occurrences set status = 'cancelled' where id = occurrence_record.id;
  if not exists (select 1 from public.payable_occurrences where payable_id = occurrence_record.payable_id and status = 'pending') then
    update public.payables set status = case
      when exists (select 1 from public.payable_occurrences where payable_id = occurrence_record.payable_id and status = 'paid') then 'completed'
      else 'cancelled' end
    where id = occurrence_record.payable_id;
  end if;
end;
$$;

grant execute on function public.create_payable_schedule(uuid, uuid, text, text, text, bigint, date, integer) to authenticated;
grant execute on function public.pay_payable_occurrence(uuid, date) to authenticated;
grant execute on function public.cancel_payable_occurrence(uuid) to authenticated;

alter table public.notifications
  add column payable_occurrence_id uuid references public.payable_occurrences(id) on delete cascade;
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'budget_threshold', 'budget_projection', 'spending_anomaly', 'dream_milestone', 'payable_due'
));

create or replace function public.evaluate_payable_due_alerts(target_household_id uuid)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  current_day date := (now() at time zone 'America/Sao_Paulo')::date;
  item record;
  inserted_count integer := 0;
  affected integer;
begin
  if auth.uid() is not null and not public.is_household_member(target_household_id) then raise exception 'Espaço familiar inválido'; end if;
  for item in
    select occurrence.id, occurrence.due_on, occurrence.amount_cents, payable.title
    from public.payable_occurrences occurrence
    join public.payables payable on payable.id = occurrence.payable_id
    where occurrence.household_id = target_household_id and occurrence.status = 'pending'
      and occurrence.due_on <= current_day + 3
  loop
    insert into public.notifications (household_id, payable_occurrence_id, kind, severity, title, message, link_url, dedupe_key)
    values (
      target_household_id, item.id, 'payable_due',
      case when item.due_on < current_day then 'critical' else 'warning' end,
      case when item.due_on < current_day then 'Conta em atraso' else 'Conta perto do vencimento' end,
      item.title || ' · R$ ' || round(item.amount_cents / 100.0, 2) ||
        case when item.due_on < current_day then ' venceu em ' else ' vence em ' end || to_char(item.due_on, 'DD/MM/YYYY') || '.',
      '/dashboard/contas-a-pagar',
      'payable:' || item.id || ':' || case when item.due_on < current_day then 'overdue' else 'due-soon' end
    ) on conflict (household_id, dedupe_key) do nothing;
    get diagnostics affected = row_count;
    inserted_count := inserted_count + affected;
  end loop;
  return inserted_count;
end;
$$;

create or replace function public.evaluate_financial_alerts(target_household_id uuid)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  budget_count integer;
  anomaly_count integer;
  dream_count integer;
  payable_count integer;
begin
  budget_count := public.evaluate_budget_alerts(target_household_id);
  anomaly_count := public.evaluate_spending_anomalies(target_household_id);
  dream_count := public.evaluate_dream_milestones(target_household_id);
  payable_count := public.evaluate_payable_due_alerts(target_household_id);
  return coalesce(budget_count, 0) + coalesce(anomaly_count, 0) + coalesce(dream_count, 0) + coalesce(payable_count, 0);
end;
$$;

revoke all on function public.evaluate_payable_due_alerts(uuid) from public, anon;
grant execute on function public.evaluate_payable_due_alerts(uuid) to authenticated, service_role;
