create or replace function public.seed_default_categories(target_household_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.categories (household_id, name, kind, color, icon)
  select target_household_id, defaults.name, defaults.kind, defaults.color, defaults.icon
  from (values
    ('Moradia', 'expense', '#78A6D1', '🏠'),
    ('Alimentação', 'expense', '#F2A65A', '🍽️'),
    ('Transporte', 'expense', '#7F8FA6', '🚗'),
    ('Saúde', 'expense', '#ED6A5A', '❤️'),
    ('Educação', 'expense', '#9B8AFB', '🎓'),
    ('Lazer', 'expense', '#E879B9', '🎉'),
    ('Compras', 'expense', '#C58B5A', '🛍️'),
    ('Assinaturas', 'expense', '#6C8AE4', '🔁'),
    ('Contas e serviços', 'expense', '#E9C46A', '💡'),
    ('Cuidados pessoais', 'expense', '#D991C5', '✨'),
    ('Pets', 'expense', '#A98467', '🐾'),
    ('Impostos e taxas', 'expense', '#A0A4A8', '🧾'),
    ('Presentes e doações', 'expense', '#E5989B', '🎁'),
    ('Viagens', 'expense', '#4DB6AC', '✈️'),
    ('Outros', 'expense', '#B7BDB4', '📦'),
    ('Salário', 'income', '#54A96B', '💰'),
    ('Freelance', 'income', '#3FA7A3', '💻'),
    ('Rendimentos', 'income', '#66B77D', '📈'),
    ('Reembolsos', 'income', '#74A8CF', '↩️'),
    ('Outras receitas', 'income', '#8BCF72', '➕')
  ) as defaults(name, kind, color, icon)
  where not exists (
    select 1
    from public.categories existing
    where existing.household_id = target_household_id
      and existing.parent_id is null
      and lower(existing.name) = lower(defaults.name)
  );
$$;

revoke all on function public.seed_default_categories(uuid) from public, anon, authenticated;

select public.seed_default_categories(id)
from public.households;

create or replace function public.create_household(household_name text)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  new_household_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  insert into public.households (name, created_by)
  values (household_name, auth.uid())
  returning id into new_household_id;

  insert into public.household_members (household_id, user_id, role)
  values (new_household_id, auth.uid(), 'owner');

  perform public.seed_default_categories(new_household_id);

  return new_household_id;
end;
$$;

grant execute on function public.create_household(text) to authenticated;
