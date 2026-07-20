-- Celebrações idempotentes para os marcos dos sonhos.

alter table public.notifications
  add column dream_id uuid references public.dreams(id) on delete cascade;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'budget_threshold', 'budget_projection', 'spending_anomaly', 'dream_milestone'
));

create or replace function public.evaluate_dream_milestones(target_household_id uuid)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  item record;
  milestone integer;
  inserted_count integer := 0;
  affected integer;
begin
  if auth.uid() is not null and not public.is_household_member(target_household_id) then
    raise exception 'Espaço familiar inválido';
  end if;

  for item in select id, title, target_cents, saved_cents from public.dreams
    where household_id = target_household_id and saved_cents > 0
  loop
    milestone := case
      when item.saved_cents >= item.target_cents then 100
      when item.saved_cents * 100 >= item.target_cents * 75 then 75
      when item.saved_cents * 100 >= item.target_cents * 50 then 50
      when item.saved_cents * 100 >= item.target_cents * 25 then 25
      else null
    end;
    if milestone is not null then
      insert into public.notifications (
        household_id, dream_id, kind, severity, title, message, link_url, dedupe_key
      ) values (
        target_household_id, item.id, 'dream_milestone', 'info',
        case when milestone = 100 then 'Sonho realizado! 🏆' else item.title || ' chegou a ' || milestone || '%' end,
        case when milestone = 100
          then 'A família completou o sonho ' || item.title || '. Celebrem esta conquista!'
          else 'Mais um marco conquistado em ' || item.title || '. Vocês já guardaram R$ ' || round(item.saved_cents / 100.0, 2) || '.' end,
        '/dashboard/sonhos',
        'dream:' || item.id || ':milestone:' || milestone
      ) on conflict (household_id, dedupe_key) do nothing;
      get diagnostics affected = row_count;
      inserted_count := inserted_count + affected;
    end if;
  end loop;
  return inserted_count;
end;
$$;

create or replace function public.evaluate_financial_alerts(target_household_id uuid)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  budget_count integer;
  anomaly_count integer;
  dream_count integer;
begin
  budget_count := public.evaluate_budget_alerts(target_household_id);
  anomaly_count := public.evaluate_spending_anomalies(target_household_id);
  dream_count := public.evaluate_dream_milestones(target_household_id);
  return coalesce(budget_count, 0) + coalesce(anomaly_count, 0) + coalesce(dream_count, 0);
end;
$$;

revoke all on function public.evaluate_dream_milestones(uuid) from public, anon;
grant execute on function public.evaluate_dream_milestones(uuid) to authenticated, service_role;
