create or replace function public.merge_household_category(source_category_id uuid, target_category_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_category public.categories%rowtype;
  target_category public.categories%rowtype;
begin
  if source_category_id = target_category_id then raise exception 'As categorias devem ser diferentes'; end if;

  select * into source_category from public.categories where id = source_category_id;
  select * into target_category from public.categories where id = target_category_id;
  if source_category.id is null or target_category.id is null
    or source_category.household_id <> target_category.household_id
    or not public.is_household_member(source_category.household_id) then
    raise exception 'Categorias inválidas';
  end if;
  if source_category.kind <> target_category.kind then raise exception 'As categorias precisam ter o mesmo tipo'; end if;
  if exists (select 1 from public.categories where parent_id = source_category_id) then
    raise exception 'Mova ou edite as subcategorias antes de substituir esta categoria';
  end if;

  update public.transactions set category_id = target_category_id where category_id = source_category_id;
  update public.import_rows set category_id = target_category_id where category_id = source_category_id;
  update public.categorization_rules set category_id = target_category_id where category_id = source_category_id;
  update public.notifications set category_id = target_category_id where category_id = source_category_id;

  update public.budgets source_budget
  set category_id = target_category_id
  where source_budget.category_id = source_category_id
    and not exists (
      select 1 from public.budgets target_budget
      where target_budget.household_id = source_budget.household_id
        and target_budget.category_id = target_category_id
        and target_budget.reference_month = source_budget.reference_month
    );
  delete from public.budgets where category_id = source_category_id;

  update public.categories set is_active = false where id = source_category_id;
end;
$$;

grant execute on function public.merge_household_category(uuid, uuid) to authenticated;
