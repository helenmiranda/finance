-- Pagamento integral de fatura sem duplicar a despesa da compra.

alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions
  add constraint transactions_type_check
  check (type in ('income', 'expense', 'transfer', 'card_payment'));

create unique index if not exists one_payment_per_statement
  on public.transactions (statement_id)
  where type = 'card_payment' and status <> 'cancelled';

create or replace function public.pay_card_statement(
  target_statement_id uuid,
  source_account_id uuid,
  payment_date date
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  statement_record public.card_statements%rowtype;
  account_household_id uuid;
  card_name text;
  payment_id uuid;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado'; end if;

  select * into statement_record
  from public.card_statements
  where id = target_statement_id
  for update;

  if statement_record.id is null
    or not public.is_household_member(statement_record.household_id) then
    raise exception 'Fatura inválida';
  end if;
  if statement_record.status = 'paid' then raise exception 'Fatura já paga'; end if;

  select household_id into account_household_id
  from public.accounts
  where id = source_account_id and is_active;

  if account_household_id is distinct from statement_record.household_id then
    raise exception 'Conta inválida';
  end if;

  select name into card_name from public.credit_cards where id = statement_record.credit_card_id;

  insert into public.transactions (
    household_id, account_id, statement_id, created_by, type, description,
    amount_cents, occurred_on, status, source
  ) values (
    statement_record.household_id,
    source_account_id,
    statement_record.id,
    auth.uid(),
    'card_payment',
    'Pagamento da fatura ' || coalesce(card_name, ''),
    statement_record.total_cents,
    payment_date,
    'confirmed',
    'manual'
  ) returning id into payment_id;

  update public.card_statements
  set status = 'paid', paid_at = payment_date::timestamptz, updated_at = now()
  where id = statement_record.id;

  return payment_id;
end;
$$;

grant execute on function public.pay_card_statement(uuid, uuid, date) to authenticated;
