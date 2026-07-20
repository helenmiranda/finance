-- Capas privadas dos sonhos familiares.

alter table public.dreams add column cover_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'dream-covers',
  'dream-covers',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "members_upload_dream_covers" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'dream-covers'
    and public.is_household_member(((storage.foldername(name))[1])::uuid)
  );

create policy "members_read_dream_covers" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'dream-covers'
    and public.is_household_member(((storage.foldername(name))[1])::uuid)
  );

create policy "members_delete_dream_covers" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'dream-covers'
    and public.is_household_member(((storage.foldername(name))[1])::uuid)
  );
