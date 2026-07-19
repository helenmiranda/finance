-- Estrutura inicial do Poupemos.
-- Execute por migration da CLI do Supabase ou pelo SQL Editor do projeto.

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency_code char(3) not null default 'BRL',
  timezone text not null default 'America/Sao_Paulo',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'cancelled', 'expired')),
  invited_by uuid not null references public.profiles(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

create unique index household_pending_invitation_email
  on public.household_invitations (household_id, lower(email))
  where status = 'pending';

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  institution_name text,
  type text not null check (type in ('checking', 'savings', 'cash', 'investment', 'other')),
  initial_balance_cents bigint not null default 0,
  color text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  payment_account_id uuid references public.accounts(id) on delete set null,
  name text not null,
  issuer text,
  last_four_digits varchar(4),
  cardholder_name text,
  credit_limit_cents bigint check (credit_limit_cents is null or credit_limit_cents >= 0),
  closing_day smallint check (closing_day between 1 and 31),
  due_day smallint check (due_day between 1 and 31),
  color text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint credit_card_last_four_digits check (
    last_four_digits is null or last_four_digits ~ '^[0-9]{4}$'
  )
);

create table public.card_statements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  credit_card_id uuid not null references public.credit_cards(id) on delete cascade,
  reference_month date not null,
  closing_date date,
  due_date date not null,
  total_cents bigint not null default 0,
  status text not null default 'open' check (status in ('open', 'closed', 'paid', 'overdue')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (credit_card_id, reference_month),
  constraint statement_reference_month_first_day check (
    reference_month = date_trunc('month', reference_month)::date
  )
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  parent_id uuid references public.categories(id) on delete set null,
  name text not null,
  kind text not null check (kind in ('income', 'expense')),
  color text,
  icon text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index categories_unique_name_per_parent
  on public.categories (household_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  credit_card_id uuid references public.credit_cards(id) on delete set null,
  statement_id uuid references public.card_statements(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  created_by uuid not null references public.profiles(id),
  type text not null check (type in ('income', 'expense', 'transfer')),
  description text not null,
  amount_cents bigint not null check (amount_cents > 0),
  occurred_on date not null,
  status text not null default 'confirmed' check (status in ('pending', 'confirmed', 'cancelled')),
  transfer_group_id uuid,
  installment_group_id uuid,
  installment_number smallint check (installment_number is null or installment_number > 0),
  installment_count smallint check (installment_count is null or installment_count > 0),
  notes text,
  source text not null default 'manual' check (source in ('manual', 'csv', 'xlsx', 'ofx', 'api')),
  source_fingerprint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transaction_payment_source check (
    (account_id is not null and credit_card_id is null)
    or (account_id is null and credit_card_id is not null)
  ),
  constraint transaction_installment_position check (
    installment_number is null
    or installment_count is null
    or installment_number <= installment_count
  )
);

create unique index transactions_source_fingerprint_unique
  on public.transactions (household_id, source_fingerprint)
  where source_fingerprint is not null;

create index transactions_household_date_idx
  on public.transactions (household_id, occurred_on desc);

create index transactions_statement_idx
  on public.transactions (statement_id)
  where statement_id is not null;

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  reference_month date not null,
  limit_cents bigint not null check (limit_cents > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, category_id, reference_month),
  constraint budget_reference_month_first_day check (
    reference_month = date_trunc('month', reference_month)::date
  )
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = target_household_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_household_admin(target_household_id uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = target_household_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

create or replace function public.create_household(household_name text)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  new_household_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  insert into public.households (name, created_by)
  values (household_name, auth.uid())
  returning id into new_household_id;

  insert into public.household_members (household_id, user_id, role)
  values (new_household_id, auth.uid(), 'owner');

  return new_household_id;
end;
$$;

grant execute on function public.create_household(text) to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'households', 'household_members', 'household_invitations',
    'accounts', 'credit_cards', 'card_statements', 'categories',
    'transactions', 'budgets'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "households_select_member" on public.households
  for select using (public.is_household_member(id));
create policy "households_update_admin" on public.households
  for update using (public.is_household_admin(id)) with check (public.is_household_admin(id));

create policy "members_select_member" on public.household_members
  for select using (public.is_household_member(household_id));
create policy "members_manage_admin" on public.household_members
  for all using (public.is_household_admin(household_id))
  with check (public.is_household_admin(household_id));

create policy "invitations_select_member" on public.household_invitations
  for select using (public.is_household_member(household_id));
create policy "invitations_manage_admin" on public.household_invitations
  for all using (public.is_household_admin(household_id))
  with check (public.is_household_admin(household_id));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'accounts', 'credit_cards', 'card_statements', 'categories', 'transactions', 'budgets'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select using (public.is_household_member(household_id))',
      table_name || '_select_member', table_name
    );
    execute format(
      'create policy %I on public.%I for insert with check (public.is_household_member(household_id))',
      table_name || '_insert_member', table_name
    );
    execute format(
      'create policy %I on public.%I for update using (public.is_household_member(household_id)) with check (public.is_household_member(household_id))',
      table_name || '_update_member', table_name
    );
    execute format(
      'create policy %I on public.%I for delete using (public.is_household_member(household_id))',
      table_name || '_delete_member', table_name
    );
  end loop;
end $$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'households', 'accounts', 'credit_cards', 'card_statements',
    'categories', 'transactions', 'budgets'
  ]
  loop
    execute format(
      'create trigger set_%I_updated_at before update on public.%I for each row execute procedure public.set_updated_at()',
      table_name, table_name
    );
  end loop;
end $$;
