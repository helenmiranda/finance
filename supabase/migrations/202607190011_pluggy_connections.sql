create table public.pluggy_items (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  connected_by uuid not null references public.profiles(id) on delete cascade, pluggy_item_id uuid not null unique,
  connector_id bigint, connector_name text not null, status text not null default 'UPDATING', execution_status text,
  error_code text, last_synced_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index pluggy_items_household_idx on public.pluggy_items (household_id, updated_at desc);
alter table public.pluggy_items enable row level security;
create policy "pluggy_items_select_member" on public.pluggy_items for select using (public.is_household_member(household_id));
create policy "pluggy_items_insert_owner" on public.pluggy_items for insert with check (public.is_household_member(household_id) and connected_by = auth.uid());
create policy "pluggy_items_update_owner" on public.pluggy_items for update using (public.is_household_member(household_id) and connected_by = auth.uid()) with check (public.is_household_member(household_id) and connected_by = auth.uid());
create policy "pluggy_items_delete_owner" on public.pluggy_items for delete using (public.is_household_member(household_id) and connected_by = auth.uid());
create trigger set_pluggy_items_updated_at before update on public.pluggy_items for each row execute procedure public.set_updated_at();
