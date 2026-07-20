import { DashboardShell } from "@/components/dashboard-shell";
import { getAuthenticatedContext } from "@/lib/household";
import { addDreamContribution, createDream, deleteDream } from "../finance-actions";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR");
const milestones = [10, 25, 50, 75, 100];
const renderedAt = Date.now();
type PageProps = { searchParams: Promise<{ error?: string; success?: string }> };

function encouragement(progress: number) {
  if (progress >= 100) return "Vocês conseguiram! Hora de celebrar essa conquista.";
  if (progress >= 75) return "A reta final já começou. O sonho está bem perto.";
  if (progress >= 50) return "Mais da metade do caminho já foi construída.";
  if (progress >= 25) return "O sonho ganhou força e já saiu do papel.";
  if (progress > 0) return "Todo aporte transforma intenção em caminho.";
  return "O primeiro aporte é onde o sonho começa a acontecer.";
}

function contributionStreak(contributions: { contributed_on: string }[]) {
  const months = [...new Set(contributions.map((item) => item.contributed_on.slice(0, 7)))].sort().reverse();
  if (!months.length) return 0;
  let streak = 1;
  for (let index = 1; index < months.length; index += 1) {
    const [year, month] = months[index - 1].split("-").map(Number);
    const expected = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
    if (months[index] !== expected) break;
    streak += 1;
  }
  return streak;
}

