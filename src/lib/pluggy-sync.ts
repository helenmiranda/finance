import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { pluggyRequest } from "@/lib/pluggy";
import { evaluateAndDispatchFinancialAlerts } from "@/lib/financial-alerts";

type PluggyAccount = {
  id: string; type: "BANK" | "CREDIT"; subtype?: string; name: string; marketingName?: string | null;
  number?: string | null; balance?: number | null; owner?: string | null;
  creditData?: { creditLimit?: number | null; availableCreditLimit?: number | null; balanceCloseDate?: string | null; balanceDueDate?: string | null } | null;
};

type PluggyTransaction = {
  id: string; description?: string | null; descriptionRaw?: string | null; amount: number; date: string;
  type?: "CREDIT" | "DEBIT"; status?: "POSTED" | "PENDING"; category?: string | null; categoryId?: string | null;
};

type LocalCategory = { id: string; name: string; kind: "income" | "expense"; parent_id: string | null };
type CategorizationRule = { category_id: string; pattern: string; match_type: "contains" | "starts_with" | "exact"; priority: number };
type CategorizationContext = { categories: LocalCategory[]; rules: CategorizationRule[] };

export type PluggyTransactionEvent = {
  event: "transactions/created" | "transactions/updated" | "transactions/deleted";
  accountId: string;
  transactionIds?: string[];
  transactionsCreatedAtFrom?: string;
};

type PluggyInvestment = {
  id: string; name: string; code?: string | null; isin?: string | null; owner?: string | null; currencyCode?: string | null;
  type: string; subtype?: string | null; date?: string | null; value?: number | null; quantity?: number | null; amount: number;
  balance: number; amountOriginal?: number | null; amountProfit?: number | null; amountWithdrawal?: number | null;
  taxes?: number | null; taxes2?: number | null; dueDate?: string | null; rate?: number | null; rateType?: string | null;
  fixedAnnualRate?: number | null; issuer?: string | null; status?: string | null; institution?: { name?: string | null } | null;
};

export type PluggyConnection = {
  id: string;
  household_id: string;
  pluggy_item_id: string;
  connector_name: string;
  connected_by: string;
};

const cents = (value?: number | null) => value == null || !Number.isFinite(value) ? null : Math.round(value * 100);
const day = (value?: string | null) => value ? new Date(`${value.slice(0, 10)}T12:00:00Z`).getUTCDate() : null;
const accountType = (subtype?: string) => subtype === "SAVINGS_ACCOUNT" ? "savings" : subtype === "INVESTMENT_ACCOUNT" ? "investment" : "checking";
const localDate = (value: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, " ").trim();

const pluggyAliases: Record<string, string[]> = {
  groceries: ["supermercado", "mercado", "alimentacao"],
  "food and drinks": ["alimentacao", "restaurantes"],
  "eating out": ["restaurantes", "alimentacao"],
  "food delivery": ["delivery", "alimentacao"],
  housing: ["moradia", "casa"],
  utilities: ["contas", "moradia"],
  healthcare: ["saude"],
  pharmacy: ["farmacia", "saude"],
  transportation: ["transporte"],
  automotive: ["automovel", "carro", "transporte"],
  shopping: ["compras"],
  leisure: ["lazer"],
  travel: ["viagens", "viagem"],
  education: ["educacao"],
  services: ["servicos"],
  insurance: ["seguros", "seguro"],
  "bank fees": ["tarifas bancarias", "tarifas"],
  salary: ["salario", "receitas"],
  income: ["receitas", "salario"],
};

function categoryFor(transaction: PluggyTransaction, type: "income" | "expense", context: CategorizationContext) {
  const description = normalize(transaction.description || transaction.descriptionRaw || "");
  const categoryIds = new Set(context.categories.filter((category) => category.kind === type).map((category) => category.id));
  const rule = context.rules.find((item) => {
    const pattern = normalize(item.pattern);
    return pattern && categoryIds.has(item.category_id) && (
      (item.match_type === "exact" && description === pattern)
      || (item.match_type === "starts_with" && description.startsWith(pattern))
      || (item.match_type === "contains" && description.includes(pattern))
    );
  });
  if (rule) return rule.category_id;

  const remoteName = normalize(transaction.category ?? "");
  if (!remoteName) return null;
  const candidates = context.categories.filter((category) => category.kind === type);
  const exact = candidates.find((category) => normalize(category.name) === remoteName);
  if (exact) return exact.id;
  const aliases = pluggyAliases[remoteName] ?? [];
  for (const alias of aliases) {
    const match = candidates.find((category) => normalize(category.name) === alias);
    if (match) return match.id;
  }
  return null;
}

