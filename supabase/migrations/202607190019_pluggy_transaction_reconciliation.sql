alter table public.pluggy_webhook_events
  drop constraint pluggy_webhook_events_event_type_check;

alter table public.pluggy_webhook_events
  add constraint pluggy_webhook_events_event_type_check check (event_type in (
    'item/updated',
    'item/error',
    'transactions/created',
    'transactions/updated',
    'transactions/deleted'
  ));

create or replace function public.reconcile_pluggy_transaction_updates(
  target_household_id uuid,
  target_updates jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_count integer;
begin
  update public.transactions transaction
  set
    type = incoming.type,
    description = incoming.description,
    amount_cents = incoming.amount_cents,
    occurred_on = incoming.occurred_on,
    status = incoming.status,
    category_id = coalesce(transaction.category_id, incoming.category_id),
    updated_at = now()
  from public.pluggy_transactions mapping
  join jsonb_to_recordset(target_updates) as incoming(
    remote_id uuid,
    type text,
    description text,
    amount_cents bigint,
    occurred_on date,
    status text,
    category_id uuid
  ) on incoming.remote_id = mapping.pluggy_transaction_id
  where mapping.household_id = target_household_id
    and transaction.household_id = target_household_id
    and transaction.id = mapping.transaction_id
    and incoming.type in ('income', 'expense')
    and incoming.amount_cents > 0
    and incoming.status in ('pending', 'confirmed');

  get diagnostics affected_count = row_count;
  return affected_count;
end;
$$;

revoke all on function public.reconcile_pluggy_transaction_updates(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.reconcile_pluggy_transaction_updates(uuid, jsonb) to service_role;
