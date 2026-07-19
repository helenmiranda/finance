import { DashboardShell } from "@/components/dashboard-shell";
import { getAuthenticatedContext } from "@/lib/household";
import { AssistantChat } from "./assistant-chat";
import type { AssistantMessage } from "./actions";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function relatedName(value: { name: string } | { name: string }[] | null) {
  return Array.isArray(value) ? value[0]?.name : value?.name;
}

export default async function AssistantPage() {
  const { supabase, membership, user } = await getAuthenticatedContext();
  const householdId = membership?.household_id;
  const today = new Date();
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const previousMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  const nextMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
  const date = (value: Date) => value.toISOString().slice(0, 10);
  const [{ data: conversation }, { data: monthTransactions }, { data: budgets }] = householdId
    ? await Promise.all([
        supabase.from("ai_conversations").select("id").eq("household_id", householdId).eq("created_by", user.id).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("transactions").select("occurred_on, type, amount_cents, category_id, categories(name)").eq("household_id", householdId).eq("status", "confirmed").gte("occurred_on", date(previousMonthStart)).lt("occurred_on", date(nextMonthStart)),
        supabase.from("budgets").select("category_id, limit_cents, categories(name)").eq("household_id", householdId).eq("reference_month", date(monthStart)),
      ])
    : [{ data: null }, { data: [] }, { data: [] }];
  const { data: messages } = conversation
    ? await supabase.from("ai_messages").select("role, content").eq("conversation_id", conversation.id).order("created_at", { ascending: true }).limit(20)
    : { data: [] };
  const initialMessages: AssistantMessage[] = (messages ?? []).map((message) => ({ role: message.role as "user" | "assistant", content: message.content }));
  const currentRows = (monthTransactions ?? []).filter((item) => item.occurred_on >= date(monthStart));
  const previousRows = (monthTransactions ?? []).filter((item) => item.occurred_on < date(monthStart));
  const total = (rows: typeof currentRows, type: "income" | "expense") => rows.filter((item) => item.type === type).reduce((sum, item) => sum + item.amount_cents, 0);
  const income = total(currentRows, "income");
  const expenses = total(currentRows, "expense");
  const previousExpenses = total(previousRows, "expense");
  const expenseChange = previousExpenses ? Math.round(((expenses - previousExpenses) / previousExpenses) * 100) : null;
  const categoryTotals = new Map<string, { name: string; amount: number }>();
  currentRows.filter((item) => item.type === "expense").forEach((item) => {
    const key = item.category_id ?? "uncategorized";
    const current = categoryTotals.get(key) ?? { name: relatedName(item.categories) ?? "Sem categoria", amount: 0 };
    current.amount += item.amount_cents;
    categoryTotals.set(key, current);
  });
  const topCategory = [...categoryTotals.values()].sort((a, b) => b.amount - a.amount)[0];
  const exceededBudgets = (budgets ?? []).map((budget) => ({
    name: relatedName(budget.categories) ?? "Categoria",
    limit: budget.limit_cents,
    spent: categoryTotals.get(budget.category_id)?.amount ?? 0,
  })).filter((budget) => budget.spent > budget.limit).sort((a, b) => (b.spent - b.limit) - (a.spent - a.limit));
  const monthLabel = monthStart.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <DashboardShell active="assistant">
      <section className="content assistant-page-content">
        <header><div><p className="eyebrow">ASSISTENTE FINANCEIRO</p><h1>Converse com seus dados.</h1><p className="muted">Pergunte, compare e encontre oportunidades de economia.</p></div></header>
        <section className="monthly-briefing" aria-label={`Resumo de ${monthLabel}`}>
          <div className="briefing-heading"><div><p className="eyebrow">RESUMO AUTOMÁTICO</p><h2>{monthLabel}</h2></div><span>{currentRows.length} lançamentos</span></div>
          <div className="briefing-metrics">
            <article><span>Entradas</span><strong className="positive">{money.format(income / 100)}</strong></article>
            <article><span>Saídas</span><strong className="negative">{money.format(expenses / 100)}</strong><small>{expenseChange === null ? "Sem histórico para comparar" : `${expenseChange > 0 ? "+" : ""}${expenseChange}% ante o mês anterior`}</small></article>
            <article><span>Saldo do mês</span><strong className={income - expenses >= 0 ? "positive" : "negative"}>{money.format((income - expenses) / 100)}</strong></article>
          </div>
          <div className="briefing-insights">
            {!currentRows.length && <p>Adicione ou importe lançamentos para receber análises deste mês.</p>}
            {topCategory && <p><strong>Maior gasto:</strong> {topCategory.name}, com {money.format(topCategory.amount / 100)}.</p>}
            {expenseChange !== null && Math.abs(expenseChange) >= 10 && <p><strong>{expenseChange > 0 ? "Atenção:" : "Boa evolução:"}</strong> as despesas {expenseChange > 0 ? "subiram" : "caíram"} {Math.abs(expenseChange)}% em relação ao mês anterior.</p>}
            {exceededBudgets[0] && <p><strong>Orçamento excedido:</strong> {exceededBudgets[0].name} passou {money.format((exceededBudgets[0].spent - exceededBudgets[0].limit) / 100)} do limite.</p>}
          </div>
        </section>
        <AssistantChat initialState={{ conversationId: conversation?.id ?? null, messages: initialMessages, error: null }} />
      </section>
    </DashboardShell>
  );
}