async function syncTransactions(
  supabase: SupabaseClient,
  remote: PluggyAccount,
  mapping: { id: string; account_id: string | null; credit_card_id: string | null },
  householdId: string,
  userId: string,
  categorization: CategorizationContext,
  initialPath?: string,
) {
  const fromDate = new Date();
  fromDate.setUTCFullYear(fromDate.getUTCFullYear() - 1);
  let path: string | null = initialPath ?? `/v2/transactions?accountId=${encodeURIComponent(remote.id)}&dateFrom=${fromDate.toISOString().slice(0, 10)}`;
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
      const payload = pendingRows.map((transaction) => {
        const type = remote.type === "CREDIT" ? "expense" : transaction.type === "CREDIT" ? "income" : "expense";
        return {
          household_id: householdId,
          account_id: remote.type === "BANK" ? mapping.account_id : null,
          credit_card_id: remote.type === "CREDIT" ? mapping.credit_card_id : null,
          created_by: userId,
          type,
          category_id: categoryFor(transaction, type, categorization),
          description: transaction.description || transaction.descriptionRaw || "Movimentação Pluggy",
          amount_cents: Math.abs(Math.round(transaction.amount * 100)),
          occurred_on: localDate(transaction.date),
          status: transaction.status === "PENDING" ? "pending" : "confirmed",
          source: "api",
          source_fingerprint: `pluggy:${transaction.id}`,
        };
      });
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
    path = next
      ? next.startsWith("http")
        ? next.replace("https://api.pluggy.ai", "")
        : next.startsWith("?")
          ? `/v2/transactions${next}`
          : next.startsWith("/")
            ? next
            : `/v2/transactions?accountId=${encodeURIComponent(remote.id)}&after=${encodeURIComponent(next)}`
      : null;
    page += 1;
  }
  return imported;
}

async function loadCategorization(supabase: SupabaseClient, householdId: string): Promise<CategorizationContext> {
  const [{ data: categories }, { data: rules }] = await Promise.all([
    supabase.from("categories").select("id, name, kind, parent_id").eq("household_id", householdId).eq("is_active", true),
    supabase.from("categorization_rules").select("category_id, pattern, match_type, priority").eq("household_id", householdId).eq("is_active", true).order("priority", { ascending: false }).order("created_at"),
  ]);
  return { categories: (categories ?? []) as LocalCategory[], rules: (rules ?? []) as CategorizationRule[] };
}

export async function reconcilePluggyTransactions(supabase: SupabaseClient, connection: PluggyConnection, event: PluggyTransactionEvent) {
  const { data: mapping } = await supabase.from("pluggy_accounts")
    .select("id, account_id, credit_card_id, type")
    .eq("item_id", connection.id)
    .eq("pluggy_account_id", event.accountId)
    .maybeSingle();
  if (!mapping) throw new Error("A conta da transação não está vinculada ao Poupemos.");

  const transactionIds = [...new Set((event.transactionIds ?? []).filter(Boolean))].slice(0, 500);
  if (event.event === "transactions/deleted") {
    if (!transactionIds.length) return { created: 0, updated: 0, cancelled: 0 };
    const { data: localMappings, error: mappingError } = await supabase.from("pluggy_transactions")
      .select("transaction_id").eq("household_id", connection.household_id).in("pluggy_transaction_id", transactionIds);
    if (mappingError) throw mappingError;
    const localIds = (localMappings ?? []).map((item) => item.transaction_id);
    if (localIds.length) {
      const { error } = await supabase.from("transactions").update({ status: "cancelled" })
        .eq("household_id", connection.household_id).in("id", localIds);
      if (error) throw error;
    }
    return { created: 0, updated: 0, cancelled: localIds.length };
  }

  const categorization = await loadCategorization(supabase, connection.household_id);
  if (event.event === "transactions/created") {
    const query = new URLSearchParams({ accountId: event.accountId });
    if (event.transactionsCreatedAtFrom) query.set("createdAtFrom", event.transactionsCreatedAtFrom);
    const created = await syncTransactions(
      supabase,
      { id: event.accountId, type: mapping.type as "BANK" | "CREDIT", name: "Conta Pluggy" },
      mapping,
      connection.household_id,
      connection.connected_by,
      categorization,
      `/v2/transactions?${query.toString()}`,
    );
    return { created, updated: 0, cancelled: 0 };
  }

  if (!transactionIds.length) return { created: 0, updated: 0, cancelled: 0 };
  const query = new URLSearchParams({ accountId: event.accountId, ids: transactionIds.join(",") });
  const response = await pluggyRequest<{ results?: PluggyTransaction[] }>(`/v2/transactions?${query.toString()}`);
  const rows = (response.results ?? []).filter((transaction) => Number.isFinite(transaction.amount) && transaction.amount !== 0);
  const updates = rows.map((transaction) => {
    const type = mapping.type === "CREDIT" ? "expense" : transaction.type === "CREDIT" ? "income" : "expense";
    return {
      remote_id: transaction.id,
      type,
      description: transaction.description || transaction.descriptionRaw || "Movimentação Pluggy",
      amount_cents: Math.abs(Math.round(transaction.amount * 100)),
      occurred_on: localDate(transaction.date),
      status: transaction.status === "PENDING" ? "pending" : "confirmed",
      category_id: categoryFor(transaction, type, categorization),
    };
  });
  const { data: updated, error } = await supabase.rpc("reconcile_pluggy_transaction_updates", {
    target_household_id: connection.household_id,
    target_updates: updates,
  });
  if (error) throw error;
  return { created: 0, updated: Number(updated ?? 0), cancelled: 0 };
}

