import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { getAuthenticatedContext } from "@/lib/household";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR");
type PageProps = { params: Promise<{ id: string }> };

export default async function ImportReviewPage({ params }: PageProps) {
  const { id } = await params;
  const { supabase, membership } = await getAuthenticatedContext();
  if (!membership) notFound();
  const [{ data: importRecord }, { data: rows }] = await Promise.all([
    supabase.from("imports").select("*").eq("id", id).eq("household_id", membership.household_id).maybeSingle(),
    supabase.from("import_rows").select("*").eq("import_id", id).eq("household_id", membership.household_id).order("row_number").limit(500),
  ]);
  if (!importRecord) notFound();
  const readyCount = rows?.filter((row) => row.review_status === "ready").length ?? 0;
  const errorCount = rows?.filter((row) => row.parse_error).length ?? 0;

  return (
    <DashboardShell active="imports">
      <section className="content import-review-content">
        <Link className="back-link" href="/dashboard/importacoes">← Importações</Link>
        <header><div><p className="eyebrow">REVISÃO DO ARQUIVO</p><h1>{importRecord.original_filename}</h1><p className="muted">Confira os dados identificados antes da confirmação.</p></div></header>
        {importRecord.status === "failed" && <p className="form-message error">{importRecord.error_message}</p>}
        <div className="review-summary"><span><strong>{importRecord.row_count}</strong> linhas</span><span><strong>{readyCount}</strong> prontas</span><span className={errorCount ? "negative" : "positive"}><strong>{errorCount}</strong> para revisar</span></div>
        {!!rows?.length && <div className="review-table-wrap"><table className="review-table"><thead><tr><th>Linha</th><th>Data</th><th>Descrição</th><th>Tipo</th><th>Valor</th><th>Status</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.row_number}</td><td>{row.occurred_on ? date.format(new Date(`${row.occurred_on}T12:00:00`)) : "—"}</td><td>{row.description || "—"}</td><td>{row.suggested_type === "income" ? "Receita" : row.suggested_type === "expense" ? "Despesa" : "—"}</td><td className={row.suggested_type === "income" ? "positive" : "negative"}>{row.amount_cents ? money.format(row.amount_cents / 100) : "—"}</td><td><span className={`row-status ${row.parse_error ? "issue" : "ready"}`}>{row.parse_error ? "Revisar" : "Pronta"}</span></td></tr>)}</tbody></table></div>}
      </section>
    </DashboardShell>
  );
}
