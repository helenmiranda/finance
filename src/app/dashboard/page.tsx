import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { getAuthenticatedContext } from "@/lib/household";
import { createHousehold } from "./actions";
import { calculateAvailableBalance } from "@/lib/account-balances";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

function relatedName(value: { name: string; nickname?: string | null } | { name: string; nickname?: string | null }[] | null) {
  const source = Array.isArray(value) ? value[0] : value;
  return source?.nickname || source?.name;
}

type DashboardProps = { searchParams: Promise<{ error?: string }> };

export default async function Dashboard({ searchParams }: DashboardProps) {
  const { supabase, user, membership: household } = await getAuthenticatedContext();
  const params = await searchParams;
  const firstName = String(user.user_metadata.display_name ?? user.email?.split("@")[0] ?? "").split(" ")[0];

  if (!household) {
    return (
      <main className="onboarding-shell">
        <section className="onboarding-card card">
          <span className="brand-mark">P</span><p className="eyebrow">PRIMEIRO PASSO</p>
          <h1>Vamos criar o espaço da família.</h1>
          <p className="muted">Depois você poderá convidar o Ramon e cadastrar contas e cartões.</p>
          {params.error && <p className="form-message error">{params.error}</p>}
          <form action={createHousehold}><label>Nome do espaço<input name="name" defaultValue="Helen & Ramon" required /></label><button type="submit">Criar espaço familiar</button></form>
        </section>
      </main>
    );
  }

  const householdId = household.household_id;
  const today = new Date();
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const nextMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(today);

  const [accountsResult, connectedAccountsResult, balanceTransactionsResult, monthTransactionsResult, latestAccountsResult, latestCardsResult, statementsResult] = await Promise.all([
    supabase.from("accounts").select("id, initial_balance_cents, current_balance_cents").eq("household_id", householdId).eq("is_active", true),
    supabase.from("pluggy_accounts").select("account_id").eq("household_id", householdId).not("account_id", "is", null),
    supabase.from("transactions").select("type, amount_cents, transfer_direction, account_id").eq("household_id", householdId).eq("status", "confirmed").not("account_id", "is", null),
    supabase.from("transactions").select("type, amount_cents").eq("household_id", householdId).eq("status", "confirmed").gte("occurred_on", monthStart).lt("occurred_on", nextMonth),
    supabase.from("transactions").select("id, description, amount_cents, occurred_on, type, transfer_direction, installment_number, installment_count, categories(name), accounts(name, nickname)").eq("household_id", householdId).not("account_id", "is", null).order("occurred_on", { ascending: false }).limit(4),
    supabase.from("transactions").select("id, description, amount_cents, occurred_on, type, transfer_direction, installment_number, installment_count, categories(name), credit_cards(name, nickname)").eq("household_id", householdId).not("credit_card_id", "is", null).order("occurred_on", { ascending: false }).limit(4),
    supabase.from("card_statements").select("total_cents").eq("household_id", householdId).in("status", ["open", "closed", "overdue"]),
  ]);

  const availableBalance = calculateAvailableBalance(accountsResult.data ?? [], balanceTransactionsResult.data ?? [], (connectedAccountsResult.data ?? []).flatMap((mapping) => mapping.account_id ? [mapping.account_id] : []));
  const monthIncome = monthTransactionsResult.data?.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount_cents, 0) ?? 0;
  const monthExpense = monthTransactionsResult.data?.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount_cents, 0) ?? 0;
  const openStatements = statementsResult.data?.reduce((sum, statement) => sum + statement.total_cents, 0) ?? 0;
  const latestAccounts = latestAccountsResult.data ?? [];
  const latestCards = latestCardsResult.data ?? [];

  return (
    <DashboardShell active="overview">
      <section className="content dashboard-content" id="visao-geral">
        <header className="dashboard-header">
          <div><p className="eyebrow">{monthLabel.toUpperCase()}</p><h1>Olá, {firstName}.</h1><p className="muted">Um resumo simples das finanças da família.</p></div>
          <Link className="primary-link" href="/dashboard/transacoes">+ Novo lançamento</Link>
        </header>

        <section className="overview-grid" aria-label="Resumo financeiro">
          <article className="balance-card">
            <div><span>Saldo disponível</span><strong>{money.format(availableBalance / 100)}</strong></div>
            <div className="balance-meta"><span>Entradas no mês</span><strong>+ {money.format(monthIncome / 100)}</strong></div>
          </article>
          <article className="compact-metric"><span>Gastos no mês</span><strong>{money.format(monthExpense / 100)}</strong><small>Inclui contas e cartões</small></article>
          <article className="compact-metric"><span>Faturas em aberto</span><strong>{money.format(openStatements / 100)}</strong><Link href="/dashboard/cartoes">Ver cartões →</Link></article>
        </section>

        <section className="dashboard-lower-grid">
          <article className="clean-panel recent-panel">
            <div className="card-title"><div><h2>Últimas movimentações</h2><p className="muted">Separadas pela origem</p></div><Link href="/dashboard/transacoes">Ver todas</Link></div>
            {!latestAccounts.length && !latestCards.length && <div className="simple-empty"><p>Nenhuma movimentação registrada.</p><Link href="/dashboard/transacoes">Adicionar a primeira</Link></div>}
            <div className="recent-source-grid"><section><h3>Contas</h3><div className="compact-transactions">
              {latestAccounts.map((transaction) => {
                const incoming = transaction.type === "income" || transaction.transfer_direction === "in";
                const installment = transaction.installment_count > 1 ? ` · ${transaction.installment_number}/${transaction.installment_count}` : "";
                const categoryName = relatedName(transaction.categories);
                const sourceName = relatedName(transaction.accounts);
                const kindLabel = transaction.type === "transfer" ? "Transferência" : transaction.type === "card_payment" ? "Pagamento de fatura" : categoryName || "Sem categoria";
                return <div className="compact-transaction" key={transaction.id}><span className={`movement-dot ${incoming ? "in" : "out"}`} /><div><strong>{transaction.description}{installment}</strong><small>{kindLabel} · {sourceName || "—"}</small></div><time>{shortDate.format(new Date(`${transaction.occurred_on}T12:00:00`))}</time><strong className={incoming ? "positive" : "negative"}>{incoming ? "+" : "−"} {money.format(transaction.amount_cents / 100)}</strong></div>;
              })}
              {!latestAccounts.length && <p className="muted recent-empty">Nenhuma movimentação em conta.</p>}
            </div></section><section><h3>Cartões</h3><div className="compact-transactions">
              {latestCards.map((transaction) => {
                const installment = transaction.installment_count > 1 ? ` · ${transaction.installment_number}/${transaction.installment_count}` : "";
                const categoryName = relatedName(transaction.categories);
                const sourceName = relatedName(transaction.credit_cards);
                return <div className="compact-transaction" key={transaction.id}><span className="movement-dot out" /><div><strong>{transaction.description}{installment}</strong><small>{categoryName || "Sem categoria"} · {sourceName || "—"}</small></div><time>{shortDate.format(new Date(`${transaction.occurred_on}T12:00:00`))}</time><strong className="negative">− {money.format(transaction.amount_cents / 100)}</strong></div>;
              })}
              {!latestCards.length && <p className="muted recent-empty">Nenhuma compra no cartão.</p>}
            </div></section></div>
          </article>

          <aside className="clean-panel insight-panel" id="assistente">
            <div className="insight-title"><span className="assistant-icon">✦</span><small>Assistente financeiro</small></div>
            <h2>{monthExpense > monthIncome && monthIncome > 0 ? "Os gastos passaram das entradas." : "Seu mês está organizado."}</h2>
            <p className="muted">{monthExpense > 0 ? `Até agora, a família gastou ${money.format(monthExpense / 100)} neste mês.` : "Adicione movimentações para receber análises personalizadas."}</p>
            <Link href="/dashboard/assistente">Conversar com o assistente →</Link>
          </aside>
        </section>
      </section>
    </DashboardShell>
  );
}
