create table public.ai_recommendation_feedback (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  message_id uuid not null unique references public.ai_messages(id) on delete cascade,
  status text not null check (status in ('accepted', 'discarded')),
  responded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ai_recommendation_feedback_household_idx
  on public.ai_recommendation_feedback (household_id, status, updated_at desc);

create trigger set_ai_recommendation_feedback_updated_at
  before update on public.ai_recommendation_feedback
  for each row execute procedure public.set_updated_at();

alter table public.ai_recommendation_feedback enable row level security;

create policy "ai_recommendation_feedback_member_access" on public.ai_recommendation_feedback
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
