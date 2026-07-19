create table public.pluggy_webhook_events (
  event_id text primary key,
  item_id uuid not null references public.pluggy_items(id) on delete cascade,
  event_type text not null check (event_type in ('item/updated', 'item/error')),
  triggered_by text,
  payload jsonb not null default '{}'::jsonb,
  status text not null check (status in ('processing', 'completed', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index pluggy_webhook_events_item_created_idx
  on public.pluggy_webhook_events (item_id, created_at desc);

alter table public.pluggy_webhook_events enable row level security;

-- Sem políticas públicas: somente o backend com service role processa os eventos.
