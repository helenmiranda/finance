alter table public.notifications
  add column transaction_id uuid references public.transactions(id) on delete cascade;

alter table public.notifications
  drop constraint notifications_kind_check;

alter table public.notifications
  add constraint notifications_kind_check check (kind in (
    'budget_threshold',
    'budget_projection',
    'spending_anomaly'
  ));

create or replace function public.evaluate_spending_anomalies(target_household_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_day date := (now() at time zone 'America/Sao_Paulo')::date;
  month_start date := date_trunc('month', current_day)::date;
  candidate record;
  inserted_count integer := 0;
  affected integer;
begin
  if auth.uid() is not null and not public.is_household_member(target_household_id) then
    raise exception 'Espaço familiar inválido';
  end if;

  for candidate in
    select transaction.id, transaction.category_id, transaction.description,
      transaction.amount_cents, category.name as category_name,
      history.average_cents, history.sample_count
    from public.transactions transaction
    join public.categories category on category.id = transaction.category_id
    join lateral (
      select avg(previous.amount_cents)::bigint as average_cents, count(*) as sample_count
      from public.transactions previous
      where previous.household_id = transaction.household_id
        and previous.category_id = transaction.category_id
        and previous.type = 'expense'
        and previous.status = 'confirmed'
        and previous.occurred_on >= month_start - interval '90 days'
        and previous.occurred_on < month_start
    ) history on history.sample_count >= 3
    where transaction.household_id = target_household_id
      and transaction.type = 'expense'
      and transaction.status = 'confirmed'
      and transaction.occurred_on >= month_start
      and transaction.occurred_on <= current_day
      and transaction.amount_cents >= 20000
      and transaction.amount_cents >= history.average_cents * 2
  loop
    insert into public.notifications (
      household_id, transaction_id, category_id, kind, severity,
      title, message, link_url, dedupe_key
    ) values (
      target_household_id, candidate.id, candidate.category_id, 'spending_anomaly', 'warning',
      'Gasto fora do padrão em ' || candidate.category_name,
      candidate.description || ' foi de R$ ' || round(candidate.amount_cents / 100.0, 2)
        || ', acima da média recente de R$ ' || round(candidate.average_cents / 100.0, 2) || '.',
      '/dashboard/transacoes',
      'anomaly:transaction:' || candidate.id
    ) on conflict (household_id, dedupe_key) do nothing;
    get diagnostics affected = row_count;
    inserted_count := inserted_count + affected;
  end loop;

  return inserted_count;
end;
$$;

create or replace function public.evaluate_financial_alerts(target_household_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  budget_count integer;
  anomaly_count integer;
begin
  budget_count := public.evaluate_budget_alerts(target_household_id);
  anomaly_count := public.evaluate_spending_anomalies(target_household_id);
  return coalesce(budget_count, 0) + coalesce(anomaly_count, 0);
end;
$$;

revoke all on function public.evaluate_spending_anomalies(uuid) from public, anon;
revoke all on function public.evaluate_financial_alerts(uuid) from public, anon;
grant execute on function public.evaluate_spending_anomalies(uuid) to authenticated, service_role;
grant execute on function public.evaluate_financial_alerts(uuid) to authenticated, service_role;
