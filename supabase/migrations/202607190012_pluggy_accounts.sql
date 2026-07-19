alter table public.accounts add column current_balance_cents bigint;
alter table public.credit_cards add column current_balance_cents bigint;
alter table public.credit_cards add column available_credit_limit_cents bigint;

create table public.pluggy_accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  item_id uuid not null references public.pluggy_items(id) on delete cascade,
  pluggy_account_id uuid not null unique,
  account_id uuid references public.accounts(id) on delete cascade,
  credit_card_id uuid references public.credit_cards(id) on delete cascade,
  type text not null check (type in ('BANK', 'CREDIT')),
  subtype text,
  name text not null,
  number_masked text,
  balance_cents bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pluggy_account_local_target check (
    (account_id is not null and credit_card_id is null)
    or (account_id is null and credit_card_id is not null)
  )
);

create index pluggy_accounts_household_idx on public.pluggy_accounts (household_id, updated_at desc);
alter table public.pluggy_accounts enable row level security;
create policy "pluggy_accounts_select_member" on public.pluggy_accounts for select using (public.is_household_member(household_id));
create policy "pluggy_accounts_insert_member" on public.pluggy_accounts for insert with check (public.is_household_member(household_id));
create policy "pluggy_accounts_update_member" on public.pluggy_accounts for update using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "pluggy_accounts_delete_member" on public.pluggy_accounts for delete using (public.is_household_member(household_id));
create trigger set_pluggy_accounts_updated_at before update on public.pluggy_accounts for each row execute procedure public.set_updated_at();
