import { DashboardShell } from "@/components/dashboard-shell";
import { getAuthenticatedContext } from "@/lib/household";

function relatedProfile(value: { display_name: string | null; email: string | null } | { display_name: string | null; email: string | null }[] | null) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PrivacyPage() {
  const { supabase, membership, user } = await getAuthenticatedContext();
  const householdId = membership?.household_id;
  const [{ data: members }, { data: connections }, { count: transactionCount }] = householdId ? await Promise.all([
    supabase.from("household_members").select("user_id, role, joined_at, profiles(display_name, email)").eq("household_id", householdId).order("joined_at"),
    supabase.from("pluggy_items").select("id, connector_name, status, connected_by, last_synced_at").eq("household_id", householdId).order("created_at"),
    supabase.from("transactions").select("id", { count: "exact", head: true }).eq("household_id", householdId),
  ]) : [{ data: [] }, { data: [] }, { count: 0 }];

  return <DashboardShell active="privacy"><section className="content settings-content privacy-content">
    <header><div><p className="eyebrow">DADOS E PRIVACIDADE</p><h1>Seus dados, sob controle.</h1><p className="muted">Consulte acessos, integrações e baixe uma cópia das informações da família.</p></div></header>
    <section className="privacy-export-grid">
      <article className="card privacy-export-card"><span>CSV</span><div><h2>Transações</h2><p className="muted">Planilha compatível com Excel e Google Sheets, contendo {transactionCount ?? 0} lançamentos.</p></div><a className="primary-link" href="/api/export/transactions">Baixar CSV</a></article>
      <article className="card privacy-export-card"><span>JSON</span><div><h2>Pacote completo</h2><p className="muted">Contas, cartões, categorias, transações, orçamentos, metas, regras e investimentos.</p></div><a className="secondary-link" href="/api/export/household">Baixar dados</a></article>
    </section>
    <div className="privacy-grid">
      <section className="items-column"><div className="section-heading"><h2>Pessoas com acesso</h2><span className="count-badge">{members?.length ?? 0}</span></div>{members?.map((member) => { const profile = relatedProfile(member.profiles); const name = profile?.display_name || profile?.email?.split("@")[0] || "Membro"; return <article className="card privacy-row" key={member.user_id}><span className="member-avatar">{name.slice(0, 1).toUpperCase()}</span><div><strong>{name}{member.user_id === user.id ? " · Você" : ""}</strong><small>{profile?.email}</small></div><span className="member-role">{member.role === "owner" ? "Responsável" : member.role === "admin" ? "Administrador" : "Membro"}</span></article>; })}</section>
      <section className="items-column"><div className="section-heading"><h2>Integrações bancárias</h2><span className="count-badge">{connections?.length ?? 0}</span></div>{!connections?.length && <article className="card privacy-empty"><strong>Nenhuma integração conectada</strong><small>As contas manuais continuam disponíveis normalmente.</small></article>}{connections?.map((connection) => <article className="card privacy-row" key={connection.id}><span className="integration-mark">↻</span><div><strong>{connection.connector_name}</strong><small>{connection.last_synced_at ? `Última importação em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(connection.last_synced_at))}` : "Ainda não sincronizada"}</small></div><span className={`sync-status ${connection.status === "UPDATED" ? "success" : "working"}`}>{connection.connected_by === user.id ? "Sua conexão" : "Familiar"}</span></article>)}</section>
    </div>
    <article className="privacy-note"><strong>Privacidade por padrão</strong><p>As exportações são geradas somente após validar sua sessão e o espaço familiar atual. Dados financeiros não são armazenados em cache pelo navegador ou pelo PWA.</p></article>
  </section></DashboardShell>;
}
