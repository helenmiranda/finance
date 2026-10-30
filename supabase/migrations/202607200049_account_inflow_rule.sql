-- Regras para movimentações que o app não consegue parear sozinho. Requer a migration 047 (coluna transfer_kind).
--
-- 1) Pessoas da família fora do app (ex.: marido ou esposa com conta não conectada): PIX de ou para elas
--    é movimentação, não receita nem despesa. Cadastradas pela tela Regras, com direção própria.
-- 2) Regra por conta: nas contas marcadas como "entradas são movimentação", o que entra sem par não é receita.
--
-- A movimentação fica de uma ponta: sai dos totais de receita e despesa e mantém o efeito no saldo.
-- Funciona sobre o banco com ou sem a versão anterior desta migration (lista de contrapartes só de entradas).

create table if not exists public.internal_counterparties (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  pattern text not null check (char_length(pattern) between 2 and 120),
  created_at timestamptz not null default now(),
  unique (household_id, pattern)
);

alter table public.internal_counterparties
  add column if not exists applies_to text not null default 'both' check (applies_to in ('in', 'out', 'both'));

alter table public.internal_counterparties enable row level security;
drop policy if exists "internal_counterparties_household_access" on public.internal_counterparties;
create policy "internal_counterparties_household_access" on public.internal_counterparties for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- A Inked Supply é fornecedora: só os PIX que ela envia são movimentação; os pagamentos a ela seguem como despesa.
insert into public.internal_counterparties (household_id, name, pattern, applies_to)
select id, 'Inked Supply', 'inked supply', 'in' from public.households
on conflict (household_id, pattern) do update set applies_to = 'in';

-- O pareamento automático volta a considerar todas as entradas; a regra de pessoas roda depois, só no que sobrar.
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

alter table public.transactions drop constraint if exists transactions_transfer_kind_check;
alter table public.transactions
  add constraint transactions_transfer_kind_check check (transfer_kind is null or transfer_kind in ('investment', 'account_inflow', 'manual', 'counterparty'));

alter table public.accounts
  add column if not exists incoming_as_movement boolean not null default false;

create or replace function public.mark_internal_counterparty_movements(target_household_id uuid)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  marked_count integer;
begin
  if target_household_id is null then raise exception 'Espaço familiar inválido'; end if;
  if auth.uid() is not null and not public.is_household_member(target_household_id) then
    raise exception 'Acesso negado ao espaço familiar';
  end if;

  update public.transactions transaction
  set transfer_direction = case when transaction.type = 'income' then 'in' else 'out' end,
      type = 'transfer', transfer_kind = 'counterparty', category_id = null, updated_at = now()
  where transaction.household_id = target_household_id
    and transaction.source = 'api'
    and transaction.account_id is not null
    and transaction.type in ('income', 'expense')
    and transaction.transfer_group_id is null
    and transaction.status <> 'cancelled'
    and exists (
      select 1 from public.internal_counterparties counterparty
      where counterparty.household_id = transaction.household_id
        and transaction.description ilike '%' || counterparty.pattern || '%'
        and (
          counterparty.applies_to = 'both'
          or (counterparty.applies_to = 'in' and transaction.type = 'income')
          or (counterparty.applies_to = 'out' and transaction.type = 'expense')
        )
    );
  get diagnostics marked_count = row_count;

  -- Pessoa removida da lista ou direção alterada: o lançamento volta a ser receita ou despesa.
  update public.transactions transaction
  set type = case when transaction.transfer_direction = 'in' then 'income' else 'expense' end,
      transfer_direction = null, transfer_kind = null, updated_at = now()
  where transaction.household_id = target_household_id
    and transaction.transfer_kind = 'counterparty'
    and transaction.transfer_group_id is null
    and not exists (
      select 1 from public.internal_counterparties counterparty
      where counterparty.household_id = transaction.household_id
        and transaction.description ilike '%' || counterparty.pattern || '%'
        and (
          counterparty.applies_to = 'both'
          or (counterparty.applies_to = 'in' and transaction.transfer_direction = 'in')
          or (counterparty.applies_to = 'out' and transaction.transfer_direction = 'out')
        )
    );

  return marked_count;
end;
$$;

revoke all on function public.mark_internal_counterparty_movements(uuid) from public;
grant execute on function public.mark_internal_counterparty_movements(uuid) to authenticated, service_role;

create or replace function public.apply_account_inflow_rule(target_household_id uuid)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  marked_count integer;
begin
  if target_household_id is null then raise exception 'Espaço familiar inválido'; end if;
  if auth.uid() is not null and not public.is_household_member(target_household_id) then
    raise exception 'Acesso negado ao espaço familiar';
  end if;

  update public.transactions transaction
  set type = 'transfer', transfer_direction = 'in', transfer_kind = 'account_inflow', category_id = null, updated_at = now()
  from public.accounts account
  where account.id = transaction.account_id
    and account.household_id = target_household_id
    and account.incoming_as_movement
    and transaction.household_id = target_household_id
    and transaction.source = 'api'
    and transaction.type = 'income'
    and transaction.transfer_group_id is null
    and transaction.status <> 'cancelled';
  get diagnostics marked_count = row_count;

  -- Contas em que a regra foi desligada voltam a contar essas entradas como receita.
  update public.transactions transaction
  set type = 'income', transfer_direction = null, transfer_kind = null, updated_at = now()
  from public.accounts account
  where account.id = transaction.account_id
    and account.household_id = target_household_id
    and not account.incoming_as_movement
    and transaction.household_id = target_household_id
    and transaction.transfer_kind = 'account_inflow';

  return marked_count;
end;
$$;

revoke all on function public.apply_account_inflow_rule(uuid) from public;
grant execute on function public.apply_account_inflow_rule(uuid) to authenticated, service_role;

do $$
declare
  household record;
begin
  for household in select id from public.households loop
    perform public.mark_internal_counterparty_movements(household.id);
  end loop;
end;
$$;
