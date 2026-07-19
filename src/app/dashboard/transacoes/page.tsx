import { DashboardShell } from "@/components/dashboard-shell";
import { getAuthenticatedContext } from "@/lib/household";
import { addTransaction } from "../finance-actions";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR");
type PageProps = { searchParams: Promise<{ error?: string; success?: string }> };

export default async function TransactionsPage({ searchParams }: PageProps) {
  const { supabase, membership } = await getAuthenticatedContext();
  const params = await searchParams;
  const householdId = membership?.household_id;
  const [{ data: transactions }, { data: categories }, { data: accounts }, { data: cards }] = householdId
    ? await Promise.all([
        supabase.from("transactions").select("*, categories(name), accounts(name), credit_cards(name)").eq("household_id", householdId).order("occurred_on", { ascending: false }).limit(50),
        supabase.from("categories").select("id, name, kind").eq("household_id", householdId).eq("is_active", true).order("name"),
        supabase.from("accounts").select("id, name").eq("household_id", householdId).eq("is_active", true).order("name"),
        supabase.from("credit_cards").select("id, name").eq("household_id", householdId).eq("is_active", true).order("name"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  return (
    <DashboardShell active="transactions">
      <section className="content settings-content">
        <header><div><p className="eyebrow">MOVIMENTAÇÕES</p><h1>Transações</h1><p className="muted">Registre receitas, despesas e compras no cartão.</p></div></header>
        {params.error && <p className="form-message error">{params.error}</p>}{params.success && <p className="form-message success">{params.success}</p>}
        <div className="settings-grid transaction-settings-grid">
          <article className="card form-card"><h2>Novo lançamento</h2><p className="muted">As categorias disponíveis devem ter o mesmo tipo do lançamento.</p>
            <form action={addTransaction}>
              <label>Descrição<input name="description" placeholder="Ex.: Compra do mês" required /></label>
              <div className="form-row"><label>Tipo<select name="type" defaultValue="expense"><option value="expense">Despesa</option><option value="income">Receita</option></select></label><label>Valor<input name="amount" inputMode="decimal" placeholder="0,00" required /></label></div>
              <label>Data<input name="occurred_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label>
              <label>Conta ou cartão<select name="payment_source" defaultValue="" required><option value="" disabled>Selecione</option>{accounts?.map((account) => <option value={`account:${account.id}`} key={account.id}>Conta · {account.name}</option>)}{cards?.map((card) => <option value={`card:${card.id}`} key={card.id}>Cartão · {card.name}</option>)}</select></label>
              <label>Categoria<select name="category_id" defaultValue=""><option value="">Sem categoria</option>{categories?.map((category) => <option value={category.id} key={category.id}>{category.name} · {category.kind === "income" ? "Receita" : "Despesa"}</option>)}</select></label>
              <label>Observação<textarea name="notes" placeholder="Opcional" rows={3} /></label>
              <button type="submit">Salvar lançamento</button>
            </form>
          </article>
          <section className="items-column"><div className="section-heading"><h2>Movimentações recentes</h2><span className="count-badge">{transactions?.length ?? 0}</span></div>
            {!transactions?.length && <article className="card empty-state"><span>＋</span><h2>Nenhum lançamento</h2><p className="muted">Adicione a primeira movimentação da família.</p></article>}
            <article className="card transaction-table">{transactions?.map((transaction) => <div className="transaction-row" key={transaction.id}><span className={`movement-icon ${transaction.type}`}>{transaction.type === "income" ? "↗" : "↘"}</span><div><strong>{transaction.description}</strong><small>{transaction.categories?.name || "Sem categoria"} · {transaction.accounts?.name || transaction.credit_cards?.name}</small></div><div className="transaction-date">{date.format(new Date(`${transaction.occurred_on}T12:00:00`))}</div><strong className={transaction.type === "income" ? "positive" : "negative"}>{transaction.type === "income" ? "+ " : "− "}{money.format(transaction.amount_cents / 100)}</strong></div>)}</article>
          </section>
        </div>
      </section>
    </DashboardShell>
  );
}
