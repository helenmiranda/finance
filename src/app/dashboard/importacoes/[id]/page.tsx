import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { getAuthenticatedContext } from "@/lib/household";
import { confirmImport, updateImportRow } from "../actions";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
};

export default async function ImportReviewPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const messages = await searchParams;
  const { supabase, membership } = await getAuthenticatedContext();
  if (!membership) notFound();
  const [{ data: importRecord }, { data: rows }, { data: categories }] = await Promise.all([
    supabase.from("imports").select("*").eq("id", id).eq("household_id", membership.household_id).maybeSingle(),
    supabase.from("import_rows").select("*").eq("import_id", id).eq("household_id", membership.household_id).order("row_number").limit(500),
    supabase.from("categories").select("id, name, kind").eq("household_id", membership.household_id).eq("is_active", true).order("name"),
  ]);
  if (!importRecord) notFound();
  const readyCount = rows?.filter((row) => row.review_status === "ready").length ?? 0;
  const pendingCount = rows?.filter((row) => row.review_status === "pending").length ?? 0;
  const ignoredCount = rows?.filter((row) => row.review_status === "ignored").length ?? 0;
  const finished = importRecord.status === "confirmed";

  return (
    <DashboardShell active="imports">
      <section className="content import-review-content">
        <Link className="back-link" href="/dashboard/importacoes">← Importações</Link>
        <header className="review-header"><div><p className="eyebrow">REVISÃO DO ARQUIVO</p><h1>{importRecord.original_filename}</h1><p className="muted">{finished ? "Importação concluída." : "Corrija as linhas necessárias e confirme quando estiver tudo certo."}</p></div>
          {!finished && <form action={confirmImport}><input type="hidden" name="import_id" value={id} /><button type="submit" disabled={pendingCount > 0}>Confirmar importação</button></form>}
        </header>
        {messages.error && <p className="form-message error">{messages.error}</p>}
        {messages.success && <p className="form-message success">{messages.success}</p>}
        {importRecord.status === "failed" && <p className="form-message error">{importRecord.error_message}</p>}
        <div className="review-summary"><span><strong>{importRecord.row_count}</strong> linhas</span><span><strong>{readyCount}</strong> prontas</span><span><strong>{ignoredCount}</strong> ignoradas</span><span className={pendingCount ? "negative" : "positive"}><strong>{pendingCount}</strong> pendentes</span></div>

        <div className="editable-rows">
          {rows?.map((row) => {
            const locked = ["confirmed", "duplicate"].includes(row.review_status) || finished;
            return <form className={`editable-row ${locked ? "locked" : ""}`} action={updateImportRow} key={row.id}>
              <input type="hidden" name="row_id" value={row.id} /><input type="hidden" name="import_id" value={id} />
              <div className="row-number">{row.row_number}</div>
              <label>Data<input name="occurred_on" type="date" defaultValue={row.occurred_on ?? ""} disabled={locked} required /></label>
              <label className="description-field">Descrição<input name="description" defaultValue={row.description ?? ""} disabled={locked} required /></label>
              <label>Tipo<select name="suggested_type" defaultValue={row.suggested_type ?? "expense"} disabled={locked}><option value="expense">Despesa</option><option value="income">Receita</option></select></label>
              <label>Valor<input name="amount" inputMode="decimal" defaultValue={row.amount_cents ? (row.amount_cents / 100).toFixed(2).replace(".", ",") : ""} disabled={locked} required /></label>
              <label>Categoria<select name="category_id" defaultValue={row.category_id ?? ""} disabled={locked}><option value="">Sem categoria</option>{categories?.map((category) => <option value={category.id} key={category.id}>{category.name} · {category.kind === "income" ? "Receita" : "Despesa"}</option>)}</select></label>
              <label>Status<select name="review_status" defaultValue={row.review_status === "ignored" ? "ignored" : "ready"} disabled={locked}><option value="ready">Importar</option><option value="ignored">Ignorar</option></select></label>
              <div className="row-action">{locked ? <span className={`row-status ${row.review_status}`}>{row.review_status === "duplicate" ? "Duplicada" : "Importada"}</span> : <button type="submit">Salvar</button>}</div>
              {row.parse_error && <small className="row-error">{row.parse_error}</small>}
            </form>;
          })}
        </div>
        {!rows?.length && importRecord.status !== "failed" && <div className="simple-empty"><p>Nenhuma linha encontrada.</p></div>}
        {finished && <div className="finished-summary"><strong>{money.format((rows?.filter((row) => row.review_status === "confirmed").reduce((sum, row) => sum + (row.amount_cents ?? 0), 0) ?? 0) / 100)}</strong><span>em movimentações confirmadas</span></div>}
      </section>
    </DashboardShell>
  );
}
