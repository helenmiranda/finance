create table public.pluggy_transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  pluggy_account_id uuid not null references public.pluggy_accounts(id) on delete cascade,
  pluggy_transaction_id uuid not null unique,
  transaction_id uuid not null unique references public.transactions(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index pluggy_transactions_household_idx on public.pluggy_transactions (household_id, created_at desc);
alter table public.pluggy_transactions enable row level security;
create policy "pluggy_transactions_select_member" on public.pluggy_transactions for select using (public.is_household_member(household_id));
create policy "pluggy_transactions_insert_member" on public.pluggy_transactions for insert with check (public.is_household_member(household_id));
create policy "pluggy_transactions_update_member" on public.pluggy_transactions for update using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "pluggy_transactions_delete_member" on public.pluggy_transactions for delete using (public.is_household_member(household_id));
