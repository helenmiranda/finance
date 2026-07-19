-- Inclusão segura de membros no espaço financeiro familiar.

drop policy if exists "profiles_select_household_members" on public.profiles;
create policy "profiles_select_household_members" on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1 from public.household_members target_membership
      where target_membership.user_id = profiles.id
        and public.is_household_member(target_membership.household_id)
    )
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    lower(new.email)
  );

  insert into public.household_members (household_id, user_id, role)
  select invitation.household_id, new.id, invitation.role
  from public.household_invitations invitation
  where lower(invitation.email) = lower(new.email)
    and invitation.status = 'pending'
    and invitation.expires_at > now()
  on conflict (household_id, user_id) do nothing;

  update public.household_invitations
  set status = 'accepted'
  where lower(email) = lower(new.email)
    and status = 'pending'
    and expires_at > now();

  return new;
end;
$$;

create or replace function public.invite_household_member(
  target_household_id uuid,
  member_email text,
  member_role text default 'member'
)
returns text
language plpgsql
security definer set search_path = ''
as $$
declare
  normalized_email text := lower(trim(member_email));
  existing_user_id uuid;
begin
  if not public.is_household_admin(target_household_id) then
    raise exception 'Apenas administradores podem incluir membros';
  end if;
  if member_role not in ('admin', 'member') then raise exception 'Papel inválido'; end if;
  if normalized_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail inválido'; end if;

  select id into existing_user_id from auth.users where lower(email) = normalized_email limit 1;

  if existing_user_id is not null then
    insert into public.household_members (household_id, user_id, role)
    values (target_household_id, existing_user_id, member_role)
    on conflict (household_id, user_id) do update set role = excluded.role;

    update public.household_invitations
    set status = 'accepted'
    where household_id = target_household_id and lower(email) = normalized_email and status = 'pending';
    return 'added';
  end if;

  insert into public.household_invitations (household_id, email, role, invited_by)
  values (target_household_id, normalized_email, member_role, auth.uid())
  on conflict (household_id, lower(email)) where status = 'pending'
  do update set role = excluded.role, expires_at = now() + interval '7 days', invited_by = auth.uid();

  return 'invited';
end;
$$;

grant execute on function public.invite_household_member(uuid, text, text) to authenticated;
