-- Reconhece transferências internas importadas pela Pluggy com sinais bancários fortes.
-- A regra exige contas diferentes da mesma família, valores idênticos, no máximo três
-- dias de diferença e marcador de PIX/transferência/TED/DOC em pelo menos uma ponta.

create or replace function public.auto_mark_internal_transfers(target_household_id uuid)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  candidate record;
  group_id uuid;
  matched_count integer := 0;
begin
  if target_household_id is null then raise exception 'Espaço familiar inválido'; end if;
  if auth.uid() is not null and not public.is_household_member(target_household_id) then
    raise exception 'Acesso negado ao espaço familiar';
  end if;

  for candidate in
    select outgoing.id as source_id, incoming.id as destination_id
    from public.transactions outgoing
    join public.transactions incoming
      on incoming.household_id = outgoing.household_id
      and incoming.type = 'income'
      and incoming.account_id is not null
      and incoming.account_id <> outgoing.account_id
      and incoming.amount_cents = outgoing.amount_cents
      and incoming.occurred_on between outgoing.occurred_on - 3 and outgoing.occurred_on + 3
    where outgoing.household_id = target_household_id
      and outgoing.source = 'api'
      and incoming.source = 'api'
      and outgoing.type = 'expense'
      and outgoing.account_id is not null
      and outgoing.transfer_group_id is null
      and incoming.transfer_group_id is null
      and outgoing.status <> 'cancelled'
      and incoming.status <> 'cancelled'
      and (
        outgoing.description ilike any (array['%pix%', '%transfer%', '%ted%', '%doc%'])
        or incoming.description ilike any (array['%pix%', '%transfer%', '%ted%', '%doc%'])
      )
    order by outgoing.occurred_on, outgoing.created_at, incoming.created_at
    for update of outgoing, incoming skip locked
  loop
    group_id := gen_random_uuid();
    update public.transactions
    set type = 'transfer', category_id = null, transfer_group_id = group_id,
        transfer_direction = case when id = candidate.source_id then 'out' else 'in' end,
        updated_at = now()
    where (
      id = candidate.source_id and type = 'expense'
      and exists (
        select 1 from public.transactions
        where id = candidate.destination_id and type = 'income' and transfer_group_id is null
      )
    ) or (
      id = candidate.destination_id and type = 'income'
      and exists (
        select 1 from public.transactions
        where id = candidate.source_id and type = 'expense' and transfer_group_id is null
      )
    );
    if found then matched_count := matched_count + 1; end if;
  end loop;

  return matched_count;
end;
$$;

revoke all on function public.auto_mark_internal_transfers(uuid) from public;
grant execute on function public.auto_mark_internal_transfers(uuid) to authenticated, service_role;

-- Corrige os lançamentos históricos que atendem à regra de alta confiança.
do $$
declare
  household record;
begin
  for household in select id from public.households loop
    perform public.auto_mark_internal_transfers(household.id);
  end loop;
end;
$$;
