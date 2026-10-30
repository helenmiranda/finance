-- Distingue o tipo de movimentação sem criar um tipo novo de transação: continua sendo `transfer`
-- (fora dos totais de receita e despesa, com efeito no saldo), mas aplicações e resgates de
-- investimento passam a ser identificáveis para exibição e filtros.
alter table public.transactions
  add column if not exists transfer_kind text
  check (transfer_kind is null or transfer_kind in ('investment'));

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

  -- Também reclassifica as linhas já convertidas em transferência pela versão anterior.
  update public.transactions
  set type = 'transfer', category_id = null, transfer_kind = 'investment',
      transfer_direction = coalesce(transfer_direction, case when description ilike 'Aplicação RDB%' then 'out' else 'in' end),
      updated_at = now()
  where household_id = target_household_id
    and source = 'api'
    and account_id is not null
    and transfer_group_id is null
    and status <> 'cancelled'
    and transfer_kind is null
    and (
      (type in ('expense', 'transfer') and description ilike 'Aplicação RDB%')
      or (type in ('income', 'transfer') and description ilike 'Resgate RDB%')
    );

  get diagnostics marked_count = row_count;
  return marked_count;
end;
$$;

revoke all on function public.mark_investment_movements(uuid) from public;
grant execute on function public.mark_investment_movements(uuid) to authenticated, service_role;

do $$
declare
  household record;
begin
  for household in select id from public.households loop
    perform public.mark_investment_movements(household.id);
  end loop;
end;
$$;
