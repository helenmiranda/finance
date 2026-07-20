-- Correção de vencimentos pendentes e cancelamento seguro de séries futuras.

create or replace function public.update_payable_occurrence(
  target_occurrence_id uuid,
  new_due_on date,
  new_amount_cents bigint
)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  occurrence_record public.payable_occurrences%rowtype;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado'; end if;
  if new_due_on is null or new_amount_cents <= 0 then raise exception 'Dados inválidos'; end if;
  select * into occurrence_record from public.payable_occurrences where id = target_occurrence_id for update;
  if occurrence_record.id is null or occurrence_record.status <> 'pending'
    or not public.is_household_member(occurrence_record.household_id) then raise exception 'Vencimento inválido'; end if;
  update public.payable_occurrences set due_on = new_due_on, amount_cents = new_amount_cents where id = occurrence_record.id;
  update public.payable_reconciliation_suggestions
    set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
    where occurrence_id = occurrence_record.id and status = 'pending';
end;
$$;

create or replace function public.cancel_payable_series(target_payable_id uuid)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  payable_record public.payables%rowtype;
  cancelled_count integer;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado'; end if;
  select * into payable_record from public.payables where id = target_payable_id for update;
  if payable_record.id is null or payable_record.status <> 'active'
    or not public.is_household_member(payable_record.household_id) then raise exception 'Série inválida'; end if;
  update public.payable_occurrences set status = 'cancelled'
    where payable_id = payable_record.id and status = 'pending';
  get diagnostics cancelled_count = row_count;
  update public.payables set status = case
    when exists (select 1 from public.payable_occurrences where payable_id = payable_record.id and status = 'paid') then 'completed'
    else 'cancelled' end
    where id = payable_record.id;
  update public.payable_reconciliation_suggestions
    set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
    where occurrence_id in (select id from public.payable_occurrences where payable_id = payable_record.id)
      and status = 'pending';
  return cancelled_count;
end;
$$;

revoke all on function public.update_payable_occurrence(uuid, date, bigint) from public, anon;
revoke all on function public.cancel_payable_series(uuid) from public, anon;
grant execute on function public.update_payable_occurrence(uuid, date, bigint) to authenticated;
grant execute on function public.cancel_payable_series(uuid) to authenticated;
