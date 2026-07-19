-- Aplica as regras familiares já existentes aos lançamentos ainda sem categoria.
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
  where transaction.category_id is null
    and transaction.type in ('income', 'expense')
)
update public.transactions transaction
set category_id = matches.category_id
from matches
where transaction.id = matches.id
  and matches.category_id is not null;