export default async function DreamsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { supabase, membership } = await getAuthenticatedContext();
  const [dreamsResult, contributionsResult] = membership
    ? await Promise.all([
      supabase.from("dreams").select("*").eq("household_id", membership.household_id).order("status").order("created_at", { ascending: false }),
      supabase.from("dream_contributions").select("id, dream_id, amount_cents, contributed_on, note").eq("household_id", membership.household_id).order("contributed_on", { ascending: false }),
    ])
    : [{ data: [] }, { data: [] }];
  const dreams = dreamsResult.data;
  const contributions = contributionsResult.data;
  const totalSaved = dreams?.reduce((sum, dream) => sum + dream.saved_cents, 0) ?? 0;
  const achieved = dreams?.filter((dream) => dream.status === "achieved").length ?? 0;

  return <DashboardShell active="dreams"><section className="content settings-content dreams-content">
    <header><div><p className="eyebrow">NOSSO PORQUÊ</p><h1>Sonhos</h1><p className="muted">Um lugar para lembrar por que vale a pena poupar.</p></div></header>
    {params.error && <p className="form-message error">{params.error}</p>}{params.success && <p className="form-message success">{params.success}</p>}
    <section className="dream-summary" aria-label="Resumo dos sonhos"><div><span>Guardado para sonhos</span><strong>{money.format(totalSaved / 100)}</strong></div><div><span>Sonhos em movimento</span><strong>{dreams?.filter((dream) => dream.status === "active").length ?? 0}</strong></div><div><span>Conquistas da família</span><strong>{achieved} ✦</strong></div></section>
    <details className="card dream-create"><summary>+ Criar um sonho</summary><form action={createDream}>
      <div className="dream-icon-picker"><label>Um símbolo<input name="emoji" defaultValue="✨" maxLength={12} /></label><label>Cor<input className="color-input" name="color" type="color" defaultValue="#9fe870" /></label></div>
      <label>Qual é o sonho?<input name="title" maxLength={80} placeholder="Ex.: Conhecer o Japão" required /></label>
      <label>Por que ele importa para vocês?<textarea name="why_text" maxLength={280} rows={3} placeholder="A lembrança que queremos construir..." required /></label>
      <div className="dream-form-row"><label>Quanto precisamos?<input name="target" inputMode="decimal" placeholder="20.000,00" required /></label><label>Quando queremos realizar?<input name="target_date" type="date" /></label></div>
      <button type="submit">Começar este sonho</button>
    </form></details>
    {!dreams?.length && <article className="card empty-state dream-empty"><span>☁️</span><h2>O que faz vocês sonharem?</h2><p className="muted">Pode ser uma viagem, uma casa, um curso ou uma experiência juntos.</p></article>}
    <section className="dream-gallery">
      {dreams?.map((dream) => {
        const progress = Math.min(Math.round((dream.saved_cents / dream.target_cents) * 100), 100);
        const remaining = Math.max(dream.target_cents - dream.saved_cents, 0);
        const months = dream.target_date ? Math.max(1, Math.ceil((new Date(`${dream.target_date}T12:00:00`).getTime() - renderedAt) / 2629800000)) : null;
        const dreamContributions = contributions?.filter((item) => item.dream_id === dream.id) ?? [];
        const streak = contributionStreak(dreamContributions);
        const reachedMilestones = milestones.filter((milestone) => progress >= milestone).length;
        const nextMilestone = milestones.find((milestone) => progress < milestone);
        return <article className={`card dream-card ${dream.status}`} key={dream.id} style={{ "--dream-color": dream.color } as React.CSSProperties}>
          <div className="dream-card-top"><span className="dream-emoji">{dream.emoji}</span><div><small>{dream.status === "achieved" ? "SONHO REALIZADO" : dream.target_date ? `PARA ${date.format(new Date(`${dream.target_date}T12:00:00`))}` : "SEM PRESSA, MAS COM PROPÓSITO"}</small><h2>{dream.title}</h2></div><strong>{progress}%</strong></div>
          <blockquote>“{dream.why_text}”</blockquote>
          <div className="dream-progress" aria-label={`${progress}% realizado`}><span style={{ width: `${progress}%` }} /></div>
          <div className="dream-milestones" aria-label="Marcos de progresso">{milestones.map((milestone) => <span className={progress >= milestone ? "reached" : ""} key={milestone}><i />{milestone}%</span>)}</div>
          <div className="dream-achievements"><span>✦ {reachedMilestones} de 5 marcos</span>{streak > 0 && <span>🔥 {streak} {streak === 1 ? "mês com aporte" : "meses seguidos"}</span>}{nextMilestone && <span>Próximo: {nextMilestone}%</span>}</div>
          <div className="dream-values"><div><small>Já guardamos</small><strong>{money.format(dream.saved_cents / 100)}</strong></div><div><small>Falta</small><strong>{money.format(remaining / 100)}</strong></div>{months && remaining > 0 && <div><small>Ritmo sugerido</small><strong>{money.format(remaining / months / 100)}/mês</strong></div>}</div>
          <p className="dream-encouragement">{encouragement(progress)}</p>
          {dream.status !== "achieved" ? <details className="dream-contribution"><summary>+ Guardar para este sonho</summary><form action={addDreamContribution}><input type="hidden" name="dream_id" value={dream.id} /><label>Valor<input name="amount" inputMode="decimal" placeholder="100,00" required /></label><label>Data<input name="contributed_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label><label>Uma lembrança<input name="note" placeholder="Opcional" /></label><button type="submit">Guardar</button></form></details> : <div className="dream-celebration">Conquista desbloqueada 🏆</div>}
          {dreamContributions.length > 0 && <details className="dream-history"><summary>Histórico de aportes <span>{dreamContributions.length}</span></summary><div>{dreamContributions.slice(0, 6).map((contribution) => <article key={contribution.id}><span>↗</span><div><strong>{money.format(contribution.amount_cents / 100)}</strong>{contribution.note && <small>{contribution.note}</small>}</div><time dateTime={contribution.contributed_on}>{date.format(new Date(`${contribution.contributed_on}T12:00:00`))}</time></article>)}</div></details>}
          <form action={deleteDream} className="dream-delete"><input type="hidden" name="dream_id" value={dream.id} /><button className="quiet-danger" type="submit">Remover sonho</button></form>
        </article>;
      })}
    </section>
  </section></DashboardShell>;
}
