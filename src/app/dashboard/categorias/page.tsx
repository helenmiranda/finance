import { DashboardShell } from "@/components/dashboard-shell";
import { getAuthenticatedContext } from "@/lib/household";
import { addCategory } from "../finance-actions";

type PageProps = { searchParams: Promise<{ error?: string; success?: string }> };

export default async function CategoriesPage({ searchParams }: PageProps) {
  const { supabase, membership } = await getAuthenticatedContext();
  const params = await searchParams;
  const { data: categories } = membership
    ? await supabase.from("categories").select("*").eq("household_id", membership.household_id).order("kind").order("name")
    : { data: [] };
  const parents = categories?.filter((category) => !category.parent_id) ?? [];

  return (
    <DashboardShell active="categories">
      <section className="content settings-content">
        <header><div><p className="eyebrow">ORGANIZAÇÃO</p><h1>Categorias</h1><p className="muted">Organize receitas e despesas do jeito da família.</p></div></header>
        {params.error && <p className="form-message error">{params.error}</p>}
        {params.success && <p className="form-message success">{params.success}</p>}
        <div className="settings-grid">
          <article className="card form-card"><h2>Nova categoria</h2><p className="muted">Você também pode criar subcategorias.</p>
            <form action={addCategory}>
              <label>Nome<input name="name" placeholder="Ex.: Supermercado" required /></label>
              <label>Tipo<select name="kind" defaultValue="expense"><option value="expense">Despesa</option><option value="income">Receita</option></select></label>
              <label>Categoria principal<select name="parent_id" defaultValue=""><option value="">Nenhuma</option>{parents.map((category) => <option value={category.id} key={category.id}>{category.name} · {category.kind === "income" ? "Receita" : "Despesa"}</option>)}</select></label>
              <div className="form-row"><label>Ícone<input name="icon" maxLength={4} placeholder="Ex.: 🛒" /></label><label>Cor<input className="color-input" name="color" type="color" defaultValue="#9fe870" /></label></div>
              <button type="submit">Adicionar categoria</button>
            </form>
          </article>
          <section className="items-column"><div className="section-heading"><h2>Categorias cadastradas</h2><span className="count-badge">{categories?.length ?? 0}</span></div>
            {!categories?.length && <article className="card empty-state"><span>＋</span><h2>Nenhuma categoria</h2><p className="muted">Comece pelas despesas mais frequentes.</p></article>}
            <div className="category-grid">{categories?.map((category) => <article className="card category-item" key={category.id}><span className="category-icon" style={{ background: category.color ?? "#9fe870" }}>{category.icon || (category.kind === "income" ? "↗" : "↘")}</span><div><strong>{category.name}</strong><small>{category.kind === "income" ? "Receita" : "Despesa"}{category.parent_id ? " · Subcategoria" : ""}</small></div></article>)}</div>
          </section>
        </div>
      </section>
    </DashboardShell>
  );
}
