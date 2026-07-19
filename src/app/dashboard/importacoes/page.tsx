import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { getAuthenticatedContext } from "@/lib/household";
import { uploadImport } from "./actions";

type PageProps = { searchParams: Promise<{ error?: string }> };

function relatedName(value: { name: string } | { name: string }[] | null) {
  return Array.isArray(value) ? value[0]?.name : value?.name;
}

export default async function ImportsPage({ searchParams }: PageProps) {
  const { supabase, membership } = await getAuthenticatedContext();
  const params = await searchParams;
  const householdId = membership?.household_id;
  const [{ data: accounts }, { data: cards }, { data: imports }] = householdId
    ? await Promise.all([
        supabase.from("accounts").select("id, name").eq("household_id", householdId).eq("is_active", true).order("name"),
        supabase.from("credit_cards").select("id, name").eq("household_id", householdId).eq("is_active", true).order("name"),
        supabase.from("imports").select("id, original_filename, file_format, status, row_count, created_at, accounts(name), credit_cards(name)").eq("household_id", householdId).order("created_at", { ascending: false }).limit(20),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  return (
    <DashboardShell active="imports">
      <section className="content settings-content">
        <header><div><p className="eyebrow">EXTRATOS E FATURAS</p><h1>Importações</h1><p className="muted">Envie um arquivo e revise tudo antes de lançar.</p></div></header>
        {params.error && <p className="form-message error">{params.error}</p>}
        <div className="import-layout">
          <article className="card upload-card"><div className="upload-icon">↑</div><h2>Novo arquivo</h2><p className="muted">CSV ou OFX, com até 5 MB.</p>
            <form action={uploadImport}>
              <label>Conta ou cartão<select name="target" defaultValue="" required><option value="" disabled>Selecione o destino</option>{accounts?.map((account) => <option value={`account:${account.id}`} key={account.id}>Conta · {account.name}</option>)}{cards?.map((card) => <option value={`card:${card.id}`} key={card.id}>Cartão · {card.name}</option>)}</select></label>
              <label className="file-field">Arquivo<input name="file" type="file" accept=".csv,.ofx,text/csv,application/x-ofx" required /></label>
              <button type="submit">Enviar e revisar</button>
            </form>
          </article>
          <section className="items-column"><div className="section-heading"><h2>Histórico</h2><span className="count-badge">{imports?.length ?? 0}</span></div>
            {!imports?.length && <article className="card empty-state"><span>↑</span><h2>Nenhum arquivo enviado</h2><p className="muted">Seus extratos aparecerão aqui.</p></article>}
            {imports?.map((item) => <Link className="card import-item" href={`/dashboard/importacoes/${item.id}`} key={item.id}><span className="file-type">{item.file_format}</span><div><strong>{item.original_filename}</strong><small>{relatedName(item.accounts) || relatedName(item.credit_cards)} · {item.row_count} linhas</small></div><span className={`import-status ${item.status}`}>{item.status === "review" ? "Revisar" : item.status === "failed" ? "Erro" : item.status === "confirmed" ? "Concluído" : "Processando"}</span></Link>)}
          </section>
        </div>
      </section>
    </DashboardShell>
  );
}
