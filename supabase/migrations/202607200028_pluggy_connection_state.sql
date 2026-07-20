alter table public.pluggy_items
  add column is_active boolean not null default true;

create index pluggy_items_active_refresh_idx
  on public.pluggy_items (is_active, updated_at)
  where is_active;
