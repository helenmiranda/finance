import { DashboardShell } from "@/components/dashboard-shell";
import { getAuthenticatedContext } from "@/lib/household";
import { inviteFamilyMember } from "../finance-actions";

type PageProps = { searchParams: Promise<{ error?: string; success?: string }> };

function relatedProfile(value: { display_name: string | null; email: string | null } | { display_name: string | null; email: string | null }[] | null) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function FamilyPage({ searchParams }: PageProps) {
  const messages = await searchParams;
  const { supabase, membership, user } = await getAuthenticatedContext();
  const householdId = membership?.household_id;
  const [{ data: members }, { data: invitations }] = householdId
    ? await Promise.all([
        supabase.from("household_members").select("user_id, role, joined_at, profiles(display_name, email)").eq("household_id", householdId).order("joined_at"),
        supabase.from("household_invitations").select("id, email, role, status, expires_at").eq("household_id", householdId).eq("status", "pending").order("created_at"),
      ])
    : [{ data: [] }, { data: [] }];
  const canInvite = membership?.role === "owner" || membership?.role === "admin";

  return (
    <DashboardShell active="overview">
      <section className="content settings-content family-content">
        <header><div><p className="eyebrow">ESPAÇO COMPARTILHADO</p><h1>Família</h1><p className="muted">Quem pode acessar e organizar as finanças.</p></div></header>
        {messages.error && <p className="form-message error">{messages.error}</p>}{messages.success && <p className="form-message success">{messages.success}</p>}
        <div className="settings-grid family-grid">
          {canInvite && <article className="card form-card"><h2>Adicionar pessoa</h2><p className="muted">Se ela já tiver conta, o acesso será imediato. Caso contrário, deverá se cadastrar com o mesmo e-mail.</p><form action={inviteFamilyMember}>
            <label>E-mail<input name="email" type="email" placeholder="pessoa@exemplo.com" required /></label>
            <label>Permissão<select name="role" defaultValue="member"><option value="member">Membro · pode organizar finanças</option><option value="admin">Administrador · também inclui pessoas</option></select></label>
            <button type="submit">Adicionar à família</button>
          </form></article>}
          <section className="items-column"><div className="section-heading"><h2>Pessoas com acesso</h2><span className="count-badge">{members?.length ?? 0}</span></div>
            {members?.map((member) => {
              const profile = relatedProfile(member.profiles);
              const name = profile?.display_name || profile?.email?.split("@")[0] || "Membro";
              return <article className="card member-item" key={member.user_id}><span className="member-avatar">{name.slice(0, 1).toUpperCase()}</span><div><strong>{name}{member.user_id === user.id ? " · Você" : ""}</strong><small>{profile?.email}</small></div><span className="member-role">{member.role === "owner" ? "Responsável" : member.role === "admin" ? "Administrador" : "Membro"}</span></article>;
            })}
            {!!invitations?.length && <div className="section-heading pending-heading"><h2>Aguardando cadastro</h2></div>}
            {invitations?.map((invitation) => <article className="card member-item pending" key={invitation.id}><span className="member-avatar">?</span><div><strong>{invitation.email}</strong><small>Convite válido até {new Intl.DateTimeFormat("pt-BR").format(new Date(invitation.expires_at))}</small></div><span className="member-role">Pendente</span></article>)}
          </section>
        </div>
      </section>
    </DashboardShell>
  );
}
