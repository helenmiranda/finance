import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { getAuthenticatedContext } from "@/lib/household";
import { deleteBudget, saveBudget } from "../finance-actions";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
type PageProps = { searchParams: Promise<{ month?: string; error?: string; success?: string }> };

function validMonth(value?: string) {
  return value && /^\d{4}-\d{2}$/.test(value) ? value : new Date().toISOString().slice(0, 7);
}

function shiftMonth(month: string, amount: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1 + amount, 1)).toISOString().slice(0, 7);
}

export default async function BudgetsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const month = validMonth(params.month);
  const referenceMonth = `${month}-01`;
  const nextMonth = shiftMonth(month, 1);
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" })
    .format(new Date(`${referenceMonth}T12:00:00`));
  const { supabase, membership } = await getAuthenticatedContext();
  const householdId = membership?.household_id;

  const [{ data: categories }, { data: budgets }, { data: transactions }] = householdId
    ? await Promise.all([
        supabase.from("categories").select("id, name, color, icon").eq("household_id", householdId).eq("kind", "expense").eq("is_active", true).order("name"),
        supabase.from("budgets").select("*, categories(name, color, icon)").eq("household_id", householdId).eq("reference_month", referenceMonth).order("created_at"),
        supabase.from("transactions").select("category_id, amount_cents").eq("household_id", householdId).eq("type", "expense").eq("status", "confirmed").gte("occurred_on", referenceMonth).lt("occurred_on", `${nextMonth}-01`),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const spentByCategory = new Map<string, number>();
  transactions?.forEach((transaction) => {
    if (transaction.category_id) spentByCategory.set(transaction.category_id, (spentByCategory.get(transaction.category_id) ?? 0) + transaction.amount_cents);
  });
  const totalLimit = budgets?.reduce((sum, budget) => sum + budget.limit_cents, 0) ?? 0;
  const totalSpent = budgets?.reduce((sum, budget) => sum + (spentByCategory.get(budget.category_id) ?? 0), 0) ?? 0;
  const availableCategories = categories?.filter((category) => !budgets?.some((budget) => budget.category_id === category.id)) ?? [];

  return (
    <DashboardShell active="budgets">
      <section className="content settings-content budget-content">
        <header><div><p className="eyebrow">PLANEJAMENTO</p><h1>Orçamentos</h1><p className="muted">Defina limites realistas para cada categoria.</p></div><div className="planning-actions"><Link className="secondary-link" href="/dashboard/metas">Metas →</Link><div className="month-switcher"><Link href={`/dashboard/orcamentos?month=${shiftMonth(month, -1)}`}>←</Link><strong>{monthLabel}</strong><Link href={`/dashboard/orcamentos?month=${nextMonth}`}>→</Link></div></div></header>
        {params.error && <p className="form-message error">{params.error}</p>}{params.success && <p className="form-message success">{params.success}</p>}

        <section className="budget-summary">
          <div><span>Planejado</span><strong>{money.format(totalLimit / 100)}</strong></div>
          <div><span>Utilizado</span><strong>{money.format(totalSpent / 100)}</strong></div>
          <div><span>Disponível</span><strong className={totalLimit - totalSpent < 0 ? "negative" : "positive"}>{money.format((totalLimit - totalSpent) / 100)}</strong></div>
        </section>

        <div className="settings-grid budget-grid">
          <article className="card form-card"><h2>Novo limite</h2><p className="muted">Uma categoria pode ter um limite por mês.</p><form action={saveBudget}>
            <input type="hidden" name="reference_month" value={referenceMonth} />
            <label>Categoria<select name="category_id" defaultValue="" required><option value="" disabled>Selecione</option>{availableCategories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
            <label>Limite mensal<input name="limit" inputMode="decimal" placeholder="500,00" required /></label>
            <button type="submit" disabled={!availableCategories.length}>{availableCategories.length ? "Adicionar orçamento" : "Todas já possuem limite"}</button>
          </form></article>
          <section className="items-column"><div className="section-heading"><h2>Limites do mês</h2><span className="count-badge">{budgets?.length ?? 0}</span></div>
            {!budgets?.length && <article className="card empty-state"><span>◎</span><h2>Nenhum limite definido</h2><p className="muted">Comece pela categoria que mais pesa no mês.</p></article>}
            {budgets?.map((budget) => {
              const spent = spentByCategory.get(budget.category_id) ?? 0;
              const percentage = budget.limit_cents > 0 ? Math.round((spent / budget.limit_cents) * 100) : 0;
              const level = percentage >= 100 ? "over" : percentage >= 80 ? "warning" : "safe";
              return <article className="card budget-item" key={budget.id}><div className="budget-title"><span className="category-icon" style={{ background: budget.categories?.color ?? "#9fe870" }}>{budget.categories?.icon || "◎"}</span><div><strong>{budget.categories?.name}</strong><small>{percentage}% utilizado</small></div><form action={deleteBudget}><input type="hidden" name="budget_id" value={budget.id} /><input type="hidden" name="month" value={month} /><button className="quiet-danger" type="submit">Remover</button></form></div><div className="progress-track"><span className={level} style={{ width: `${Math.min(percentage, 100)}%` }} /></div><div className="budget-values"><span>{money.format(spent / 100)} gastos</span><strong>{money.format(budget.limit_cents / 100)}</strong></div></article>;
            })}
          </section>
        </div>
      </section>
    </DashboardShell>
  );
}
