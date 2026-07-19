import { DashboardShell } from "@/components/dashboard-shell";
import { getAuthenticatedContext } from "@/lib/household";
import { addAccount } from "../finance-actions";
import { PluggyConnectButton, PluggySyncButton } from "./pluggy-connect-button";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const accountTypes: Record<string, string> = {
  checking: "Conta corrente", savings: "Poupança", cash: "Dinheiro", investment: "Investimentos", other: "Outra",
};

type PageProps = { searchParams: Promise<{ error?: string; success?: string }> };
type SyncItem = { id: string; connector_name: string; status: string; execution_status: string | null; error_code: string | null; connected_by: string; provider_updated_at: string | null; last_synced_at: string | null; status_detail: unknown };

function statusFor(item: SyncItem) {
  if (item.execution_status === "PARTIAL_SUCCESS") return { label: "Atualização parcial", tone: "warning" };
  if (item.error_code || ["OUTDATED", "LOGIN_ERROR"].includes(item.status)) return { label: "Requer atenção", tone: "error" };
  if (item.status === "UPDATING") return { label: "Atualizando", tone: "working" };
  if (item.status === "UPDATED" || item.execution_status === "SUCCESS") return { label: "Atualizada", tone: "success" };
  return { label: "Aguardando", tone: "working" };
}

const formatted = (value: string | null) => value ? dateTime.format(new Date(value)) : "Ainda não disponível";

export default async function AccountsPage({ searchParams }: PageProps) {
  const { supabase, membership, user } = await getAuthenticatedContext();
  const params = await searchParams;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [{ data: accounts }, { data: pluggyItems }, { data: refreshRuns }, { data: webhookEvents }] = membership ? await Promise.all([
    supabase.from("accounts").select("*").eq("household_id", membership.household_id).order("created_at"),
    supabase.from("pluggy_items").select("id, connector_name, status, execution_status, error_code, connected_by, provider_updated_at, last_synced_at, status_detail").eq("household_id", membership.household_id).order("updated_at", { ascending: false }),
    supabase.from("pluggy_refresh_runs").select("pluggy_item_id, slot, status").eq("reference_date", today),
    supabase.from("pluggy_webhook_events").select("item_id, event_type, status, created_at").order("created_at", { ascending: false }).limit(100),
  ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  return (
    <DashboardShell active="accounts">
      <section className="content settings-content">
        <header><div><p className="eyebrow">CONFIGURAÇÕES</p><h1>Suas contas</h1><p className="muted">Conexões bancárias e contas da família em um só lugar.</p></div></header>
        {params.error && <p className="form-message error">{params.error}</p>}
        {params.success && <p className="form-message success">{params.success}</p>}
        <article className="card bank-connections"><div><p className="eyebrow">MEU PLUGGY</p><h2>Contas conectadas</h2><p className="muted">Vincule o Item ID criado no Meu Pluggy. Cada membro conecta suas próprias instituições.</p></div><PluggyConnectButton />
          {Boolean(pluggyItems?.length) && <div className="sync-center">{(pluggyItems as SyncItem[]).map((item) => {
            const state = statusFor(item);
            const runs = (refreshRuns ?? []).filter((run) => run.pluggy_item_id === item.id && run.status === "triggered");
            const latestEvent = (webhookEvents ?? []).find((event) => event.item_id === item.id);
            return <article className="sync-item" key={item.id}>
              <div className="sync-item-heading"><div><strong>{item.connector_name}</strong><small>{item.connected_by === user.id ? "Sua conexão" : "Conexão familiar"}</small></div><span className={`sync-status ${state.tone}`}>{state.label}</span></div>
              <div className="sync-times"><span><small>Banco atualizado</small><strong>{formatted(item.provider_updated_at)}</strong></span><span><small>Importado no Poupemos</small><strong>{formatted(item.last_synced_at)}</strong></span></div>
              <div className="sync-meta"><span>{runs.length}/3 atualizações bancárias hoje</span><span>{latestEvent ? `Último evento: ${latestEvent.event_type.replace("transactions/", "transações ").replace("item/", "conexão ")}` : "Nenhum evento recebido"}</span></div>
              {item.error_code && <p className="sync-error">{item.error_code}</p>}
              {item.connected_by === user.id && <PluggySyncButton connectionId={item.id} />}
            </article>;
          })}</div>}
        </article>
        <div className="settings-grid">
          <article className="card form-card"><h2>Adicionar conta</h2><p className="muted">Use para dinheiro ou contas sem conexão bancária.</p><form action={addAccount}>
            <label>Nome da conta<input name="name" placeholder="Ex.: Dinheiro da família" required /></label><label>Instituição<input name="institution_name" placeholder="Opcional" /></label><label>Tipo<select name="type" defaultValue="checking"><option value="checking">Conta corrente</option><option value="savings">Poupança</option><option value="cash">Dinheiro</option><option value="investment">Investimentos</option><option value="other">Outra</option></select></label><label>Saldo inicial<input name="initial_balance" inputMode="decimal" placeholder="0,00" /></label><label>Cor<input className="color-input" name="color" type="color" defaultValue="#9fe870" /></label><button type="submit">Adicionar conta</button>
          </form></article>
          <section className="items-column"><div className="section-heading"><h2>Contas cadastradas</h2><span className="count-badge">{accounts?.length ?? 0}</span></div>{!accounts?.length && <article className="card empty-state"><span>＋</span><h2>Nenhuma conta ainda</h2><p className="muted">Adicione a primeira conta para começar.</p></article>}{accounts?.map((account) => <article className="card account-item" key={account.id}><span className="item-color" style={{ background: account.color ?? "#9fe870" }} /><div><strong>{account.name}</strong><small>{account.institution_name || accountTypes[account.type]}</small></div><div className="item-value"><small>{account.current_balance_cents == null ? "Saldo inicial" : "Saldo atual"}</small><strong>{money.format((account.current_balance_cents ?? account.initial_balance_cents) / 100)}</strong></div></article>)}</section>
        </div>
      </section>
    </DashboardShell>
  );
}
