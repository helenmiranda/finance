import Link from "next/link";

type CategoryDatum = { id: string | null; name: string; color: string; amount: number };
type DailyDatum = { day: number; income: number; expense: number };

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function DashboardCharts({ categories, days, monthLabel }: { categories: CategoryDatum[]; days: DailyDatum[]; monthLabel: string }) {
  const categoryMax = Math.max(...categories.map((item) => item.amount), 1);
  const dailyMax = Math.max(...days.flatMap((item) => [item.income, item.expense]), 1);
  const baseline = 186;
  const usableHeight = 150;
  const groupWidth = 720 / Math.max(days.length, 1);
  const barWidth = Math.max(3, Math.min(8, groupWidth * 0.28));

  return <section className="finance-charts" aria-label={`Gráficos financeiros de ${monthLabel}`}>
    <article className="clean-panel category-chart-card">
      <div className="card-title"><div><h2>Gastos por categoria</h2><p className="muted">Onde o dinheiro saiu neste mês</p></div></div>
      {!categories.length ? <p className="chart-empty">Ainda não há despesas categorizadas neste mês.</p> : <div className="category-bars">
        {categories.map((category) => <Link className="category-bar-row" href={category.id ? `/dashboard/transacoes?category=${encodeURIComponent(category.id)}` : "/dashboard/transacoes?review=uncategorized"} aria-label={`Ver transações de ${category.name}`} key={category.id ?? "uncategorized"}>
          <div><span style={{ background: category.color }} /><strong>{category.name}</strong><small>{money.format(category.amount / 100)}</small></div>
          <div className="category-bar-track"><span style={{ width: `${Math.max(3, category.amount / categoryMax * 100)}%`, background: category.color }} /></div>
        </Link>)}
      </div>}
    </article>

    <article className="clean-panel daily-chart-card">
      <div className="card-title"><div><h2>Entradas e saídas por dia</h2><p className="muted">Movimento diário em {monthLabel}</p></div><div className="chart-legend"><span className="income">Entradas</span><span className="expense">Saídas</span></div></div>
      {!days.some((item) => item.income || item.expense) ? <p className="chart-empty">Ainda não há movimentações neste mês.</p> : <div className="daily-chart-scroll">
        <svg className="daily-chart" viewBox="0 0 720 220" role="img" aria-label={`Comparação diária de entradas e saídas em ${monthLabel}`}>
          {[0, .5, 1].map((ratio) => <line key={ratio} x1="0" x2="720" y1={baseline - usableHeight * ratio} y2={baseline - usableHeight * ratio} className="chart-grid-line" />)}
          {days.map((item, index) => {
            const center = index * groupWidth + groupWidth / 2;
            const incomeHeight = item.income / dailyMax * usableHeight;
            const expenseHeight = item.expense / dailyMax * usableHeight;
            return <g key={item.day}>
              <rect className="daily-income-bar" x={center - barWidth - 1} y={baseline - incomeHeight} width={barWidth} height={incomeHeight || 0} rx="2"><title>Dia {item.day}: entradas de {money.format(item.income / 100)}</title></rect>
              <rect className="daily-expense-bar" x={center + 1} y={baseline - expenseHeight} width={barWidth} height={expenseHeight || 0} rx="2"><title>Dia {item.day}: saídas de {money.format(item.expense / 100)}</title></rect>
              {(item.day === 1 || item.day % 5 === 0 || item.day === days.length) && <text x={center} y="208" textAnchor="middle">{item.day}</text>}
            </g>;
          })}
        </svg>
      </div>}
    </article>
  </section>;
}
