create table public.investments (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  item_id uuid not null references public.pluggy_items(id) on delete cascade, pluggy_investment_id uuid not null unique,
  name text not null, code text, isin text, owner_name text, currency_code char(3) not null default 'BRL',
  type text not null, subtype text, reference_date date, unit_value_cents bigint, quantity numeric,
  gross_amount_cents bigint not null default 0, net_balance_cents bigint not null default 0,
  original_amount_cents bigint, profit_cents bigint, withdrawable_cents bigint, income_tax_cents bigint, financial_tax_cents bigint,
  due_date date, rate numeric, rate_type text, fixed_annual_rate numeric, issuer text, institution_name text,
  status text not null default 'ACTIVE', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index investments_household_balance_idx on public.investments (household_id, net_balance_cents desc);
alter table public.investments enable row level security;
create policy "investments_select_member" on public.investments for select using (public.is_household_member(household_id));
create policy "investments_insert_member" on public.investments for insert with check (public.is_household_member(household_id));
create policy "investments_update_member" on public.investments for update using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "investments_delete_member" on public.investments for delete using (public.is_household_member(household_id));
create trigger set_investments_updated_at before update on public.investments for each row execute procedure public.set_updated_at();
