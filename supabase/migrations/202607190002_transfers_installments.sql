-- Operações financeiras atômicas: transferências e compras parceladas.

alter table public.transactions
  add column if not exists transfer_direction text
  check (transfer_direction is null or transfer_direction in ('out', 'in'));

create or replace function public.create_transfer(
  source_account_id uuid,
  destination_account_id uuid,
  transfer_amount_cents bigint,
  transfer_date date,
  transfer_description text default 'Transferência'
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  source_household_id uuid;
  destination_household_id uuid;
  group_id uuid := gen_random_uuid();
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Usuário não autenticado'; end if;
  if source_account_id = destination_account_id then raise exception 'As contas devem ser diferentes'; end if;
  if transfer_amount_cents <= 0 then raise exception 'Valor inválido'; end if;

  select household_id into source_household_id from public.accounts where id = source_account_id and is_active;
  select household_id into destination_household_id from public.accounts where id = destination_account_id and is_active;

  if source_household_id is null or source_household_id <> destination_household_id
    or not public.is_household_member(source_household_id) then
    raise exception 'Contas inválidas';
  end if;

  insert into public.transactions (
    household_id, account_id, created_by, type, description, amount_cents,
    occurred_on, transfer_group_id, transfer_direction
  ) values
  (source_household_id, source_account_id, current_user_id, 'transfer', transfer_description,
   transfer_amount_cents, transfer_date, group_id, 'out'),
  (source_household_id, destination_account_id, current_user_id, 'transfer', transfer_description,
   transfer_amount_cents, transfer_date, group_id, 'in');

  return group_id;
end;
$$;

create or replace function public.create_card_purchase(
  target_card_id uuid,
  target_category_id uuid,
  purchase_description text,
  purchase_amount_cents bigint,
  purchase_date date,
  installment_total integer default 1,
  purchase_notes text default null
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  card_record public.credit_cards%rowtype;
  group_id uuid := gen_random_uuid();
  installment_index integer;
  installment_amount bigint;
  remaining_cents bigint;
  installment_date date;
  reference_date date;
  due_month date;
  calculated_due_date date;
  statement_uuid uuid;
  category_kind text;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado'; end if;
  if installment_total < 1 or installment_total > 60 then raise exception 'Número de parcelas inválido'; end if;
  if purchase_amount_cents <= 0 then raise exception 'Valor inválido'; end if;

  select * into card_record from public.credit_cards where id = target_card_id and is_active;
  if card_record.id is null or not public.is_household_member(card_record.household_id) then
    raise exception 'Cartão inválido';
  end if;

  if target_category_id is not null then
    select kind into category_kind from public.categories
      where id = target_category_id and household_id = card_record.household_id and is_active;
    if category_kind is distinct from 'expense' then raise exception 'Categoria inválida'; end if;
  end if;

  installment_amount := purchase_amount_cents / installment_total;
  remaining_cents := purchase_amount_cents % installment_total;

  for installment_index in 1..installment_total loop
    installment_date := (purchase_date + make_interval(months => installment_index - 1))::date;
    reference_date := date_trunc('month', installment_date)::date;
    if extract(day from installment_date) > card_record.closing_day then
      reference_date := (reference_date + interval '1 month')::date;
    end if;

    due_month := reference_date;
    if card_record.due_day <= card_record.closing_day then
      due_month := (due_month + interval '1 month')::date;
    end if;
    calculated_due_date := due_month + (
      least(
        card_record.due_day,
        extract(day from (date_trunc('month', due_month) + interval '1 month - 1 day'))::integer
      ) - 1
    );

    insert into public.card_statements (
      household_id, credit_card_id, reference_month, closing_date, due_date, total_cents
    ) values (
      card_record.household_id,
      card_record.id,
      reference_date,
      reference_date + (least(card_record.closing_day, extract(day from (reference_date + interval '1 month - 1 day'))::integer) - 1),
      calculated_due_date,
      installment_amount + case when installment_index <= remaining_cents then 1 else 0 end
    )
    on conflict (credit_card_id, reference_month) do update
      set total_cents = public.card_statements.total_cents + excluded.total_cents,
          updated_at = now()
    returning id into statement_uuid;

    insert into public.transactions (
      household_id, credit_card_id, statement_id, category_id, created_by, type,
      description, amount_cents, occurred_on, installment_group_id,
      installment_number, installment_count, notes
    ) values (
      card_record.household_id, card_record.id, statement_uuid, target_category_id, auth.uid(), 'expense',
      purchase_description,
      installment_amount + case when installment_index <= remaining_cents then 1 else 0 end,
      installment_date, group_id, installment_index, installment_total, purchase_notes
    );
  end loop;

  return group_id;
end;
$$;

grant execute on function public.create_transfer(uuid, uuid, bigint, date, text) to authenticated;
grant execute on function public.create_card_purchase(uuid, uuid, text, bigint, date, integer, text) to authenticated;
