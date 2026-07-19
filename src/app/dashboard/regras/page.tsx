import { DashboardShell } from "@/components/dashboard-shell";
import { getAuthenticatedContext } from "@/lib/household";
import { addCategorizationRule, deleteCategorizationRule } from "../finance-actions";

type PageProps = { searchParams: Promise<{ error?: string; success?: string }> };
const matchLabels: Record<string, string> = { contains: "contém", starts_with: "começa com", exact: "é exatamente" };

export default async function RulesPage({ searchParams }: PageProps) {
  const { supabase, membership } = await getAuthenticatedContext();
  const params = await searchParams;
  const householdId = membership?.household_id;
  const [{ data: categories }, { data: rules }] = householdId
    ? await Promise.all([
        supabase.from("categories").select("id, name, kind").eq("household_id", householdId).eq("is_active", true).order("name"),
        supabase.from("categorization_rules").select("*, categories(name, color, icon)").eq("household_id", householdId).order("priority", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }];

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
      </section>
    </DashboardShell>
  );
}
