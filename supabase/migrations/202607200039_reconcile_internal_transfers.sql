-- Converte as duas pontas de uma movimentação interna já importada em uma transferência.
-- Mantém os fingerprints da Pluggy para que uma sincronização posterior não recrie os lançamentos.

create or replace function public.mark_transactions_as_transfer(
  source_transaction_id uuid,
  destination_transaction_id uuid
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  source_record public.transactions%rowtype;
  destination_record public.transactions%rowtype;
  group_id uuid := gen_random_uuid();
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado'; end if;
  if source_transaction_id = destination_transaction_id then raise exception 'Selecione as duas pontas da transferência'; end if;

  select * into source_record
  from public.transactions
  where id = source_transaction_id
  for update;

  select * into destination_record
  from public.transactions
  where id = destination_transaction_id
  for update;

  if source_record.id is null or destination_record.id is null
    or source_record.household_id <> destination_record.household_id
    or not public.is_household_member(source_record.household_id) then
    raise exception 'Lançamentos inválidos';
  end if;

  if source_record.type <> 'expense' or destination_record.type <> 'income'
    or source_record.account_id is null or destination_record.account_id is null
    or source_record.account_id = destination_record.account_id
    or source_record.amount_cents <> destination_record.amount_cents
    or source_record.status = 'cancelled' or destination_record.status = 'cancelled' then
    raise exception 'Escolha uma saída e uma entrada de mesmo valor em contas diferentes';
  end if;

  update public.transactions
  set type = 'transfer', category_id = null, transfer_group_id = group_id,
      transfer_direction = 'out', updated_at = now()
  where id = source_record.id;

  update public.transactions
  set type = 'transfer', category_id = null, transfer_group_id = group_id,
      transfer_direction = 'in', updated_at = now()
  where id = destination_record.id;

  return group_id;
end;
$$;

grant execute on function public.mark_transactions_as_transfer(uuid, uuid) to authenticated;
