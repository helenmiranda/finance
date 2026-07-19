import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pluggyRequest } from "@/lib/pluggy";

type PluggyAccount = {
  id: string; type: "BANK" | "CREDIT"; subtype?: string; name: string; marketingName?: string | null;
  number?: string | null; balance?: number | null; owner?: string | null;
  creditData?: { creditLimit?: number | null; availableCreditLimit?: number | null; balanceCloseDate?: string | null; balanceDueDate?: string | null } | null;
};

type PluggyTransaction = {
  id: string; description?: string | null; descriptionRaw?: string | null; amount: number; date: string;
  type?: "CREDIT" | "DEBIT"; status?: "POSTED" | "PENDING";
};

type PluggyInvestment = {
  id: string; name: string; code?: string | null; isin?: string | null; owner?: string | null; currencyCode?: string | null;
  type: string; subtype?: string | null; date?: string | null; value?: number | null; quantity?: number | null; amount: number;
  balance: number; amountOriginal?: number | null; amountProfit?: number | null; amountWithdrawal?: number | null;
  taxes?: number | null; taxes2?: number | null; dueDate?: string | null; rate?: number | null; rateType?: string | null;
  fixedAnnualRate?: number | null; issuer?: string | null; status?: string | null; institution?: { name?: string | null } | null;
};

export const maxDuration = 60;

const cents = (value?: number | null) => value == null || !Number.isFinite(value) ? null : Math.round(value * 100);
const day = (value?: string | null) => value ? new Date(`${value.slice(0, 10)}T12:00:00Z`).getUTCDate() : null;
const accountType = (subtype?: string) => subtype === "SAVINGS_ACCOUNT" ? "savings" : subtype === "INVESTMENT_ACCOUNT" ? "investment" : "checking";
const localDate = (value: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));

async function syncTransactions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  remote: PluggyAccount,
  mapping: { id: string; account_id: string | null; credit_card_id: string | null },
  householdId: string,
  userId: string,
) {
  const fromDate = new Date();
  fromDate.setUTCFullYear(fromDate.getUTCFullYear() - 1);
  let path: string | null = `/v2/transactions?accountId=${encodeURIComponent(remote.id)}&dateFrom=${fromDate.toISOString().slice(0, 10)}`;
  let imported = 0;
  let page = 0;
  while (path && page < 12) {
    const response: { results?: PluggyTransaction[]; next?: string | null } = await pluggyRequest(path);
    const rows = (response.results ?? []).filter((transaction) => Number.isFinite(transaction.amount) && transaction.amount !== 0 && (remote.type === "BANK" || transaction.amount > 0));
    const ids = rows.map((transaction) => transaction.id);
    const { data: existing } = ids.length
      ? await supabase.from("pluggy_transactions").select("pluggy_transaction_id").in("pluggy_transaction_id", ids)
      : { data: [] };
    const existingIds = new Set((existing ?? []).map((item) => item.pluggy_transaction_id));
    const pendingRows = rows.filter((transaction) => !existingIds.has(transaction.id));
    if (pendingRows.length) {
      const payload = pendingRows.map((transaction) => ({
        household_id: householdId,
        account_id: remote.type === "BANK" ? mapping.account_id : null,
        credit_card_id: remote.type === "CREDIT" ? mapping.credit_card_id : null,
        created_by: userId,
        type: remote.type === "CREDIT" ? "expense" : transaction.type === "CREDIT" ? "income" : "expense",
        description: transaction.description || transaction.descriptionRaw || "Movimentação Pluggy",
        amount_cents: Math.abs(Math.round(transaction.amount * 100)),
        occurred_on: localDate(transaction.date),
        status: transaction.status === "PENDING" ? "pending" : "confirmed",
        source: "api",
        source_fingerprint: `pluggy:${transaction.id}`,
      }));
      const { data: created, error } = await supabase.from("transactions").insert(payload).select("id, source_fingerprint");
      if (error || !created) throw error ?? new Error("Não foi possível importar as transações.");
      const remoteByFingerprint = new Map(pendingRows.map((transaction) => [`pluggy:${transaction.id}`, transaction.id]));
      const mappings = created.map((transaction) => ({
        household_id: householdId,
        pluggy_account_id: mapping.id,
        pluggy_transaction_id: remoteByFingerprint.get(transaction.source_fingerprint) as string,
        transaction_id: transaction.id,
      }));
      const { error: mappingError } = await supabase.from("pluggy_transactions").insert(mappings);
      if (mappingError) throw mappingError;
      imported += created.length;
    }
    const next = response.next;
    path = next ? next.startsWith("http") ? next.replace("https://api.pluggy.ai", "") : next.startsWith("?") ? `/v2/transactions${next}` : next : null;
    page += 1;
  }
  return imported;
}

