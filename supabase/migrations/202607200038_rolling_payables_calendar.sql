-- Recorrências contínuas com janela móvel de doze meses, mantida pelo Supabase Cron.

alter table public.payables add column auto_renew boolean not null default false;

create or replace function public.extend_recurring_payables()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  item record;
  last_due date;
  last_number integer;
  horizon date := (date_trunc('month', current_date) + interval '11 months')::date;
  inserted_count integer := 0;
begin
  for item in select * from public.payables
    where schedule_type = 'recurring' and auto_renew and status = 'active'
  loop
    select max(due_on), max(occurrence_number) into last_due, last_number
      from public.payable_occurrences where payable_id = item.id;
    while last_due < horizon loop
      last_due := (last_due + interval '1 month')::date;
      last_number := last_number + 1;
      insert into public.payable_occurrences (
        payable_id, household_id, due_on, amount_cents, occurrence_number
      ) values (item.id, item.household_id, last_due, item.amount_cents, last_number)
      on conflict (payable_id, occurrence_number) do nothing;
      inserted_count := inserted_count + 1;
    end loop;
  end loop;
  return inserted_count;
end;
$$;

revoke all on function public.extend_recurring_payables() from public, anon, authenticated;
grant execute on function public.extend_recurring_payables() to service_role;

do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'poupemos-renew-recurring-payables';
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
  perform cron.schedule(
    'poupemos-renew-recurring-payables',
    '20 4 * * *',
    'select public.extend_recurring_payables();'
  );
end $$;
