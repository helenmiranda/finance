-- Sugestões de conciliação entre a agenda e transações já importadas.

create table public.payable_reconciliation_suggestions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  occurrence_id uuid not null references public.payable_occurrences(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  score smallint not null check (score between 0 and 100),
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (occurrence_id, transaction_id)
);

create index payable_reconciliation_household_status_idx
  on public.payable_reconciliation_suggestions (household_id, status, score desc);

alter table public.payable_reconciliation_suggestions enable row level security;
create policy "payable_reconciliation_member_access" on public.payable_reconciliation_suggestions for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create or replace function public.suggest_payable_reconciliations(target_household_id uuid)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  inserted_count integer := 0;
begin
  if auth.uid() is not null and not public.is_household_member(target_household_id) then raise exception 'Espaço familiar inválido'; end if;

  insert into public.payable_reconciliation_suggestions (
    household_id, occurrence_id, transaction_id, score, reason
  )
  select occurrence.household_id, occurrence.id, transaction.id,
    case
      when transaction.amount_cents = occurrence.amount_cents and transaction.occurred_on = occurrence.due_on then 100
      when transaction.amount_cents = occurrence.amount_cents then 92
      else 78
    end,
    case
      when transaction.amount_cents = occurrence.amount_cents then 'Mesmo valor e conta, com data próxima ao vencimento.'
      else 'Valor muito próximo, mesma conta e data próxima ao vencimento.'
    end
  from public.payable_occurrences occurrence
  join public.payables payable on payable.id = occurrence.payable_id
  join public.transactions transaction
    on transaction.household_id = occurrence.household_id
    and transaction.account_id = payable.account_id
    and transaction.type = 'expense'
    and transaction.status = 'confirmed'
    and transaction.occurred_on between occurrence.due_on - 5 and occurrence.due_on + 5
    and abs(transaction.amount_cents - occurrence.amount_cents) <= greatest(200, round(occurrence.amount_cents * 0.02)::bigint)
  where occurrence.household_id = target_household_id
    and occurrence.status = 'pending'
    and occurrence.due_on >= current_date - 90
    and not exists (select 1 from public.payable_occurrences linked where linked.transaction_id = transaction.id)
  on conflict (occurrence_id, transaction_id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.accept_payable_reconciliation(target_suggestion_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  suggestion_record public.payable_reconciliation_suggestions%rowtype;
  occurrence_record public.payable_occurrences%rowtype;
  transaction_record public.transactions%rowtype;
  payable_record public.payables%rowtype;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado'; end if;
  select * into suggestion_record from public.payable_reconciliation_suggestions where id = target_suggestion_id for update;
  if suggestion_record.id is null or suggestion_record.status <> 'pending' or not public.is_household_member(suggestion_record.household_id) then raise exception 'Sugestão inválida'; end if;
  select * into occurrence_record from public.payable_occurrences where id = suggestion_record.occurrence_id for update;
  select * into transaction_record from public.transactions where id = suggestion_record.transaction_id;
  select * into payable_record from public.payables where id = occurrence_record.payable_id;
  if occurrence_record.status <> 'pending' or transaction_record.status <> 'confirmed'
    or transaction_record.household_id <> suggestion_record.household_id
    or transaction_record.account_id is distinct from payable_record.account_id
    or transaction_record.occurred_on not between occurrence_record.due_on - 5 and occurrence_record.due_on + 5
    or abs(transaction_record.amount_cents - occurrence_record.amount_cents) > greatest(200, round(occurrence_record.amount_cents * 0.02)::bigint)
    or exists (select 1 from public.payable_occurrences where transaction_id = transaction_record.id) then
    raise exception 'Esta conciliação não está mais disponível';
  end if;

  update public.payable_occurrences set status = 'paid', paid_on = transaction_record.occurred_on, transaction_id = transaction_record.id where id = occurrence_record.id;
  update public.payable_reconciliation_suggestions set status = 'accepted', reviewed_by = auth.uid(), reviewed_at = now() where id = suggestion_record.id;
  update public.payable_reconciliation_suggestions set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
    where status = 'pending' and id <> suggestion_record.id
      and (occurrence_id = occurrence_record.id or transaction_id = transaction_record.id);
  if not exists (select 1 from public.payable_occurrences where payable_id = occurrence_record.payable_id and status = 'pending') then
    update public.payables set status = 'completed' where id = occurrence_record.payable_id;
  end if;
end;
$$;

revoke all on function public.suggest_payable_reconciliations(uuid) from public, anon;
revoke all on function public.accept_payable_reconciliation(uuid) from public, anon;
grant execute on function public.suggest_payable_reconciliations(uuid) to authenticated, service_role;
grant execute on function public.accept_payable_reconciliation(uuid) to authenticated;
