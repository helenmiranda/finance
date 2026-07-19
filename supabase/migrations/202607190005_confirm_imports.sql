-- Revisão, deduplicação e confirmação atômica das importações.

alter table public.import_rows
  add column if not exists category_id uuid references public.categories(id) on delete set null;

create or replace function public.confirm_import(target_import_id uuid)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  import_record public.imports%rowtype;
  imported_row public.import_rows%rowtype;
  fingerprint text;
  purchase_group_id uuid;
  signature_occurrence integer;
  confirmed_count integer := 0;
  duplicate_count integer := 0;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado'; end if;

  select * into import_record from public.imports where id = target_import_id for update;
  if import_record.id is null or not public.is_household_member(import_record.household_id) then
    raise exception 'Importação inválida';
  end if;
  if import_record.status <> 'review' then raise exception 'Importação não está em revisão'; end if;
  if exists (
    select 1 from public.import_rows
    where import_id = target_import_id and review_status = 'pending'
  ) then
    raise exception 'Ainda existem linhas pendentes de revisão';
  end if;

  for imported_row in
    select * from public.import_rows
    where import_id = target_import_id and review_status = 'ready'
    order by row_number
    for update
  loop
    select count(*) into signature_occurrence
    from public.import_rows previous_row
    where previous_row.import_id = target_import_id
      and previous_row.row_number <= imported_row.row_number
      and previous_row.occurred_on = imported_row.occurred_on
      and lower(trim(previous_row.description)) = lower(trim(imported_row.description))
      and previous_row.amount_cents = imported_row.amount_cents
      and previous_row.suggested_type = imported_row.suggested_type;

    fingerprint := encode(digest(
      concat_ws('|', import_record.household_id, coalesce(import_record.account_id, import_record.credit_card_id),
        imported_row.occurred_on, lower(trim(imported_row.description)), imported_row.amount_cents,
        imported_row.suggested_type, signature_occurrence), 'sha256'), 'hex');

    if exists (
      select 1 from public.transactions
      where household_id = import_record.household_id and source_fingerprint = fingerprint
    ) then
      update public.import_rows set review_status = 'duplicate' where id = imported_row.id;
      duplicate_count := duplicate_count + 1;
      continue;
    end if;

    if import_record.account_id is not null then
      insert into public.transactions (
        household_id, account_id, category_id, created_by, type, description,
        amount_cents, occurred_on, source, source_fingerprint
      ) values (
        import_record.household_id, import_record.account_id, imported_row.category_id,
        auth.uid(), imported_row.suggested_type, imported_row.description,
        imported_row.amount_cents, imported_row.occurred_on, import_record.file_format, fingerprint
      );
    else
      if imported_row.suggested_type <> 'expense' then
        raise exception 'Faturas de cartão só podem importar despesas';
      end if;
      purchase_group_id := public.create_card_purchase(
        import_record.credit_card_id, imported_row.category_id, imported_row.description,
        imported_row.amount_cents, imported_row.occurred_on, 1, 'Importado de ' || import_record.original_filename
      );
      update public.transactions
      set source = import_record.file_format, source_fingerprint = fingerprint
      where installment_group_id = purchase_group_id;
    end if;

    update public.import_rows set review_status = 'confirmed' where id = imported_row.id;
    confirmed_count := confirmed_count + 1;
  end loop;

  update public.imports set status = 'confirmed' where id = target_import_id;
  return jsonb_build_object('confirmed', confirmed_count, 'duplicates', duplicate_count);
end;
$$;

grant execute on function public.confirm_import(uuid) to authenticated;
