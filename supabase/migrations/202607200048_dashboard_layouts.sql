-- Cada pessoa organiza a própria visão geral: ordem, tamanho e widgets ocultos.
create table public.dashboard_layouts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  layout jsonb not null default '{}'::jsonb check (jsonb_typeof(layout) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.dashboard_layouts enable row level security;

create policy "dashboard_layouts_own_access" on public.dashboard_layouts for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
