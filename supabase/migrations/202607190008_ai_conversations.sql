-- Histórico familiar do assistente financeiro.

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  title text not null default 'Nova conversa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  model text,
  created_at timestamptz not null default now()
);

create index ai_conversations_user_updated_idx on public.ai_conversations (created_by, updated_at desc);
create index ai_messages_conversation_created_idx on public.ai_messages (conversation_id, created_at);

create trigger set_ai_conversations_updated_at
  before update on public.ai_conversations
  for each row execute procedure public.set_updated_at();

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

create policy "ai_conversations_member_access" on public.ai_conversations
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "ai_messages_member_access" on public.ai_messages
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
