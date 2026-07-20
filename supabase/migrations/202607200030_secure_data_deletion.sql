-- Exclusão explícita e transacional de espaços e preparação da exclusão de usuários.
create or replace function public.delete_household_secure(target_household_id uuid, confirmation_name text)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  target_name text;
begin
  select household.name into target_name
  from public.households household
  join public.household_members membership on membership.household_id = household.id
  where household.id = target_household_id
    and membership.user_id = auth.uid()
    and membership.role = 'owner';

  if target_name is null then raise exception 'Apenas o responsável pode excluir este espaço'; end if;
  if trim(confirmation_name) <> target_name then raise exception 'O nome de confirmação não confere'; end if;
  delete from public.households where id = target_household_id;
end;
$$;

create or replace function public.prepare_account_deletion()
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  target_user_id uuid := auth.uid();
  membership record;
  replacement_user_id uuid;
  member_count integer;
begin
  if target_user_id is null then raise exception 'Usuário não autenticado'; end if;

  if exists (
    select 1 from public.household_members owner_membership
    where owner_membership.user_id = target_user_id
      and owner_membership.role = 'owner'
      and (select count(*) from public.household_members members where members.household_id = owner_membership.household_id) > 1
  ) then
    raise exception 'Transfira a responsabilidade dos espaços com outros membros antes de excluir sua conta';
  end if;

  for membership in
    select household_id, role from public.household_members where user_id = target_user_id
  loop
    select count(*) into member_count from public.household_members where household_id = membership.household_id;
    if membership.role = 'owner' and member_count = 1 then
      delete from public.households where id = membership.household_id;
      continue;
    end if;

    select user_id into replacement_user_id
    from public.household_members
    where household_id = membership.household_id and user_id <> target_user_id
    order by case role when 'owner' then 0 when 'admin' then 1 else 2 end, joined_at
    limit 1;
    if replacement_user_id is null then raise exception 'Não foi possível preservar o histórico compartilhado'; end if;

    update public.households set created_by = replacement_user_id where id = membership.household_id and created_by = target_user_id;
    update public.household_invitations set invited_by = replacement_user_id where household_id = membership.household_id and invited_by = target_user_id;
    update public.transactions set created_by = replacement_user_id where household_id = membership.household_id and created_by = target_user_id;
    update public.imports set imported_by = replacement_user_id where household_id = membership.household_id and imported_by = target_user_id;
    update public.goals set created_by = replacement_user_id where household_id = membership.household_id and created_by = target_user_id;
    update public.goal_contributions set contributed_by = replacement_user_id where household_id = membership.household_id and contributed_by = target_user_id;
    update public.ai_conversations set created_by = replacement_user_id where household_id = membership.household_id and created_by = target_user_id;
    update public.pluggy_items set connected_by = replacement_user_id where household_id = membership.household_id and connected_by = target_user_id;
    update public.ai_recommendation_feedback set responded_by = replacement_user_id where household_id = membership.household_id and responded_by = target_user_id;
    delete from public.household_members where household_id = membership.household_id and user_id = target_user_id;
  end loop;
end;
$$;

revoke all on function public.delete_household_secure(uuid, text) from public, anon;
revoke all on function public.prepare_account_deletion() from public, anon;
grant execute on function public.delete_household_secure(uuid, text) to authenticated;
grant execute on function public.prepare_account_deletion() to authenticated;
