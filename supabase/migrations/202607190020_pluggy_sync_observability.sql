alter table public.pluggy_items
  add column provider_updated_at timestamptz,
  add column status_detail jsonb;

create policy "pluggy_refresh_runs_member_read" on public.pluggy_refresh_runs
  for select using (exists (
    select 1
    from public.pluggy_items item
    where item.id = pluggy_refresh_runs.pluggy_item_id
      and public.is_household_member(item.household_id)
  ));

create policy "pluggy_webhook_events_member_read" on public.pluggy_webhook_events
  for select using (exists (
    select 1
    from public.pluggy_items item
    where item.id = pluggy_webhook_events.item_id
      and public.is_household_member(item.household_id)
  ));
