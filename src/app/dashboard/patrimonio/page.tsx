import { DashboardShell } from "@/components/dashboard-shell";
import { getAuthenticatedContext } from "@/lib/household";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 6 });
const typeLabels: Record<string, string> = {
  FIXED_INCOME: "Renda fixa", MUTUAL_FUND: "Fundos", EQUITY: "Ações e FIIs", ETF: "ETFs",
  SECURITY: "Previdência", COE: "COE", OTHER: "Outros",
};

export default async function WealthPage() {
  const { supabase, membership } = await getAuthenticatedContext();
  const { data: investments } = membership
    ? await supabase.from("investments").select("*").eq("household_id", membership.household_id).neq("status", "TOTAL_WITHDRAWAL").order("net_balance_cents", { ascending: false })
    : { data: [] };
  const rows = investments ?? [];
  const netBalance = rows.reduce((sum, item) => sum + item.net_balance_cents, 0);
  const original = rows.reduce((sum, item) => sum + (item.original_amount_cents ?? item.gross_amount_cents), 0);
  const informedProfit = rows.reduce((sum, item) => sum + (item.profit_cents ?? 0), 0);
  const calculatedProfit = netBalance - original;
  const profit = informedProfit || calculatedProfit;
  const byType = new Map<string, number>();
  rows.forEach((item) => byType.set(item.type, (byType.get(item.type) ?? 0) + item.net_balance_cents));

  return <DashboardShell active="investments"><section className="content settings-content wealth-content">
    <header><div><p className="eyebrow">PATRIMÔNIO</p><h1>Seus ativos</h1><p className="muted">Posição consolidada dos investimentos encontrados pelo Meu Pluggy.</p></div></header>
    <div className="wealth-summary"><article><span>Saldo líquido</span><strong>{money.format(netBalance / 100)}</strong></article><article><span>Valor aplicado</span><strong>{money.format(original / 100)}</strong></article><article><span>Resultado acumulado</span><strong className={profit >= 0 ? "positive" : "negative"}>{money.format(profit / 100)}</strong></article></div>
    {!!byType.size && <div className="wealth-allocation">{[...byType.entries()].sort((a, b) => b[1] - a[1]).map(([type, value]) => <span key={type}><strong>{typeLabels[type] ?? type}</strong><small>{money.format(value / 100)} · {netBalance ? Math.round((value / netBalance) * 100) : 0}%</small></span>)}</div>}
    <div className="section-heading"><h2>Posições</h2><span className="count-badge">{rows.length}</span></div>
    {!rows.length && <article className="card empty-state"><span>↗</span><h2>Nenhum ativo sincronizado</h2><p className="muted">Volte em Contas e sincronize uma conexão que possua investimentos.</p></article>}
    <div className="investment-grid">{rows.map((item) => <article className="card investment-item" key={item.id}><div className="investment-heading"><span>{typeLabels[item.type] ?? item.type}</span><small>{item.subtype?.replaceAll("_", " ")}</small></div><h2>{item.name}</h2><p>{item.code || item.issuer || item.institution_name || "Ativo financeiro"}</p><div className="investment-position"><div><small>Saldo líquido</small><strong>{money.format(item.net_balance_cents / 100)}</strong></div>{item.quantity != null && <div><small>Quantidade</small><strong>{number.format(item.quantity)}</strong></div>}{item.profit_cents != null && <div><small>Resultado</small><strong className={item.profit_cents >= 0 ? "positive" : "negative"}>{money.format(item.profit_cents / 100)}</strong></div>}</div>{item.due_date && <footer>Vencimento: {new Intl.DateTimeFormat("pt-BR").format(new Date(`${item.due_date}T12:00:00`))}</footer>}</article>)}</div>
    <p className="wealth-note">Valores informados pelas instituições e sujeitos à defasagem da última sincronização. Não constituem recomendação de investimento.</p>
  </section></DashboardShell>;
}
