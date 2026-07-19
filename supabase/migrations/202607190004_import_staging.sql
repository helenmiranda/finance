-- Upload privado e área de revisão para extratos e faturas.

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete cascade,
  credit_card_id uuid references public.credit_cards(id) on delete cascade,
  imported_by uuid not null references public.profiles(id),
  original_filename text not null,
  storage_path text not null unique,
  file_format text not null check (file_format in ('csv', 'ofx')),
  status text not null default 'review' check (status in ('processing', 'review', 'confirmed', 'failed', 'cancelled')),
  row_count integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint import_target check (
    (account_id is not null and credit_card_id is null)
    or (account_id is null and credit_card_id is not null)
  )
);

create table public.import_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.imports(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  row_number integer not null,
  occurred_on date,
  description text,
  amount_cents bigint,
  suggested_type text check (suggested_type is null or suggested_type in ('income', 'expense')),
  raw_data jsonb not null default '{}'::jsonb,
  parse_error text,
  review_status text not null default 'pending' check (review_status in ('pending', 'ready', 'ignored', 'duplicate', 'confirmed')),
  created_at timestamptz not null default now(),
  unique (import_id, row_number)
);

create index imports_household_created_idx on public.imports (household_id, created_at desc);
create index import_rows_import_idx on public.import_rows (import_id, row_number);

create trigger set_imports_updated_at
  before update on public.imports
  for each row execute procedure public.set_updated_at();

alter table public.imports enable row level security;
alter table public.import_rows enable row level security;

create policy "imports_member_access" on public.imports
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "import_rows_member_access" on public.import_rows
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'financial-imports',
  'financial-imports',
  false,
  5242880,
  null
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "members_upload_financial_imports" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'financial-imports'
    and public.is_household_member(((storage.foldername(name))[1])::uuid)
  );

create policy "members_read_financial_imports" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'financial-imports'
    and public.is_household_member(((storage.foldername(name))[1])::uuid)
  );

create policy "members_delete_financial_imports" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'financial-imports'
    and public.is_household_member(((storage.foldername(name))[1])::uuid)
  );
