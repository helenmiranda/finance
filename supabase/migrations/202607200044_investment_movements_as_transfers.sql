-- Aplicações e resgates de RDB (caixinhas do Nubank) movem dinheiro entre a conta corrente e um
-- investimento da própria família: não são despesa nem receita. Ficam como transferência de uma ponta,
-- preservando o efeito no saldo da conta e saindo dos totais de receitas e despesas.

create or replace function public.mark_investment_movements(target_household_id uuid)
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

  update public.transactions
  set transfer_direction = case when type = 'expense' then 'out' else 'in' end,
      type = 'transfer', category_id = null, updated_at = now()
  where household_id = target_household_id
    and source = 'api'
    and account_id is not null
    and transfer_group_id is null
    and status <> 'cancelled'
    and (
      (type = 'expense' and description ilike 'Aplicação RDB%')
      or (type = 'income' and description ilike 'Resgate RDB%')
    );

  get diagnostics marked_count = row_count;
  return marked_count;
end;
$$;

revoke all on function public.mark_investment_movements(uuid) from public;
grant execute on function public.mark_investment_movements(uuid) to authenticated, service_role;

-- Atualizações da Pluggy não podem desfazer uma transferência já marcada pela família.
create or replace function public.reconcile_pluggy_transaction_updates(
  target_household_id uuid,
  target_updates jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_count integer;
begin
  update public.transactions transaction
  set
    type = case when transaction.type = 'transfer' then transaction.type else incoming.type end,
    description = incoming.description,
    amount_cents = incoming.amount_cents,
    occurred_on = incoming.occurred_on,
    status = incoming.status,
    category_id = case when transaction.type = 'transfer' then null else coalesce(transaction.category_id, incoming.category_id) end,
    updated_at = now()
  from public.pluggy_transactions mapping
  join jsonb_to_recordset(target_updates) as incoming(
    remote_id uuid,
    type text,
    description text,
    amount_cents bigint,
    occurred_on date,
    status text,
    category_id uuid
  ) on incoming.remote_id = mapping.pluggy_transaction_id
  where mapping.household_id = target_household_id
    and transaction.household_id = target_household_id
    and transaction.id = mapping.transaction_id
    and incoming.type in ('income', 'expense')
    and incoming.amount_cents > 0
    and incoming.status in ('pending', 'confirmed');

  get diagnostics affected_count = row_count;
  return affected_count;
end;
$$;

revoke all on function public.reconcile_pluggy_transaction_updates(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.reconcile_pluggy_transaction_updates(uuid, jsonb) to service_role;

-- Corrige o histórico já importado.
do $$
declare
  household record;
begin
  for household in select id from public.households loop
    perform public.mark_investment_movements(household.id);
  end loop;
end;
$$;
