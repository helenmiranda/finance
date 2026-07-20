-- Impede espaços duplicados quando o formulário de onboarding é enviado mais de uma vez.
create or replace function public.create_household(household_name text)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  existing_household_id uuid;
  new_household_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  -- Serializa criações concorrentes do mesmo usuário.
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));

  select membership.household_id
  into existing_household_id
  from public.household_members membership
  where membership.user_id = auth.uid()
  order by membership.joined_at
  limit 1;

  if existing_household_id is not null then
    return existing_household_id;
  end if;

  insert into public.households (name, created_by)
  values (trim(household_name), auth.uid())
  returning id into new_household_id;

  insert into public.household_members (household_id, user_id, role)
  values (new_household_id, auth.uid(), 'owner');

  perform public.seed_default_categories(new_household_id);
  return new_household_id;
end;
$$;

grant execute on function public.create_household(text) to authenticated;
