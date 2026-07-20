import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { getAuthenticatedContext } from "@/lib/household";
import { calculateAvailableBalance } from "@/lib/account-balances";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const monthName = new Intl.DateTimeFormat("pt-BR", { month: "short" });

function monthStart(date: Date, offset = 0) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monthsUntil(target: string, now: Date) {
  const targetDate = new Date(`${target}T12:00:00`);
  return Math.max(1, (targetDate.getFullYear() - now.getFullYear()) * 12 + targetDate.getMonth() - now.getMonth() + 1);
}

export default async function ProjectionsPage() {
  const { supabase, membership } = await getAuthenticatedContext();
  const householdId = membership?.household_id;
  const now = new Date();
  const historyStart = isoDate(monthStart(now, -3));
  const currentMonthStart = isoDate(monthStart(now));

  const [accountsResult, connectedAccountsResult, cashTransactionsResult, historyResult, statementsResult, goalsResult] = householdId
    ? await Promise.all([
        supabase.from("accounts").select("id, initial_balance_cents, current_balance_cents").eq("household_id", householdId).eq("is_active", true),
        supabase.from("pluggy_accounts").select("account_id").eq("household_id", householdId).not("account_id", "is", null),
        supabase.from("transactions").select("account_id, type, amount_cents, transfer_direction").eq("household_id", householdId).not("account_id", "is", null).eq("status", "confirmed"),
        supabase.from("transactions").select("type, amount_cents, occurred_on").eq("household_id", householdId).in("type", ["income", "expense"]).eq("status", "confirmed").gte("occurred_on", historyStart).lt("occurred_on", currentMonthStart),
        supabase.from("card_statements").select("total_cents").eq("household_id", householdId).in("status", ["open", "closed", "overdue"]),
        supabase.from("goals").select("id, name, target_cents, current_cents, target_date, color").eq("household_id", householdId).eq("status", "active").not("target_date", "is", null).order("target_date"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const cashBalance = calculateAvailableBalance(accountsResult.data ?? [], cashTransactionsResult.data ?? [], (connectedAccountsResult.data ?? []).flatMap((mapping) => mapping.account_id ? [mapping.account_id] : []));
  const openStatements = statementsResult.data?.reduce((sum, statement) => sum + statement.total_cents, 0) ?? 0;
  const adjustedBalance = cashBalance - openStatements;

  const history = Array.from({ length: 3 }, (_, index) => {
    const start = monthStart(now, index - 3);
    const key = isoDate(start).slice(0, 7);
    const rows = historyResult.data?.filter((row) => row.occurred_on.startsWith(key)) ?? [];
    return {
      income: rows.filter((row) => row.type === "income").reduce((sum, row) => sum + row.amount_cents, 0),
      expense: rows.filter((row) => row.type === "expense").reduce((sum, row) => sum + row.amount_cents, 0),
    };
  });
  const averageIncome = Math.round(history.reduce((sum, item) => sum + item.income, 0) / 3);
  const averageExpense = Math.round(history.reduce((sum, item) => sum + item.expense, 0) / 3);
  const monthlyNet = averageIncome - averageExpense;
  const projection = Array.from({ length: 6 }, (_, index) => ({
    label: monthName.format(monthStart(now, index)),
    value: adjustedBalance + monthlyNet * (index + 1),
  }));

  const values = [adjustedBalance, ...projection.map((item) => item.value)];
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = Math.max(1, maxValue - minValue);
  const points = projection.map((item, index) => {
    const x = 25 + index * 100;
    const y = 170 - ((item.value - minValue) / range) * 130;
    return { ...item, x, y };
  });
  const pointString = points.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPath = points.length ? `M ${points[0].x} 180 ${points.map((point) => `L ${point.x} ${point.y}`).join(" ")} L ${points.at(-1)?.x} 180 Z` : "";

  return (
    <DashboardShell active="budgets">
      <section className="content settings-content projection-content">
        <header><div><p className="eyebrow">PLANEJAMENTO</p><h1>Projeção</h1><p className="muted">Um cenário estimado a partir do comportamento recente.</p></div><div className="planning-actions"><Link className="secondary-link" href="/dashboard/orcamentos">Orçamentos</Link><Link className="secondary-link" href="/dashboard/metas">Metas</Link><Link className="secondary-link" href="/dashboard/recorrencias">Recorrências</Link></div></header>

        <section className="projection-summary">
          <article><span>Saldo em contas</span><strong>{money.format(cashBalance / 100)}</strong></article>
          <article><span>Faturas pendentes</span><strong className="negative">− {money.format(openStatements / 100)}</strong></article>
          <article><span>Média de entradas</span><strong className="positive">{money.format(averageIncome / 100)}</strong></article>
          <article><span>Média de gastos</span><strong>{money.format(averageExpense / 100)}</strong></article>
        </section>

        <div className="projection-grid">
          <article className="clean-panel projection-chart">
            <div className="card-title"><div><h2>Próximos seis meses</h2><p className="muted">Saldo após faturas e média mensal</p></div><span className={`trend-badge ${monthlyNet >= 0 ? "positive" : "negative"}`}>{monthlyNet >= 0 ? "+" : "−"} {money.format(Math.abs(monthlyNet) / 100)}/mês</span></div>
            <svg viewBox="0 0 550 210" role="img" aria-label="Projeção do saldo para os próximos seis meses">
              {[40, 105, 170].map((y) => <line x1="20" x2="530" y1={y} y2={y} key={y} />)}
              <path className="projection-area" d={areaPath} />
              <polyline points={pointString} />
              {points.map((point) => <circle cx={point.x} cy={point.y} r="5" key={point.label} />)}
            </svg>
            <div className="projection-labels">{points.map((point) => <div key={point.label}><span>{point.label}</span><strong>{money.format(point.value / 100)}</strong></div>)}</div>
          </article>

          <aside className="clean-panel projection-explanation"><span className="assistant-icon">≈</span><h2>{monthlyNet >= 0 ? "Tendência positiva" : "Atenção à tendência"}</h2><p className="muted">{monthlyNet >= 0 ? `Mantendo o ritmo recente, a família preserva cerca de ${money.format(monthlyNet / 100)} por mês.` : `No ritmo recente, os gastos superam as entradas em ${money.format(Math.abs(monthlyNet) / 100)} por mês.`}</p><small>Estimativa, não garantia. Compras futuras e mudanças de renda alteram o resultado.</small></aside>
        </div>

        {!!goalsResult.data?.length && <section className="goal-requirements"><div className="section-heading"><h2>Ritmo necessário para as metas</h2></div>{goalsResult.data.map((goal) => {
          const remaining = Math.max(0, goal.target_cents - goal.current_cents);
          const months = monthsUntil(goal.target_date!, now);
          return <article className="goal-requirement" key={goal.id}><span style={{ background: goal.color }} /><div><strong>{goal.name}</strong><small>{months} {months === 1 ? "mês restante" : "meses restantes"}</small></div><div><strong>{money.format(Math.ceil(remaining / months) / 100)}</strong><small>por mês</small></div></article>;
        })}</section>}
      </section>
    </DashboardShell>
  );
}
