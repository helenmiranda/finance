-- Regras familiares para categorização automática de importações.

create table public.categorization_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  name text not null,
  pattern text not null,
  match_type text not null default 'contains' check (match_type in ('contains', 'starts_with', 'exact')),
  priority integer not null default 100 check (priority between 1 and 1000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index categorization_rules_household_priority_idx
  on public.categorization_rules (household_id, is_active, priority desc);

create trigger set_categorization_rules_updated_at
  before update on public.categorization_rules
  for each row execute procedure public.set_updated_at();

alter table public.categorization_rules enable row level security;

create policy "categorization_rules_member_access" on public.categorization_rules
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create or replace function public.apply_categorization_rules(target_import_id uuid)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  target_household_id uuid;
  affected_count integer;
begin
  select household_id into target_household_id
  from public.imports where id = target_import_id;

  if target_household_id is null or not public.is_household_member(target_household_id) then
    raise exception 'Importação inválida';
  end if;

  update public.import_rows imported_row
  set category_id = coalesce((
    select rule.category_id
    from public.categorization_rules rule
    join public.categories category on category.id = rule.category_id
    where rule.household_id = target_household_id
      and rule.is_active
      and category.is_active
      and category.kind = imported_row.suggested_type
      and (
        (rule.match_type = 'contains' and lower(imported_row.description) like '%' || lower(rule.pattern) || '%')
        or (rule.match_type = 'starts_with' and lower(imported_row.description) like lower(rule.pattern) || '%')
        or (rule.match_type = 'exact' and lower(trim(imported_row.description)) = lower(trim(rule.pattern)))
      )
    order by rule.priority desc, rule.created_at asc
    limit 1
  ), imported_row.category_id)
  where imported_row.import_id = target_import_id
    and imported_row.review_status in ('ready', 'pending')
    and imported_row.description is not null;

  get diagnostics affected_count = row_count;
  return affected_count;
end;
$$;

grant execute on function public.apply_categorization_rules(uuid) to authenticated;
