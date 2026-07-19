-- Agenda a terceira e última atualização bancária do dia para 22h de Brasília
-- (01:00 UTC). A URL do app e o segredo ficam criptografados no Supabase Vault.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create or replace function public.request_pluggy_night_refresh()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  app_url text;
  cron_secret text;
  request_id bigint;
begin
  select decrypted_secret
    into app_url
    from vault.decrypted_secrets
   where name = 'poupemos_app_url'
   limit 1;

  select decrypted_secret
    into cron_secret
    from vault.decrypted_secrets
   where name = 'poupemos_cron_secret'
   limit 1;

  if app_url is null or cron_secret is null then
    raise warning 'Cadastre poupemos_app_url e poupemos_cron_secret no Supabase Vault.';
    return null;
  end if;

  select net.http_get(
    url := rtrim(app_url, '/') || '/api/cron/pluggy-refresh',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || cron_secret,
      'Accept', 'application/json'
    ),
    timeout_milliseconds := 60000
  ) into request_id;

  return request_id;
end;
$$;

revoke all on function public.request_pluggy_night_refresh() from public, anon, authenticated;

select cron.schedule(
  'poupemos-pluggy-night-refresh',
  '0 1 * * *',
  $job$select public.request_pluggy_night_refresh();$job$
);

