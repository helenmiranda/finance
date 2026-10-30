-- Reaplica as regras familiares ao histórico. Só atinge receitas e despesas ainda sem categoria,
-- então nunca sobrescreve uma categoria escolhida manualmente.

create or replace function public.apply_household_categorization_rules(target_household_id uuid)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  categorized_count integer;
begin
  if target_household_id is null then raise exception 'Espaço familiar inválido'; end if;
  if auth.uid() is not null and not public.is_household_member(target_household_id) then
    raise exception 'Acesso negado ao espaço familiar';
  end if;

  with matches as (
    select transaction.id, (
      select rule.category_id
      from public.categorization_rules rule
      join public.categories category on category.id = rule.category_id
      where rule.household_id = transaction.household_id
        and rule.is_active
        and category.is_active
        and category.kind = transaction.type
        and (
          (rule.match_type = 'contains' and lower(transaction.description) like '%' || lower(rule.pattern) || '%')
          or (rule.match_type = 'starts_with' and lower(transaction.description) like lower(rule.pattern) || '%')
          or (rule.match_type = 'exact' and lower(trim(transaction.description)) = lower(trim(rule.pattern)))
        )
      order by rule.priority desc, rule.created_at asc
      limit 1
    ) as category_id
    from public.transactions transaction
    where transaction.household_id = target_household_id
      and transaction.category_id is null
      and transaction.status <> 'cancelled'
      and transaction.type in ('income', 'expense')
  )
  update public.transactions transaction
  set category_id = matches.category_id, updated_at = now()
  from matches
  where transaction.id = matches.id
    and matches.category_id is not null;

  get diagnostics categorized_count = row_count;
  return categorized_count;
end;
$$;

revoke all on function public.apply_household_categorization_rules(uuid) from public;
grant execute on function public.apply_household_categorization_rules(uuid) to authenticated, service_role;

-- Aplica uma vez às regras já cadastradas.
do $$
declare
  household record;
begin
  for household in select id from public.households loop
    perform public.apply_household_categorization_rules(household.id);
  end loop;
end;
$$;
