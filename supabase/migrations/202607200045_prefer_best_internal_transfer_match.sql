-- O pareamento automático pegava o primeiro lançamento de mesmo valor dentro de três dias, o que
-- emparelhava, por exemplo, a transferência da conta de investimento da Sicredi com o PIX de um cliente
-- em outro banco, deixando a ponta verdadeira como receita ou despesa.
-- Agora os candidatos são ordenados por afinidade: primeiro os que usam o mesmo texto de transferência
-- do banco nas duas pontas, depois a menor diferença de datas e, por fim, a presença de PIX/TED/DOC.

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
    order by
      case when outgoing.description ilike 'transfer%' and incoming.description ilike 'transfer%' then 0 else 1 end,
      abs(incoming.occurred_on - outgoing.occurred_on),
      case when outgoing.description ilike any (array['%pix%', '%transfer%', '%ted%', '%doc%'])
        and incoming.description ilike any (array['%pix%', '%transfer%', '%ted%', '%doc%']) then 0 else 1 end,
      outgoing.occurred_on, outgoing.created_at, incoming.created_at
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

-- Desfaz os pares errados já gravados: uma ponta com texto de transferência entre contas da família
-- ("TRANSFERÊNCIA ... GIOVANA RODRIGUES") emparelhada com um lançamento de texto diferente, enquanto existe
-- outra ponta solta com o mesmo texto, mesmo valor, em outra conta e até três dias de diferença.
-- Os dois lançamentos voltam a receita/despesa e o pareamento acima os junta de novo corretamente.
with wrong_groups as (
  select distinct own.transfer_group_id
  from public.transactions own
  where own.type = 'transfer'
    and own.transfer_group_id is not null
    and own.source = 'api'
    and own.description ilike 'transfer%giovana rodrigues%'
    and exists (
      select 1 from public.transactions partner
      where partner.household_id = own.household_id
        and partner.transfer_group_id = own.transfer_group_id
        and partner.id <> own.id
        and partner.description not ilike 'transfer%'
    )
    and exists (
      select 1 from public.transactions loose
      where loose.household_id = own.household_id
        and loose.transfer_group_id is null
        and loose.source = 'api'
        and loose.status <> 'cancelled'
        and loose.description ilike 'transfer%giovana rodrigues%'
        and loose.amount_cents = own.amount_cents
        and loose.account_id <> own.account_id
        and loose.occurred_on between own.occurred_on - 3 and own.occurred_on + 3
        and (
          (own.transfer_direction = 'out' and loose.type = 'income')
          or (own.transfer_direction = 'in' and loose.type = 'expense')
        )
    )
)
update public.transactions
set type = case when transfer_direction = 'out' then 'expense' else 'income' end,
    transfer_group_id = null, transfer_direction = null, updated_at = now()
where transfer_group_id in (select transfer_group_id from wrong_groups);

do $$
declare
  household record;
begin
  for household in select id from public.households loop
    perform public.auto_mark_internal_transfers(household.id);
  end loop;
end;
$$;
