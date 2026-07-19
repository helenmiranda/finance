import { DashboardShell } from "@/components/dashboard-shell";
import { getAuthenticatedContext } from "@/lib/household";
import { addAccount } from "../finance-actions";
import { PluggyConnectButton } from "./pluggy-connect-button";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const accountTypes: Record<string, string> = {
  checking: "Conta corrente", savings: "Poupança", cash: "Dinheiro", investment: "Investimentos", other: "Outra",
};

type PageProps = { searchParams: Promise<{ error?: string; success?: string }> };

export default async function AccountsPage({ searchParams }: PageProps) {
  const { supabase, membership } = await getAuthenticatedContext();
  const params = await searchParams;
  const [{ data: accounts }, { data: pluggyItems }] = membership ? await Promise.all([
    supabase.from("accounts").select("*").eq("household_id", membership.household_id).order("created_at"),
    supabase.from("pluggy_items").select("id, connector_name, status, execution_status").eq("household_id", membership.household_id).order("updated_at", { ascending: false }),
  ]) : [{ data: [] }, { data: [] }];

  return (
    <DashboardShell active="accounts">
      <section className="content settings-content">
        <header><div><p className="eyebrow">CONFIGURAÇÕES</p><h1>Suas contas</h1><p className="muted">Cadastre onde o dinheiro da família fica guardado.</p></div></header>
        {params.error && <p className="form-message error">{params.error}</p>}
        {params.success && <p className="form-message success">{params.success}</p>}
        <article className="card bank-connections"><div><p className="eyebrow">OPEN FINANCE</p><h2>Contas conectadas</h2><p className="muted">Conecte bancos e cartões com segurança pela Pluggy. As credenciais bancárias não passam pelo Poupemos.</p></div><PluggyConnectButton />{Boolean(pluggyItems?.length) && <div className="connected-institutions">{pluggyItems?.map((item) => <span key={item.id}><strong>{item.connector_name}</strong><small>{item.status === "UPDATED" || item.execution_status === "SUCCESS" ? "Conectada" : "Atualizando"}</small></span>)}</div>}</article>
        <div className="settings-grid">
          <article className="card form-card">
            <h2>Adicionar conta</h2>
            <p className="muted">O saldo inicial ajuda a começar o acompanhamento.</p>
            <form action={addAccount}>
              <label>Nome da conta<input name="name" placeholder="Ex.: Nubank da família" required /></label>
              <label>Instituição<input name="institution_name" placeholder="Ex.: Nubank" /></label>
              <label>Tipo<select name="type" defaultValue="checking"><option value="checking">Conta corrente</option><option value="savings">Poupança</option><option value="cash">Dinheiro</option><option value="investment">Investimentos</option><option value="other">Outra</option></select></label>
              <label>Saldo inicial<input name="initial_balance" inputMode="decimal" placeholder="0,00" /></label>
              <label>Cor<input className="color-input" name="color" type="color" defaultValue="#9fe870" /></label>
              <button type="submit">Adicionar conta</button>
            </form>
          </article>
          <section className="items-column">
            <div className="section-heading"><h2>Contas cadastradas</h2><span className="count-badge">{accounts?.length ?? 0}</span></div>
            {!accounts?.length && <article className="card empty-state"><span>＋</span><h2>Nenhuma conta ainda</h2><p className="muted">Adicione a primeira conta para começar.</p></article>}
            {accounts?.map((account) => <article className="card account-item" key={account.id}><span className="item-color" style={{ background: account.color ?? "#9fe870" }} /><div><strong>{account.name}</strong><small>{account.institution_name || accountTypes[account.type]}</small></div><div className="item-value"><small>Saldo inicial</small><strong>{money.format(account.initial_balance_cents / 100)}</strong></div></article>)}
          </section>
        </div>
      </section>
    </DashboardShell>
  );
}
