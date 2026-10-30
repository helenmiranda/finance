-- Marcação manual de movimentação sem a outra ponta: serve quando a conta de origem ou destino não está
-- conectada ao app. O lançamento vira transferência de uma ponta (fora de receitas e despesas, com o mesmo
-- efeito no saldo). Requer a migration 047 (coluna transfer_kind).

alter table public.transactions drop constraint if exists transactions_transfer_kind_check;
alter table public.transactions
  add constraint transactions_transfer_kind_check check (transfer_kind is null or transfer_kind in ('investment', 'account_inflow', 'manual', 'counterparty'));

create or replace function public.mark_transactions_as_movement(target_transaction_ids uuid[])
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  marked_count integer;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado'; end if;
  if cardinality(target_transaction_ids) is null or cardinality(target_transaction_ids) > 100 then
    raise exception 'Selecione de 1 a 100 lançamentos';
  end if;

  update public.transactions
  set transfer_direction = case when type = 'income' then 'in' else 'out' end,
      type = 'transfer', transfer_kind = 'manual', category_id = null, updated_at = now()
  where id = any(target_transaction_ids)
    and type in ('income', 'expense')
    and account_id is not null
    and transfer_group_id is null
    and status <> 'cancelled'
    and public.is_household_member(household_id);

  get diagnostics marked_count = row_count;
  return marked_count;
end;
$$;

-- Desfaz só as marcações manuais de uma ponta; as feitas por regra voltariam na próxima importação.
create or replace function public.unmark_manual_movements(target_transaction_ids uuid[])
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  unmarked_count integer;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado'; end if;
  if cardinality(target_transaction_ids) is null or cardinality(target_transaction_ids) > 100 then
    raise exception 'Selecione de 1 a 100 lançamentos';
  end if;

  update public.transactions
  set type = case when transfer_direction = 'in' then 'income' else 'expense' end,
      transfer_direction = null, transfer_kind = null, updated_at = now()
  where id = any(target_transaction_ids)
    and type = 'transfer'
    and transfer_kind = 'manual'
    and transfer_group_id is null
    and public.is_household_member(household_id);

  get diagnostics unmarked_count = row_count;
  return unmarked_count;
end;
$$;

revoke all on function public.mark_transactions_as_movement(uuid[]) from public;
revoke all on function public.unmark_manual_movements(uuid[]) from public;
grant execute on function public.mark_transactions_as_movement(uuid[]) to authenticated;
grant execute on function public.unmark_manual_movements(uuid[]) to authenticated;
