create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  budget_id uuid references public.budgets(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  kind text not null check (kind in ('budget_threshold', 'budget_projection')),
  severity text not null check (severity in ('info', 'warning', 'critical')),
  title text not null,
  message text not null,
  link_url text,
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  unique (household_id, dedupe_key)
);

create table public.notification_reads (
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

create index notifications_household_created_idx on public.notifications (household_id, created_at desc);
alter table public.notifications enable row level security;
alter table public.notification_reads enable row level security;

create policy "notifications_member_read" on public.notifications for select
  using (public.is_household_member(household_id));

create policy "notification_reads_own_access" on public.notification_reads for all
  using (user_id = auth.uid() and exists (
    select 1 from public.notifications notification
    where notification.id = notification_reads.notification_id
      and public.is_household_member(notification.household_id)
  ))
  with check (user_id = auth.uid() and exists (
    select 1 from public.notifications notification
    where notification.id = notification_reads.notification_id
      and public.is_household_member(notification.household_id)
  ));

create or replace function public.evaluate_budget_alerts(target_household_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_day date := (now() at time zone 'America/Sao_Paulo')::date;
  month_start date := date_trunc('month', current_day)::date;
  next_month date := (date_trunc('month', current_day) + interval '1 month')::date;
  days_in_month integer := extract(day from (next_month - interval '1 day'))::integer;
  elapsed_days integer := extract(day from current_day)::integer;
  item record;
  threshold integer;
  projected bigint;
  inserted_count integer := 0;
  affected integer;
begin
  if auth.uid() is not null and not public.is_household_member(target_household_id) then
    raise exception 'Espaço familiar inválido';
  end if;

  for item in
    select budget.id, budget.category_id, budget.limit_cents, category.name,
      coalesce(sum(transaction.amount_cents) filter (where transaction.id is not null), 0)::bigint as spent
    from public.budgets budget
    join public.categories category on category.id = budget.category_id
    left join public.transactions transaction
      on transaction.household_id = budget.household_id
      and transaction.category_id = budget.category_id
      and transaction.type = 'expense'
      and transaction.status = 'confirmed'
      and transaction.occurred_on >= month_start
      and transaction.occurred_on < next_month
    where budget.household_id = target_household_id
      and budget.reference_month = month_start
    group by budget.id, budget.category_id, budget.limit_cents, category.name
  loop
    threshold := case
      when item.spent >= item.limit_cents then 100
      when item.spent * 100 >= item.limit_cents * 90 then 90
      when item.spent * 100 >= item.limit_cents * 70 then 70
      else null
    end;

    if threshold is not null then
      insert into public.notifications (household_id, budget_id, category_id, kind, severity, title, message, link_url, dedupe_key)
      values (
        target_household_id, item.id, item.category_id, 'budget_threshold',
        case when threshold = 100 then 'critical' when threshold = 90 then 'warning' else 'info' end,
        case when threshold = 100 then 'Orçamento ultrapassado' else item.name || ' chegou a ' || threshold || '%' end,
        'Foram gastos R$ ' || round(item.spent / 100.0, 2) || ' de R$ ' || round(item.limit_cents / 100.0, 2) || ' em ' || item.name || '.',
        '/dashboard/orcamentos',
        'budget:' || item.id || ':' || to_char(month_start, 'YYYY-MM') || ':threshold:' || threshold
      ) on conflict (household_id, dedupe_key) do nothing;
      get diagnostics affected = row_count;
      inserted_count := inserted_count + affected;
    end if;

    projected := round((item.spent::numeric / greatest(elapsed_days, 1)) * days_in_month)::bigint;
    if elapsed_days >= 5 and item.spent < item.limit_cents and projected > item.limit_cents * 1.1 then
      insert into public.notifications (household_id, budget_id, category_id, kind, severity, title, message, link_url, dedupe_key)
      values (
        target_household_id, item.id, item.category_id, 'budget_projection', 'warning',
        'Ritmo alto em ' || item.name,
        'No ritmo atual, a categoria pode chegar a R$ ' || round(projected / 100.0, 2) || ' até o fim do mês.',
        '/dashboard/orcamentos',
        'budget:' || item.id || ':' || to_char(month_start, 'YYYY-MM') || ':projection'
      ) on conflict (household_id, dedupe_key) do nothing;
      get diagnostics affected = row_count;
      inserted_count := inserted_count + affected;
    end if;
  end loop;
  return inserted_count;
end;
$$;

revoke all on function public.evaluate_budget_alerts(uuid) from public, anon;
grant execute on function public.evaluate_budget_alerts(uuid) to authenticated, service_role;
