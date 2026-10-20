-- Calcula totais no banco para manter a página de transações rápida mesmo com histórico extenso.
create or replace function public.transaction_filter_totals(
  target_household_id uuid,
  period_from date,
  period_to date,
  search_query text default null,
  target_type text default null,
  target_category_id uuid default null,
  target_source_kind text default null,
  target_source_id uuid default null,
  only_uncategorized boolean default false
)
returns table(income_cents bigint, expense_cents bigint, transaction_count bigint)
language plpgsql
security invoker set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_household_member(target_household_id) then
    raise exception 'Acesso negado';
  end if;
  if period_from is null or period_to is null or period_from > period_to then
    raise exception 'Período inválido';
  end if;

  return query
  select
    coalesce(sum(case when tx.type = 'income' then tx.amount_cents else 0 end), 0)::bigint,
    coalesce(sum(case when tx.type in ('expense', 'card_payment') then tx.amount_cents else 0 end), 0)::bigint,
    count(*)::bigint
  from public.transactions tx
  where tx.household_id = target_household_id
    and tx.status = 'confirmed'
    and tx.occurred_on between period_from and period_to
    and (search_query is null or tx.description ilike '%' || search_query || '%')
    and (target_type is null or tx.type = target_type)
    and (target_category_id is null or tx.category_id = target_category_id)
    and (not only_uncategorized or (tx.type in ('income', 'expense') and tx.category_id is null))
    and (
      target_source_kind is null or target_source_id is null
      or (target_source_kind = 'account' and tx.account_id = target_source_id)
      or (target_source_kind = 'card' and tx.credit_card_id = target_source_id)
    );
end;
$$;

grant execute on function public.transaction_filter_totals(uuid, date, date, text, text, uuid, text, uuid, boolean) to authenticated;
