import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { TransactionSelectionSummary } from "@/components/transaction-selection-summary";
import { getAuthenticatedContext } from "@/lib/household";
import { addTransaction, addTransfer, bulkCategorizeTransactions, markSelectedTransactionsAsTransfer, updateTransactionDetails } from "../finance-actions";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR");
type PageProps = { searchParams: Promise<{ error?: string; success?: string; q?: string; type?: string; category?: string; source?: string; from?: string; to?: string; review?: string }> };
type TransactionTotals = { income_cents: number | string; expense_cents: number | string; transaction_count: number | string };

function currentMonthInBrazil() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  const year = Number(part("year"));
  const month = Number(part("month"));
  return {
    from: `${year}-${String(month).padStart(2, "0")}-01`,
    to: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10),
  };
}

export default async function TransactionsPage({ searchParams }: PageProps) {
  const { supabase, membership } = await getAuthenticatedContext();
  const params = await searchParams;
  const householdId = membership?.household_id;
  const currentMonth = currentMonthInBrazil();
  const fromDate = params.from || currentMonth.from;
  const toDate = params.to || currentMonth.to;
  const [{ data: categories }, { data: accounts }, { data: cards }, { count: uncategorizedCount }] = householdId
    ? await Promise.all([
        supabase.from("categories").select("id, name, kind").eq("household_id", householdId).eq("is_active", true).order("name"),
        supabase.from("accounts").select("id, name, nickname").eq("household_id", householdId).eq("is_active", true).order("name"),
        supabase.from("credit_cards").select("id, name, nickname").eq("household_id", householdId).eq("is_active", true).order("name"),
        supabase.from("transactions").select("id", { count: "exact", head: true }).eq("household_id", householdId).in("type", ["income", "expense"]).is("category_id", null),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { count: 0 }];

  let transactionQuery = supabase.from("transactions")
    .select("*, categories(name), accounts(name, nickname), credit_cards(name, nickname)")
    .eq("household_id", householdId ?? "00000000-0000-0000-0000-000000000000")
    .order("occurred_on", { ascending: false }).limit(100);
  if (params.q?.trim()) transactionQuery = transactionQuery.ilike("description", `%${params.q.trim()}%`);
  if (params.type && ["income", "expense", "transfer", "card_payment"].includes(params.type)) transactionQuery = transactionQuery.eq("type", params.type);
  if (params.category) transactionQuery = transactionQuery.eq("category_id", params.category);
  if (params.review === "uncategorized") transactionQuery = transactionQuery.in("type", ["income", "expense"]).is("category_id", null);
  transactionQuery = transactionQuery.gte("occurred_on", fromDate).lte("occurred_on", toDate);
  if (params.source) {
    const [kind, id] = params.source.split(":");
    if (kind === "account" && id) transactionQuery = transactionQuery.eq("account_id", id);
    if (kind === "card" && id) transactionQuery = transactionQuery.eq("credit_card_id", id);
  }
  const [sourceKind, sourceId] = params.source?.split(":") ?? [];
  const [{ data: transactions }, { data: totalsData }] = await Promise.all([
    transactionQuery,
    supabase.rpc("transaction_filter_totals", {
      target_household_id: householdId ?? "00000000-0000-0000-0000-000000000000",
      period_from: fromDate,
      period_to: toDate,
      search_query: params.q?.trim() || null,
      target_type: params.type && ["income", "expense", "transfer", "card_payment"].includes(params.type) ? params.type : null,
      target_category_id: params.category || null,
      target_source_kind: sourceKind === "account" || sourceKind === "card" ? sourceKind : null,
      target_source_id: sourceId || null,
      only_uncategorized: params.review === "uncategorized",
    }).maybeSingle(),
  ]);
  const totals = totalsData as TransactionTotals | null;
  const filteredIncome = Number(totals?.income_cents ?? 0);
  const filteredExpense = Number(totals?.expense_cents ?? 0);
  const filteredCount = Number(totals?.transaction_count ?? 0);
  const hasFilters = Boolean(params.q || params.type || params.category || params.source || params.from || params.to || params.review);
  const periodLabel = `${date.format(new Date(`${fromDate}T12:00:00`))} até ${date.format(new Date(`${toDate}T12:00:00`))}`;

  return (
    <DashboardShell active="transactions">
      <section className="content settings-content">
        <header><div><p className="eyebrow">MOVIMENTAÇÕES</p><h1>Transações</h1><p className="muted">Registre, encontre e organize os lançamentos.</p></div>{Boolean(uncategorizedCount) && <Link className="secondary-link" href="/dashboard/transacoes?review=uncategorized">Revisar sem categoria · {uncategorizedCount}</Link>}</header>
        {params.error && <p className="form-message error">{params.error}</p>}{params.success && <p className="form-message success">{params.success}</p>}

        <details className="transaction-create card"><summary>+ Novo lançamento ou transferência</summary><div className="transaction-create-grid">
          <form action={addTransaction}><h2>Novo lançamento</h2><label>Descrição<input name="description" placeholder="Ex.: Compra do mês" required /></label><div className="form-row"><label>Tipo<select name="type" defaultValue="expense"><option value="expense">Despesa</option><option value="income">Receita</option></select></label><label>Valor<input name="amount" inputMode="decimal" placeholder="0,00" required /></label></div><label>Data<input name="occurred_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label><label>Conta ou cartão<select name="payment_source" defaultValue="" required><option value="" disabled>Selecione</option>{accounts?.map((account) => <option value={`account:${account.id}`} key={account.id}>Conta · {account.nickname || account.name}</option>)}{cards?.map((card) => <option value={`card:${card.id}`} key={card.id}>Cartão · {card.nickname || card.name}</option>)}</select></label><label>Categoria<select name="category_id" defaultValue=""><option value="">Sem categoria</option>{categories?.map((category) => <option value={category.id} key={category.id}>{category.name} · {category.kind === "income" ? "Receita" : "Despesa"}</option>)}</select></label><label>Parcelas no cartão<input name="installment_count" type="number" min="1" max="60" defaultValue="1" /></label><label>Observação<textarea name="notes" placeholder="Opcional" rows={2} /></label><button type="submit">Salvar lançamento</button></form>
          <form action={addTransfer}><h2>Transferência</h2><label>Descrição<input name="description" defaultValue="Transferência" required /></label><label>Conta de origem<select name="source_account_id" defaultValue="" required><option value="" disabled>Selecione</option>{accounts?.map((account) => <option value={account.id} key={account.id}>{account.nickname || account.name}</option>)}</select></label><label>Conta de destino<select name="destination_account_id" defaultValue="" required><option value="" disabled>Selecione</option>{accounts?.map((account) => <option value={account.id} key={account.id}>{account.nickname || account.name}</option>)}</select></label><div className="form-row"><label>Valor<input name="amount" inputMode="decimal" placeholder="0,00" required /></label><label>Data<input name="occurred_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label></div><button type="submit">Registrar transferência</button></form>
        </div></details>

        <details className="filter-disclosure" open><summary><span>Filtrar transações</span><small>{hasFilters ? "Filtros ativos" : "Mês atual"}</small></summary><form className="transaction-filters" method="get"><label className="search-field">Buscar<input name="q" defaultValue={params.q} placeholder="Descrição do lançamento" /></label><label>Tipo<select name="type" defaultValue={params.type ?? ""}><option value="">Todos</option><option value="expense">Despesas</option><option value="income">Receitas</option><option value="transfer">Transferências</option><option value="card_payment">Pagamentos de fatura</option></select></label><label>Categoria<select name="category" defaultValue={params.category ?? ""}><option value="">Todas</option>{categories?.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label><label>Conta ou cartão<select name="source" defaultValue={params.source ?? ""}><option value="">Todos</option>{accounts?.map((account) => <option value={`account:${account.id}`} key={account.id}>Conta · {account.nickname || account.name}</option>)}{cards?.map((card) => <option value={`card:${card.id}`} key={card.id}>Cartão · {card.nickname || card.name}</option>)}</select></label><label>De<input name="from" type="date" defaultValue={fromDate} /></label><label>Até<input name="to" type="date" defaultValue={toDate} /></label><button type="submit">Filtrar</button>{hasFilters && <Link href="/dashboard/transacoes">Voltar ao mês atual</Link>}</form></details>

        <section className="transaction-totals" aria-label={`Totais de ${periodLabel}`}><p className="transaction-period">Totais de <strong>{periodLabel}</strong></p>
          <article><small>Entradas</small><strong className="positive">+ {money.format(filteredIncome / 100)}</strong></article>
          <article><small>Saídas</small><strong className="negative">− {money.format(filteredExpense / 100)}</strong></article>
          <article><small>Saldo líquido</small><strong className={filteredIncome - filteredExpense >= 0 ? "positive" : "negative"}>{money.format((filteredIncome - filteredExpense) / 100)}</strong></article>
        </section>

        <form id="bulk-transaction-actions" action={bulkCategorizeTransactions} className="bulk-form">
          <div className="results-heading"><strong>{filteredCount}</strong><span> resultados{filteredCount > 100 ? " · mostrando os 100 mais recentes" : ""}</span></div><TransactionSelectionSummary formId="bulk-transaction-actions" /><details className="bulk-disclosure"><summary>Organizar selecionados</summary><div className="bulk-toolbar"><label>Alterar categoria<select name="category_id" defaultValue=""><option value="" disabled>Selecione</option>{categories?.map((category) => <option value={category.id} key={category.id}>{category.name} · {category.kind === "income" ? "Receita" : "Despesa"}</option>)}</select></label><label className="checkbox-label"><input name="remember_rule" type="checkbox" defaultChecked /> Lembrar descrições</label><button type="submit">Aplicar categoria</button><button type="submit" formAction={markSelectedTransactionsAsTransfer} className="secondary-button">Marcar como transferência</button><small className="transfer-hint">Use categoria em lote para receitas e despesas. Transferências podem receber apelido individual.</small></div></details>
        </form>
        {!transactions?.length && <article className="card empty-state"><span>⌕</span><h2>Nenhum lançamento encontrado</h2><p className="muted">Tente remover alguns filtros.</p></article>}
        {!!transactions?.length && <article className="card transaction-table filtered-table">{transactions.map((transaction) => {
            const incoming = transaction.type === "income" || transaction.transfer_direction === "in";
            const installment = transaction.installment_count > 1 ? ` · ${transaction.installment_number}/${transaction.installment_count}` : "";
            const kindLabel = transaction.type === "transfer" ? "Transferência" : transaction.type === "card_payment" ? "Pagamento de fatura" : transaction.categories?.name || "Sem categoria";
            const canSelect = transaction.type === "income" || transaction.type === "expense" || transaction.type === "transfer";
            const sourceName = transaction.accounts?.nickname || transaction.accounts?.name || transaction.credit_cards?.nickname || transaction.credit_cards?.name;
            const label = transaction.nickname || transaction.description;
            const categoryEditable = transaction.type === "income" || transaction.type === "expense";
            return <div className="transaction-row filter-row" key={transaction.id}>
              {canSelect ? <input className="row-checkbox" type="checkbox" form="bulk-transaction-actions" name="transaction_ids" value={transaction.id} data-signed-cents={incoming ? transaction.amount_cents : -transaction.amount_cents} aria-label={`Selecionar ${label}`} /> : <span className="checkbox-placeholder" />}
              <span className={`movement-icon ${transaction.type}`}>{transaction.type === "transfer" ? "⇄" : incoming ? "↗" : "↘"}</span>
              <div className="transaction-copy"><strong>{label}{installment}</strong><small><span>{kindLabel}</span>{transaction.nickname && <><span aria-hidden="true">·</span><span>{transaction.description}</span></>}{sourceName && <><span aria-hidden="true">·</span><span>{sourceName}</span></>}</small>
                <details className="transaction-editor"><summary>Ajustar</summary><form action={updateTransactionDetails}><input type="hidden" name="transaction_id" value={transaction.id} />{categoryEditable && <label>Categoria<select name="category_id" defaultValue={transaction.category_id ?? ""}><option value="">Sem categoria</option>{categories?.filter((category) => category.kind === transaction.type).map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>}<label>Apelido<input name="nickname" defaultValue={transaction.nickname ?? ""} maxLength={120} placeholder="Opcional" /></label><button type="submit">Salvar</button></form></details>
              </div>
              <div className="transaction-date">{date.format(new Date(`${transaction.occurred_on}T12:00:00`))}</div><strong className={incoming ? "positive" : "negative"}>{incoming ? "+ " : "− "}{money.format(transaction.amount_cents / 100)}</strong>
            </div>;
          })}</article>}
      </section>
    </DashboardShell>
  );
}
