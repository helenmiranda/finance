alter table public.imports
  drop constraint if exists imports_file_format_check;

alter table public.imports
  add constraint imports_file_format_check
  check (file_format in ('csv', 'ofx', 'xlsx'));
