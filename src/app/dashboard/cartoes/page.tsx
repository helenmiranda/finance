import { DashboardShell } from "@/components/dashboard-shell";
import { getAuthenticatedContext } from "@/lib/household";
import { addCreditCard } from "../finance-actions";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
type PageProps = { searchParams: Promise<{ error?: string; success?: string }> };

export default async function CardsPage({ searchParams }: PageProps) {
  const { supabase, membership } = await getAuthenticatedContext();
  const params = await searchParams;
  const householdId = membership?.household_id;
  const [{ data: cards }, { data: accounts }] = householdId
    ? await Promise.all([
        supabase.from("credit_cards").select("*, accounts(name)").eq("household_id", householdId).order("created_at"),
        supabase.from("accounts").select("id, name").eq("household_id", householdId).eq("is_active", true).order("name"),
      ])
    : [{ data: [] }, { data: [] }];

  return (
    <DashboardShell active="cards">
      <section className="content settings-content">
        <header><div><p className="eyebrow">CONFIGURAÇÕES</p><h1>Seus cartões</h1><p className="muted">Configure cartões, limites e ciclos de fatura.</p></div></header>
        {params.error && <p className="form-message error">{params.error}</p>}
        {params.success && <p className="form-message success">{params.success}</p>}
        <div className="settings-grid">
          <article className="card form-card">
            <h2>Adicionar cartão</h2>
            <p className="muted">Você poderá importar as faturas depois.</p>
            <form action={addCreditCard}>
              <div className="form-row"><label>Nome<input name="name" placeholder="Ex.: Nubank Helen" required /></label><label>Emissor<input name="issuer" placeholder="Ex.: Mastercard" /></label></div>
              <div className="form-row"><label>Titular<input name="cardholder_name" placeholder="Nome no cartão" /></label><label>Final<input name="last_four_digits" inputMode="numeric" maxLength={4} placeholder="1234" /></label></div>
              <label>Limite<input name="credit_limit" inputMode="decimal" placeholder="5.000,00" /></label>
              <div className="form-row"><label>Dia de fechamento<input name="closing_day" type="number" min="1" max="31" required /></label><label>Dia de vencimento<input name="due_day" type="number" min="1" max="31" required /></label></div>
              <label>Conta para pagamento<select name="payment_account_id" defaultValue=""><option value="">Definir depois</option>{accounts?.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label>
              <label>Cor<input className="color-input" name="color" type="color" defaultValue="#163300" /></label>
              <button type="submit">Adicionar cartão</button>
            </form>
          </article>
          <section className="items-column">
            <div className="section-heading"><h2>Cartões cadastrados</h2><span className="count-badge">{cards?.length ?? 0}</span></div>
            {!cards?.length && <article className="card empty-state"><span>＋</span><h2>Nenhum cartão ainda</h2><p className="muted">Adicione um cartão para acompanhar as faturas.</p></article>}
            {cards?.map((card) => <article className="credit-card-preview" style={{ background: card.color ?? "#163300" }} key={card.id}><div><small>{card.issuer || "Cartão de crédito"}</small><strong>{card.name}</strong></div><span>•••• {card.last_four_digits || "0000"}</span><div className="card-meta"><small>Limite<br/><strong>{card.credit_limit_cents == null ? "Não informado" : money.format(card.credit_limit_cents / 100)}</strong></small><small>Fecha dia<br/><strong>{card.closing_day}</strong></small><small>Vence dia<br/><strong>{card.due_day}</strong></small></div></article>)}
          </section>
        </div>
      </section>
    </DashboardShell>
  );
}
