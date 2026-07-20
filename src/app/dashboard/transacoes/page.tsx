import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { getAuthenticatedContext } from "@/lib/household";
import { addTransaction, addTransfer, bulkCategorizeTransactions } from "../finance-actions";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR");
type PageProps = { searchParams: Promise<{ error?: string; success?: string; q?: string; type?: string; category?: string; source?: string; from?: string; to?: string; review?: string }> };

export default async function TransactionsPage({ searchParams }: PageProps) {
  const { supabase, membership } = await getAuthenticatedContext();
  const params = await searchParams;
  const householdId = membership?.household_id;
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
  if (params.from) transactionQuery = transactionQuery.gte("occurred_on", params.from);
  if (params.to) transactionQuery = transactionQuery.lte("occurred_on", params.to);
  if (params.source) {
    const [kind, id] = params.source.split(":");
    if (kind === "account" && id) transactionQuery = transactionQuery.eq("account_id", id);
    if (kind === "card" && id) transactionQuery = transactionQuery.eq("credit_card_id", id);
  }
  const { data: transactions } = await transactionQuery;
  const hasFilters = Boolean(params.q || params.type || params.category || params.source || params.from || params.to || params.review);

  return (
    <DashboardShell active="transactions">
      <section className="content settings-content">
        <header><div><p className="eyebrow">MOVIMENTAÇÕES</p><h1>Transações</h1><p className="muted">Registre, encontre e organize os lançamentos.</p></div>{Boolean(uncategorizedCount) && <Link className="secondary-link" href="/dashboard/transacoes?review=uncategorized">Revisar sem categoria · {uncategorizedCount}</Link>}</header>
        {params.error && <p className="form-message error">{params.error}</p>}{params.success && <p className="form-message success">{params.success}</p>}

        <details className="transaction-create card"><summary>+ Novo lançamento ou transferência</summary><div className="transaction-create-grid">
          <form action={addTransaction}><h2>Novo lançamento</h2><label>Descrição<input name="description" placeholder="Ex.: Compra do mês" required /></label><div className="form-row"><label>Tipo<select name="type" defaultValue="expense"><option value="expense">Despesa</option><option value="income">Receita</option></select></label><label>Valor<input name="amount" inputMode="decimal" placeholder="0,00" required /></label></div><label>Data<input name="occurred_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label><label>Conta ou cartão<select name="payment_source" defaultValue="" required><option value="" disabled>Selecione</option>{accounts?.map((account) => <option value={`account:${account.id}`} key={account.id}>Conta · {account.nickname || account.name}</option>)}{cards?.map((card) => <option value={`card:${card.id}`} key={card.id}>Cartão · {card.nickname || card.name}</option>)}</select></label><label>Categoria<select name="category_id" defaultValue=""><option value="">Sem categoria</option>{categories?.map((category) => <option value={category.id} key={category.id}>{category.name} · {category.kind === "income" ? "Receita" : "Despesa"}</option>)}</select></label><label>Parcelas no cartão<input name="installment_count" type="number" min="1" max="60" defaultValue="1" /></label><label>Observação<textarea name="notes" placeholder="Opcional" rows={2} /></label><button type="submit">Salvar lançamento</button></form>
          <form action={addTransfer}><h2>Transferência</h2><label>Descrição<input name="description" defaultValue="Transferência" required /></label><label>Conta de origem<select name="source_account_id" defaultValue="" required><option value="" disabled>Selecione</option>{accounts?.map((account) => <option value={account.id} key={account.id}>{account.nickname || account.name}</option>)}</select></label><label>Conta de destino<select name="destination_account_id" defaultValue="" required><option value="" disabled>Selecione</option>{accounts?.map((account) => <option value={account.id} key={account.id}>{account.nickname || account.name}</option>)}</select></label><div className="form-row"><label>Valor<input name="amount" inputMode="decimal" placeholder="0,00" required /></label><label>Data<input name="occurred_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label></div><button type="submit">Registrar transferência</button></form>
        </div></details>

        <form className="transaction-filters" method="get"><label className="search-field">Buscar<input name="q" defaultValue={params.q} placeholder="Descrição do lançamento" /></label><label>Tipo<select name="type" defaultValue={params.type ?? ""}><option value="">Todos</option><option value="expense">Despesas</option><option value="income">Receitas</option><option value="transfer">Transferências</option><option value="card_payment">Pagamentos de fatura</option></select></label><label>Categoria<select name="category" defaultValue={params.category ?? ""}><option value="">Todas</option>{categories?.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label><label>Conta ou cartão<select name="source" defaultValue={params.source ?? ""}><option value="">Todos</option>{accounts?.map((account) => <option value={`account:${account.id}`} key={account.id}>Conta · {account.nickname || account.name}</option>)}{cards?.map((card) => <option value={`card:${card.id}`} key={card.id}>Cartão · {card.nickname || card.name}</option>)}</select></label><label>De<input name="from" type="date" defaultValue={params.from} /></label><label>Até<input name="to" type="date" defaultValue={params.to} /></label><button type="submit">Filtrar</button>{hasFilters && <Link href="/dashboard/transacoes">Limpar</Link>}</form>

        <form action={bulkCategorizeTransactions} className="bulk-form">
          <div className="bulk-toolbar"><div><strong>{transactions?.length ?? 0}</strong><span> resultados</span></div><label>Alterar categoria dos selecionados<select name="category_id" defaultValue="" required><option value="" disabled>Selecione</option>{categories?.map((category) => <option value={category.id} key={category.id}>{category.name} · {category.kind === "income" ? "Receita" : "Despesa"}</option>)}</select></label><label className="checkbox-label"><input name="remember_rule" type="checkbox" defaultChecked /> Lembrar descrições</label><button type="submit">Aplicar</button></div>
          {!transactions?.length && <article className="card empty-state"><span>⌕</span><h2>Nenhum lançamento encontrado</h2><p className="muted">Tente remover alguns filtros.</p></article>}
          {!!transactions?.length && <article className="card transaction-table filtered-table">{transactions.map((transaction) => {
            const incoming = transaction.type === "income" || transaction.transfer_direction === "in";
            const installment = transaction.installment_count > 1 ? ` · ${transaction.installment_number}/${transaction.installment_count}` : "";
            const kindLabel = transaction.type === "transfer" ? "Transferência" : transaction.type === "card_payment" ? "Pagamento de fatura" : transaction.categories?.name || "Sem categoria";
            const canSelect = transaction.type === "income" || transaction.type === "expense";
            const sourceName = transaction.accounts?.nickname || transaction.accounts?.name || transaction.credit_cards?.nickname || transaction.credit_cards?.name;
            return <div className="transaction-row filter-row" key={transaction.id}>{canSelect ? <input className="row-checkbox" type="checkbox" name="transaction_ids" value={transaction.id} aria-label={`Selecionar ${transaction.description}`} /> : <span className="checkbox-placeholder" />}<span className={`movement-icon ${transaction.type}`}>{transaction.type === "transfer" ? "⇄" : incoming ? "↗" : "↘"}</span><div><strong>{transaction.description}{installment}</strong><small>{kindLabel} · {sourceName}</small></div><div className="transaction-date">{date.format(new Date(`${transaction.occurred_on}T12:00:00`))}</div><strong className={incoming ? "positive" : "negative"}>{incoming ? "+ " : "− "}{money.format(transaction.amount_cents / 100)}</strong></div>;
          })}</article>}
        </form>
      </section>
    </DashboardShell>
  );
}
