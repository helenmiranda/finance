create table public.pluggy_refresh_runs (
  id uuid primary key default gen_random_uuid(),
  pluggy_item_id uuid not null references public.pluggy_items(id) on delete cascade,
  reference_date date not null,
  slot text not null check (slot in ('morning', 'afternoon', 'night')),
  status text not null check (status in ('processing', 'triggered', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (pluggy_item_id, reference_date, slot)
);

create index pluggy_refresh_runs_date_idx on public.pluggy_refresh_runs (reference_date desc, slot);
alter table public.pluggy_refresh_runs enable row level security;

-- Sem políticas públicas: somente o servidor com service role acessa o controle do cron.
