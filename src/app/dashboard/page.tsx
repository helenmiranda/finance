import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { getAuthenticatedContext } from "@/lib/household";
import { createHousehold } from "./actions";
import { calculateAvailableBalance } from "@/lib/account-balances";
import { DashboardCharts } from "@/components/dashboard-charts";
import { addDreamContribution } from "./finance-actions";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

function relatedName(value: { name: string; nickname?: string | null } | { name: string; nickname?: string | null }[] | null) {
  const source = Array.isArray(value) ? value[0] : value;
  return source?.nickname || source?.name;
}

function relatedTitle(value: { title: string } | { title: string }[] | null) {
  return Array.isArray(value) ? value[0]?.title : value?.title;
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
  const monthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  const weekEndDate = new Date(today); weekEndDate.setDate(weekEndDate.getDate() + 7);
  const weekEnd = weekEndDate.toISOString().slice(0, 10);
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(today);

  const [accountsResult, connectedAccountsResult, balanceTransactionsResult, monthTransactionsResult, latestAccountsResult, latestCardsResult, statementsResult, dreamsResult, missionsResult, payableOccurrencesResult, upcomingCardResult] = await Promise.all([
    supabase.from("accounts").select("id, initial_balance_cents, current_balance_cents").eq("household_id", householdId).eq("is_active", true),
    supabase.from("pluggy_accounts").select("account_id").eq("household_id", householdId).not("account_id", "is", null),
    supabase.from("transactions").select("type, amount_cents, transfer_direction, account_id").eq("household_id", householdId).eq("status", "confirmed").not("account_id", "is", null),
    supabase.from("transactions").select("occurred_on, type, amount_cents, category_id, categories(name, color)").eq("household_id", householdId).eq("status", "confirmed").gte("occurred_on", monthStart).lt("occurred_on", nextMonth),
    supabase.from("transactions").select("id, description, amount_cents, occurred_on, type, transfer_direction, installment_number, installment_count, categories(name), accounts(name, nickname)").eq("household_id", householdId).not("account_id", "is", null).order("occurred_on", { ascending: false }).limit(4),
    supabase.from("transactions").select("id, description, amount_cents, occurred_on, type, transfer_direction, installment_number, installment_count, categories(name), credit_cards(name, nickname)").eq("household_id", householdId).not("credit_card_id", "is", null).order("occurred_on", { ascending: false }).limit(4),
    supabase.from("card_statements").select("total_cents, due_date").eq("household_id", householdId).in("status", ["open", "closed", "overdue"]),
    supabase.from("dreams").select("id, title, emoji, color, target_cents, saved_cents, target_date").eq("household_id", householdId).eq("status", "active").order("target_date", { nullsFirst: false }).limit(20),
    supabase.from("dream_missions").select("title, ends_on, current_cents, target_cents, dream_id").eq("household_id", householdId).eq("status", "active").gte("ends_on", today.toISOString().slice(0, 10)).order("ends_on").limit(1),
    supabase.from("payable_occurrences").select("id, due_on, amount_cents, payables(title)").eq("household_id", householdId).eq("status", "pending").lte("due_on", monthEnd).order("due_on").limit(300),
    supabase.from("transactions").select("id, occurred_on, amount_cents, description").eq("household_id", householdId).eq("type", "expense").eq("status", "confirmed").not("credit_card_id", "is", null).gt("installment_count", 1).gte("occurred_on", today.toISOString().slice(0, 10)).lte("occurred_on", weekEnd).order("occurred_on").limit(20),
  ]);

  const availableBalance = calculateAvailableBalance(accountsResult.data ?? [], balanceTransactionsResult.data ?? [], (connectedAccountsResult.data ?? []).flatMap((mapping) => mapping.account_id ? [mapping.account_id] : []));
  const monthIncome = monthTransactionsResult.data?.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount_cents, 0) ?? 0;
  const monthExpense = monthTransactionsResult.data?.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount_cents, 0) ?? 0;
  const openStatements = statementsResult.data?.reduce((sum, statement) => sum + statement.total_cents, 0) ?? 0;
  const monthStatements = statementsResult.data?.filter((statement) => statement.due_date >= today.toISOString().slice(0, 10) && statement.due_date <= monthEnd).reduce((sum, statement) => sum + statement.total_cents, 0) ?? 0;
  const monthTransactions = monthTransactionsResult.data ?? [];
  const categoryTotals = new Map<string, { id: string | null; name: string; color: string; amount: number }>();
  for (const transaction of monthTransactions.filter((item) => item.type === "expense")) {
    const category = Array.isArray(transaction.categories) ? transaction.categories[0] : transaction.categories;
    const key = transaction.category_id ?? "uncategorized";
    const current = categoryTotals.get(key) ?? { id: transaction.category_id, name: category?.name ?? "Sem categoria", color: category?.color ?? "#b7bdb4", amount: 0 };
    current.amount += transaction.amount_cents;
    categoryTotals.set(key, current);
  }
  const categoryChart = [...categoryTotals.values()].sort((a, b) => b.amount - a.amount).slice(0, 7);
  const daysInMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)).getUTCDate();
  const dailyChart = Array.from({ length: daysInMonth }, (_, index) => ({ day: index + 1, income: 0, expense: 0 }));
  for (const transaction of monthTransactions) {
    const day = Number(transaction.occurred_on.slice(8, 10));
    if (!dailyChart[day - 1]) continue;
    if (transaction.type === "income") dailyChart[day - 1].income += transaction.amount_cents;
    if (transaction.type === "expense") dailyChart[day - 1].expense += transaction.amount_cents;
  }
  const latestAccounts = latestAccountsResult.data ?? [];
  const latestCards = latestCardsResult.data ?? [];
  const featuredMission = missionsResult.data?.[0];
  const featuredDream = dreamsResult.data?.find((dream) => dream.id === featuredMission?.dream_id) ?? dreamsResult.data?.[0];
  const pendingPayables = payableOccurrencesResult.data ?? [];
  const upcomingPayables = pendingPayables.filter((item) => item.due_on <= weekEnd).slice(0, 5);
  const upcomingCommitmentTotal = upcomingPayables.reduce((sum, item) => sum + item.amount_cents, 0) + (upcomingCardResult.data?.reduce((sum, item) => sum + item.amount_cents, 0) ?? 0);
  const monthPayablesTotal = pendingPayables.filter((item) => item.due_on >= today.toISOString().slice(0, 10)).reduce((sum, item) => sum + item.amount_cents, 0);
  const projectedAvailable = availableBalance - monthPayablesTotal - monthStatements;

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

        <DashboardCharts categories={categoryChart} days={dailyChart} monthLabel={monthLabel} periodFrom={monthStart} periodTo={monthEnd} />

        {(upcomingPayables.length > 0 || upcomingCardResult.data?.length || monthPayablesTotal > 0 || monthStatements > 0) && <section className="clean-panel dashboard-payables"><div><p className="eyebrow">PRÓXIMOS 7 DIAS</p><h2>{money.format(upcomingCommitmentTotal / 100)} comprometidos</h2><p className="muted">{upcomingPayables.length} contas agendadas · {upcomingCardResult.data?.length ?? 0} parcelas no cartão</p><strong className={projectedAvailable < 0 ? "negative" : ""}>Após contas e faturas do mês: {money.format(projectedAvailable / 100)}</strong></div><div>{upcomingPayables.slice(0, 3).map((item) => <span key={item.id}><strong>{relatedTitle(item.payables)}</strong><small>{shortDate.format(new Date(`${item.due_on}T12:00:00`))} · {money.format(item.amount_cents / 100)}</small></span>)}</div><Link href="/dashboard/contas-a-pagar">Abrir agenda →</Link></section>}

        {featuredDream && <section className="clean-panel dashboard-dream" style={{ "--dream-color": featuredDream.color } as React.CSSProperties}><div className="dashboard-dream-main"><span>{featuredDream.emoji}</span><div><p className="eyebrow">SONHO EM MOVIMENTO</p><h2>{featuredDream.title}</h2><p>{money.format(featuredDream.saved_cents / 100)} de {money.format(featuredDream.target_cents / 100)} · {Math.min(Math.round((featuredDream.saved_cents / featuredDream.target_cents) * 100), 100)}%</p></div></div><div className="dashboard-dream-progress"><span style={{ width: `${Math.min((featuredDream.saved_cents / featuredDream.target_cents) * 100, 100)}%` }} /></div>{featuredMission && featuredMission.dream_id === featuredDream.id && <div className="dashboard-mission"><span>⚡ {featuredMission.title}</span><strong>{money.format(featuredMission.current_cents / 100)} de {money.format(featuredMission.target_cents / 100)}</strong></div>}<form action={addDreamContribution}><input type="hidden" name="dream_id" value={featuredDream.id} /><input type="hidden" name="contributed_on" value={today.toISOString().slice(0, 10)} /><input type="hidden" name="return_to" value="/dashboard" /><label><span>Guardar agora</span><input name="amount" inputMode="decimal" placeholder="100,00" required /></label><button type="submit">Aportar</button></form><Link href="/dashboard/sonhos">Ver todos os sonhos →</Link></section>}

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