async function syncInvestments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  itemId: string,
  connectionId: string,
  householdId: string,
) {
  let page = 1;
  let synced = 0;
  while (page <= 10) {
    const response: { results?: PluggyInvestment[] } = await pluggyRequest(`/investments?itemId=${encodeURIComponent(itemId)}&pageSize=500&page=${page}`);
    const rows = response.results ?? [];
    if (rows.length) {
      const payload = rows.map((investment) => ({
        household_id: householdId,
        item_id: connectionId,
        pluggy_investment_id: investment.id,
        name: investment.name,
        code: investment.code ?? null,
        isin: investment.isin ?? null,
        owner_name: investment.owner ?? null,
        currency_code: investment.currencyCode ?? "BRL",
        type: investment.type,
        subtype: investment.subtype ?? null,
        reference_date: investment.date?.slice(0, 10) ?? null,
        unit_value_cents: cents(investment.value),
        quantity: investment.quantity ?? null,
        gross_amount_cents: cents(investment.amount) ?? 0,
        net_balance_cents: cents(investment.balance) ?? 0,
        original_amount_cents: cents(investment.amountOriginal),
        profit_cents: cents(investment.amountProfit),
        withdrawable_cents: cents(investment.amountWithdrawal),
        income_tax_cents: cents(investment.taxes),
        financial_tax_cents: cents(investment.taxes2),
        due_date: investment.dueDate?.slice(0, 10) ?? null,
        rate: investment.rate ?? null,
        rate_type: investment.rateType ?? null,
        fixed_annual_rate: investment.fixedAnnualRate ?? null,
        issuer: investment.issuer ?? null,
        institution_name: investment.institution?.name ?? null,
        status: investment.status ?? "ACTIVE",
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from("investments").upsert(payload, { onConflict: "pluggy_investment_id" });
      if (error) throw error;
      synced += rows.length;
    }
    if (rows.length < 500) break;
    page += 1;
  }
  return synced;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await request.json().catch(() => null) as { connectionId?: string } | null;
  if (!body?.connectionId) return NextResponse.json({ error: "Conexão inválida." }, { status: 400 });
  const { data: connection } = await supabase.from("pluggy_items").select("id, household_id, pluggy_item_id, connector_name").eq("id", body.connectionId).eq("connected_by", user.id).maybeSingle();
  if (!connection) return NextResponse.json({ error: "Conexão não encontrada para este usuário." }, { status: 404 });

  try {
    const response = await pluggyRequest<{ results?: PluggyAccount[] }>(`/accounts?itemId=${encodeURIComponent(connection.pluggy_item_id)}`);
    const remoteAccounts = response.results ?? [];
    let bankCount = 0;
    let cardCount = 0;
    let transactionCount = 0;

    for (const remote of remoteAccounts) {
      const { data: mapping } = await supabase.from("pluggy_accounts").select("id, account_id, credit_card_id").eq("pluggy_account_id", remote.id).maybeSingle();
      const displayName = remote.marketingName || remote.name;
      if (remote.type === "BANK") {
        let localId = mapping?.account_id ?? null;
        const values = { name: displayName, institution_name: connection.connector_name, type: accountType(remote.subtype), current_balance_cents: cents(remote.balance), is_active: true };
        if (localId) {
          const { error } = await supabase.from("accounts").update(values).eq("id", localId).eq("household_id", connection.household_id);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.from("accounts").insert({ ...values, household_id: connection.household_id, initial_balance_cents: cents(remote.balance) ?? 0, color: "#9fe870" }).select("id").single();
          if (error || !data) throw error ?? new Error("Não foi possível criar a conta.");
          localId = data.id;
        }
        const { error } = await supabase.from("pluggy_accounts").upsert({ household_id: connection.household_id, item_id: connection.id, pluggy_account_id: remote.id, account_id: localId, credit_card_id: null, type: remote.type, subtype: remote.subtype ?? null, name: displayName, number_masked: remote.number ?? null, balance_cents: cents(remote.balance), updated_at: new Date().toISOString() }, { onConflict: "pluggy_account_id" });
        if (error) throw error;
        bankCount += 1;
      } else if (remote.type === "CREDIT") {
        let localId = mapping?.credit_card_id ?? null;
        const lastFour = remote.number?.match(/\d{4}$/)?.[0] ?? null;
        const values = { name: displayName, issuer: connection.connector_name, last_four_digits: lastFour, cardholder_name: remote.owner ?? null, credit_limit_cents: cents(remote.creditData?.creditLimit), available_credit_limit_cents: cents(remote.creditData?.availableCreditLimit), current_balance_cents: cents(remote.balance), closing_day: day(remote.creditData?.balanceCloseDate), due_day: day(remote.creditData?.balanceDueDate), is_active: true };
        if (localId) {
          const { error } = await supabase.from("credit_cards").update(values).eq("id", localId).eq("household_id", connection.household_id);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.from("credit_cards").insert({ ...values, household_id: connection.household_id, color: "#163300" }).select("id").single();
          if (error || !data) throw error ?? new Error("Não foi possível criar o cartão.");
          localId = data.id;
        }
        const { error } = await supabase.from("pluggy_accounts").upsert({ household_id: connection.household_id, item_id: connection.id, pluggy_account_id: remote.id, account_id: null, credit_card_id: localId, type: remote.type, subtype: remote.subtype ?? null, name: displayName, number_masked: remote.number ?? null, balance_cents: cents(remote.balance), updated_at: new Date().toISOString() }, { onConflict: "pluggy_account_id" });
        if (error) throw error;
        cardCount += 1;
      }
      const { data: currentMapping, error: mappingReadError } = await supabase.from("pluggy_accounts").select("id, account_id, credit_card_id").eq("pluggy_account_id", remote.id).single();
      if (mappingReadError || !currentMapping) throw mappingReadError ?? new Error("Mapeamento da conta não encontrado.");
      transactionCount += await syncTransactions(supabase, remote, currentMapping, connection.household_id, user.id);
    }
    const investmentCount = await syncInvestments(supabase, connection.pluggy_item_id, connection.id, connection.household_id);
    await supabase.from("pluggy_items").update({ last_synced_at: new Date().toISOString(), status: "UPDATED", error_code: null }).eq("id", connection.id);
    return NextResponse.json({ success: true, bankCount, cardCount, transactionCount, investmentCount });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível sincronizar as contas." }, { status: 502 });
  }
}
