import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { getAuthenticatedContext } from "@/lib/household";
import { detectRecurringTransactions } from "@/lib/finance/recurring";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR");

function relatedName(value: { name: string } | { name: string }[] | null) {
  return Array.isArray(value) ? value[0]?.name : value?.name;
}

export default async function RecurringPage() {
  const { supabase, membership } = await getAuthenticatedContext();
  const householdId = membership?.household_id;
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 190);
  const { data: rows } = householdId
    ? await supabase.from("transactions")
        .select("id, description, amount_cents, occurred_on, account_id, credit_card_id, categories(name)")
        .eq("household_id", householdId).eq("type", "expense").eq("status", "confirmed")
        .gte("occurred_on", since.toISOString().slice(0, 10)).order("occurred_on").limit(2500)
    : { data: [] };

  const recurring = detectRecurringTransactions((rows ?? []).map((row) => ({
    id: row.id,
    description: row.description,
    amount_cents: row.amount_cents,
    occurred_on: row.occurred_on,
    category: relatedName(row.categories) || "Sem categoria",
    sourceId: row.account_id || row.credit_card_id || "unknown",
  })));
  const monthlyTotal = recurring.reduce((sum, item) => sum + item.monthlyCents, 0);
  const annualTotal = recurring.reduce((sum, item) => sum + item.annualCents, 0);

  return (
    <DashboardShell active="overview">
      <section className="content settings-content recurring-content">
        <header><div><p className="eyebrow">ANÁLISE</p><h1>Gastos recorrentes</h1><p className="muted">Padrões encontrados nos últimos seis meses.</p></div><Link className="secondary-link" href="/dashboard/projecoes">← Projeção</Link></header>

        <section className="recurring-summary"><article><span>Padrões encontrados</span><strong>{recurring.length}</strong></article><article><span>Impacto mensal estimado</span><strong>{money.format(monthlyTotal / 100)}</strong></article><article><span>Impacto anual estimado</span><strong>{money.format(annualTotal / 100)}</strong></article></section>

        {!recurring.length && <article className="card empty-state recurring-empty"><span>≈</span><h2>Ainda não há histórico suficiente</h2><p className="muted">São necessárias ao menos três ocorrências semelhantes para identificar um padrão mensal.</p></article>}
        <section className="recurring-list">
          {recurring.map((item) => <article className="clean-panel recurring-item" key={item.id}><div className="recurring-main"><span className="recurring-mark">↻</span><div><strong>{item.description}</strong><small>{item.category} · {item.cadence === "monthly" ? "Mensal" : "Semanal"}</small></div></div><div className="recurring-value"><strong>{money.format(item.monthlyCents / 100)}</strong><small>estimados por mês</small></div><div className="recurring-details"><span>{item.occurrences} ocorrências</span><span>Última em {date.format(new Date(`${item.lastDate}T12:00:00`))}</span><span>{item.confidence}% de confiança</span></div><div className="confidence-track"><span style={{ width: `${item.confidence}%` }} /></div></article>)}
        </section>

        {!!recurring.length && <aside className="recurring-note"><strong>Como calculamos?</strong><p>Comparamos descrições, intervalos entre compras e variação de valores. O resultado é uma estimativa e pode incluir contas recorrentes que não são assinaturas.</p></aside>}
      </section>
    </DashboardShell>
  );
}
