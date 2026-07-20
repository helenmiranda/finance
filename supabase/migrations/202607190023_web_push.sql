create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notification_push_deliveries (
  notification_id uuid not null references public.notifications(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('sent', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  primary key (notification_id, subscription_id)
);

alter table public.push_subscriptions enable row level security;
alter table public.notification_push_deliveries enable row level security;

create policy "push_subscriptions_own_access" on public.push_subscriptions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Entregas são acessadas somente pelo backend com service role.