async function syncInvestments(supabase: SupabaseClient, itemId: string, connectionId: string, householdId: string) {
  let page = 1;
  let synced = 0;
  while (page <= 10) {
    const response: { results?: PluggyInvestment[] } = await pluggyRequest(`/investments?itemId=${encodeURIComponent(itemId)}&pageSize=500&page=${page}`);
    const rows = response.results ?? [];
    if (rows.length) {
      const payload = rows.map((investment) => ({
        household_id: householdId, item_id: connectionId, pluggy_investment_id: investment.id,
        name: investment.name, code: investment.code ?? null, isin: investment.isin ?? null,
        owner_name: investment.owner ?? null, currency_code: investment.currencyCode ?? "BRL",
        type: investment.type, subtype: investment.subtype ?? null, reference_date: investment.date?.slice(0, 10) ?? null,
        unit_value_cents: cents(investment.value), quantity: investment.quantity ?? null,
        gross_amount_cents: cents(investment.amount) ?? 0, net_balance_cents: cents(investment.balance) ?? 0,
        original_amount_cents: cents(investment.amountOriginal), profit_cents: cents(investment.amountProfit),
        withdrawable_cents: cents(investment.amountWithdrawal), income_tax_cents: cents(investment.taxes),
        financial_tax_cents: cents(investment.taxes2), due_date: investment.dueDate?.slice(0, 10) ?? null,
        rate: investment.rate ?? null, rate_type: investment.rateType ?? null,
        fixed_annual_rate: investment.fixedAnnualRate ?? null, issuer: investment.issuer ?? null,
        institution_name: investment.institution?.name ?? null, status: investment.status ?? "ACTIVE",
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

export async function syncPluggyConnection(supabase: SupabaseClient, connection: PluggyConnection, options: { includeTransactions?: boolean } = {}) {
  const includeTransactions = options.includeTransactions ?? true;
  const categorization = await loadCategorization(supabase, connection.household_id);
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
      const values = { name: displayName, issuer: connection.connector_name, last_four_digits: lastFour, cardholder_name: remote.owner ?? null, credit_limit_cents: cents(remote.creditData?.creditLimit), available_credit_limit_cents: cents(remote.creditData?.availableCreditLimit), current_balance_cents: cents(remote.balance), closing_day: day(remote.creditData?.balanceCloseDate), due_day: day(remote.creditData?.balanceDueDate) };
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
    if (includeTransactions) {
      transactionCount += await syncTransactions(supabase, remote, currentMapping, connection.household_id, connection.connected_by, categorization);
    }
  }
  const investmentCount = await syncInvestments(supabase, connection.pluggy_item_id, connection.id, connection.household_id);
  await supabase.from("pluggy_items").update({ last_synced_at: new Date().toISOString(), status: "UPDATED", error_code: null }).eq("id", connection.id);
  await evaluateAndDispatchFinancialAlerts(connection.household_id);
  return { success: true, bankCount, cardCount, transactionCount, investmentCount };
}
