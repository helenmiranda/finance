import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { getAuthenticatedContext } from "@/lib/household";
import { addGoalContribution, createGoal, deleteGoal } from "../finance-actions";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR");
type PageProps = { searchParams: Promise<{ error?: string; success?: string }> };

export default async function GoalsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { supabase, membership } = await getAuthenticatedContext();
  const { data: goals } = membership
    ? await supabase.from("goals").select("*").eq("household_id", membership.household_id).order("status").order("target_date", { nullsFirst: false })
    : { data: [] };
  const totalTarget = goals?.reduce((sum, goal) => sum + goal.target_cents, 0) ?? 0;
  const totalSaved = goals?.reduce((sum, goal) => sum + goal.current_cents, 0) ?? 0;

  return (
    <DashboardShell active="budgets">
      <section className="content settings-content goal-content">
        <header><div><p className="eyebrow">PLANEJAMENTO</p><h1>Metas</h1><p className="muted">Transforme os planos da família em progresso visível.</p></div><div className="planning-actions"><Link className="secondary-link" href="/dashboard/orcamentos">Orçamentos</Link><Link className="secondary-link" href="/dashboard/projecoes">Projeção →</Link></div></header>
        {params.error && <p className="form-message error">{params.error}</p>}{params.success && <p className="form-message success">{params.success}</p>}
        <section className="goal-hero"><div><span>Total guardado</span><strong>{money.format(totalSaved / 100)}</strong></div><div><span>Objetivos somados</span><strong>{money.format(totalTarget / 100)}</strong></div><div><span>Progresso geral</span><strong>{totalTarget ? Math.round((totalSaved / totalTarget) * 100) : 0}%</strong></div></section>
        <div className="settings-grid goal-grid">
          <article className="card form-card"><h2>Nova meta</h2><p className="muted">Ex.: reserva de emergência, viagem ou reforma.</p><form action={createGoal}>
            <label>Nome<input name="name" placeholder="Ex.: Viagem em família" required /></label>
            <label>Valor desejado<input name="target" inputMode="decimal" placeholder="10.000,00" required /></label>
            <label>Prazo<input name="target_date" type="date" /></label>
            <label>Descrição<textarea name="description" rows={3} placeholder="Por que essa meta é importante?" /></label>
            <label>Cor<input className="color-input" name="color" type="color" defaultValue="#9fe870" /></label>
            <button type="submit">Criar meta</button>
          </form></article>
          <section className="items-column"><div className="section-heading"><h2>Metas da família</h2><span className="count-badge">{goals?.length ?? 0}</span></div>
            {!goals?.length && <article className="card empty-state"><span>◎</span><h2>Nenhuma meta ainda</h2><p className="muted">Escolham juntos o primeiro objetivo.</p></article>}
            {goals?.map((goal) => {
              const percentage = Math.min(Math.round((goal.current_cents / goal.target_cents) * 100), 100);
              return <article className={`card goal-item ${goal.status}`} key={goal.id}><div className="goal-top"><span className="goal-color" style={{ background: goal.color }} /><div><strong>{goal.name}</strong><small>{goal.target_date ? `Até ${date.format(new Date(`${goal.target_date}T12:00:00`))}` : "Sem prazo definido"}</small></div><span className="goal-percent">{percentage}%</span></div><p>{goal.description}</p><div className="progress-track"><span style={{ width: `${percentage}%`, background: goal.color }} /></div><div className="goal-values"><strong>{money.format(goal.current_cents / 100)}</strong><span>de {money.format(goal.target_cents / 100)}</span></div>{goal.status !== "completed" ? <details className="goal-contribution"><summary>Registrar aporte</summary><form action={addGoalContribution}><input type="hidden" name="goal_id" value={goal.id} /><label>Valor<input name="amount" inputMode="decimal" placeholder="100,00" required /></label><label>Data<input name="contributed_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label><label>Observação<input name="notes" placeholder="Opcional" /></label><button type="submit">Adicionar</button></form></details> : <div className="goal-complete">Meta alcançada ✦</div>}<form action={deleteGoal} className="goal-delete"><input type="hidden" name="goal_id" value={goal.id} /><button className="quiet-danger" type="submit">Remover meta</button></form></article>;
            })}
          </section>
        </div>
      </section>
    </DashboardShell>
  );
}
