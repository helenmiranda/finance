-- Cada Item ID fica associado à conta Pluggy que o criou.
-- As conexões existentes continuam usando a conta principal.
alter table public.pluggy_items
  add column credential_profile text not null default 'default'
  check (credential_profile in ('default', 'helen'));
