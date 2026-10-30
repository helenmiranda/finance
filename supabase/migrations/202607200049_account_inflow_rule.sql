-- Regra por conta: nas contas marcadas como "entradas são movimentação" (ex.: conta de investimento ou
-- de organização), tudo que entra e não casou com uma saída de outra conta da família não é receita.
-- A entrada vira movimentação de uma ponta: sai dos totais de receita e mantém o efeito no saldo.
-- As saídas dessas contas continuam como despesa. Requer a migration 047 (coluna transfer_kind).

alter table public.accounts
  add column if not exists incoming_as_movement boolean not null default false;

alter table public.transactions drop constraint if exists transactions_transfer_kind_check;
alter table public.transactions
  add constraint transactions_transfer_kind_check check (transfer_kind is null or transfer_kind in ('investment', 'account_inflow'));

create or replace function public.apply_account_inflow_rule(target_household_id uuid)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  marked_count integer;
begin
  if target_household_id is null then raise exception 'Espaço familiar inválido'; end if;
  if auth.uid() is not null and not public.is_household_member(target_household_id) then
    raise exception 'Acesso negado ao espaço familiar';
  end if;

  update public.transactions transaction
  set type = 'transfer', transfer_direction = 'in', transfer_kind = 'account_inflow', category_id = null, updated_at = now()
  from public.accounts account
  where account.id = transaction.account_id
    and account.household_id = target_household_id
    and account.incoming_as_movement
    and transaction.household_id = target_household_id
    and transaction.source = 'api'
    and transaction.type = 'income'
    and transaction.transfer_group_id is null
    and transaction.status <> 'cancelled';
  get diagnostics marked_count = row_count;

  -- Contas em que a regra foi desligada voltam a contar essas entradas como receita.
  update public.transactions transaction
  set type = 'income', transfer_direction = null, transfer_kind = null, updated_at = now()
  from public.accounts account
  where account.id = transaction.account_id
    and account.household_id = target_household_id
    and not account.incoming_as_movement
    and transaction.household_id = target_household_id
    and transaction.transfer_kind = 'account_inflow';

  return marked_count;
end;
$$;

revoke all on function public.apply_account_inflow_rule(uuid) from public;
grant execute on function public.apply_account_inflow_rule(uuid) to authenticated, service_role;
