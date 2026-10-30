import { DashboardShell } from "@/components/dashboard-shell";
import { getAuthenticatedContext } from "@/lib/household";
import { addCategorizationRule, addInternalCounterparty, deleteCategorizationRule, deleteInternalCounterparty } from "../finance-actions";

type PageProps = { searchParams: Promise<{ error?: string; success?: string }> };
const appliesLabels: Record<string, string> = { both: "entradas e saídas", in: "só entradas", out: "só saídas" };
const matchLabels: Record<string, string> = { contains: "contém", starts_with: "começa com", exact: "é exatamente" };

export default async function RulesPage({ searchParams }: PageProps) {
  const { supabase, membership } = await getAuthenticatedContext();
  const params = await searchParams;
  const householdId = membership?.household_id;
  const [{ data: categories }, { data: rules }, { data: family }] = householdId
    ? await Promise.all([
        supabase.from("categories").select("id, name, kind").eq("household_id", householdId).eq("is_active", true).order("name"),
        supabase.from("categorization_rules").select("*, categories(name, color, icon)").eq("household_id", householdId).order("priority", { ascending: false }),
        supabase.from("internal_counterparties").select("id, name, pattern, applies_to").eq("household_id", householdId).order("name"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  return (
    <DashboardShell active="categories">
      <section className="content settings-content">
        <header><div><p className="eyebrow">AUTOMAÇÃO</p><h1>Regras de categoria</h1><p className="muted">Ensine o Poupemos a organizar os próximos extratos.</p></div></header>
        {params.error && <p className="form-message error">{params.error}</p>}{params.success && <p className="form-message success">{params.success}</p>}
        <div className="settings-grid">
          <article className="card form-card"><h2>Nova regra</h2><p className="muted">Regras com maior prioridade são aplicadas primeiro.</p><form action={addCategorizationRule}>
            <label>Nome<input name="name" placeholder="Ex.: Corridas de aplicativo" required /></label>
            <label>Quando a descrição<select name="match_type" defaultValue="contains"><option value="contains">Contém</option><option value="starts_with">Começa com</option><option value="exact">É exatamente</option></select></label>
            <label>Texto procurado<input name="pattern" placeholder="Ex.: UBER" required /></label>
            <label>Definir categoria<select name="category_id" defaultValue="" required><option value="" disabled>Selecione</option>{categories?.map((category) => <option value={category.id} key={category.id}>{category.name} · {category.kind === "income" ? "Receita" : "Despesa"}</option>)}</select></label>
            <label>Prioridade<input name="priority" type="number" min="1" max="1000" defaultValue="100" required /></label>
            <button type="submit">Criar regra</button>
          </form></article>
          <section className="items-column"><div className="section-heading"><h2>Regras ativas</h2><span className="count-badge">{rules?.length ?? 0}</span></div>
            {!rules?.length && <article className="card empty-state"><span>✦</span><h2>Nenhuma regra ainda</h2><p className="muted">Crie regras para acelerar suas importações.</p></article>}
            {rules?.map((rule) => <article className="card rule-item" key={rule.id}><span className="category-icon" style={{ background: rule.categories?.color ?? "#9fe870" }}>{rule.categories?.icon || "→"}</span><div><strong>{rule.name}</strong><small>Descrição {matchLabels[rule.match_type]} “{rule.pattern}”</small><span>{rule.categories?.name} · prioridade {rule.priority}</span></div><form action={deleteCategorizationRule}><input type="hidden" name="rule_id" value={rule.id} /><button type="submit" className="quiet-danger">Remover</button></form></article>)}
          </section>
        </div>
        <header className="rules-subheader"><div><p className="eyebrow">MOVIMENTAÇÕES</p><h2>Pessoas da família fora do app</h2><p className="muted">PIX de ou para quem tem conta que não está conectada (marido, esposa, outra empresa sua) não conta como receita nem despesa.</p></div></header>
        <div className="settings-grid">
          <article className="card form-card"><h2>Nova pessoa</h2><p className="muted">Use o nome como aparece no extrato. Alguns bancos cortam nomes longos, então prefira um trecho curto.</p><form action={addInternalCounterparty}>
            <label>Nome<input name="name" placeholder="Ex.: Ramon (marido)" maxLength={120} required /></label>
            <label>Texto no extrato<input name="pattern" placeholder="Ex.: Ramon Mattos" minLength={2} maxLength={120} required /></label>
            <label>Vale para<select name="applies_to" defaultValue="both"><option value="both">Entradas e saídas</option><option value="in">Só entradas</option><option value="out">Só saídas</option></select></label>
            <button type="submit">Adicionar pessoa</button>
          </form></article>
          <section className="items-column"><div className="section-heading"><h2>Na lista</h2><span className="count-badge">{family?.length ?? 0}</span></div>
            {!family?.length && <article className="card empty-state"><span>⇄</span><h2>Ninguém na lista</h2><p className="muted">Adicione quem manda ou recebe dinheiro da família por contas que o app não vê.</p></article>}
            {family?.map((person) => <article className="card rule-item" key={person.id}><span className="category-icon">⇄</span><div><strong>{person.name}</strong><small>Extrato contém “{person.pattern}”</small><span>{appliesLabels[person.applies_to]}</span></div><form action={deleteInternalCounterparty}><input type="hidden" name="id" value={person.id} /><button type="submit" className="quiet-danger">Remover</button></form></article>)}
          </section>
        </div>
      </section>
    </DashboardShell>
  );
}
