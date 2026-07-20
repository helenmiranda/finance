import { DashboardShell } from "@/components/dashboard-shell";
import { getAuthenticatedContext } from "@/lib/household";
import { addCreditCard, payStatement, updateCreditCard } from "../finance-actions";
import { AddCardDialog } from "@/components/add-card-dialog";
import { EditCardDialog } from "@/components/edit-card-dialog";
import { cardBrandStyle } from "@/lib/card-brand";
import type { CSSProperties } from "react";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
type PageProps = { searchParams: Promise<{ error?: string; success?: string }> };

export default async function CardsPage({ searchParams }: PageProps) {
  const { supabase, membership } = await getAuthenticatedContext();
  const params = await searchParams;
  const householdId = membership?.household_id;
  const [{ data: cards }, { data: accounts }, { data: statements }] = householdId
    ? await Promise.all([
        supabase.from("credit_cards").select("*, accounts(name)").eq("household_id", householdId).order("created_at"),
        supabase.from("accounts").select("id, name").eq("household_id", householdId).eq("is_active", true).order("name"),
        supabase.from("card_statements").select("*, credit_cards(name)").eq("household_id", householdId).order("reference_month", { ascending: false }).limit(12),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  return (
    <DashboardShell active="cards">
      <section className="content settings-content">
        <header><div><p className="eyebrow">CONFIGURAÇÕES</p><h1>Seus cartões</h1><p className="muted">Configure cartões, limites e ciclos de fatura.</p></div><AddCardDialog accounts={accounts ?? []} action={addCreditCard} /></header>
        {params.error && <p className="form-message error">{params.error}</p>}
        {params.success && <p className="form-message success">{params.success}</p>}
        <div className="cards-content-grid">
          <section className="items-column">
            <div className="section-heading"><h2>Cartões cadastrados</h2><span className="count-badge">{cards?.length ?? 0}</span></div>
            {!cards?.length && <article className="card empty-state"><span>＋</span><h2>Nenhum cartão ainda</h2><p className="muted">Adicione um cartão para acompanhar as faturas.</p></article>}
            {!!cards?.length && <div className="credit-cards-grid">{cards.map((card) => {
              const brand = cardBrandStyle([card.name, card.nickname, card.issuer, card.accounts?.name], card.color ?? "#163300");
              const style = { "--card-background": brand.background, "--card-foreground": brand.foreground } as CSSProperties;
              const statement = statements?.find((item) => item.credit_card_id === card.id && item.status !== "paid");
              const usedCents = card.available_credit_limit_cents != null && card.credit_limit_cents != null
                ? Math.max(0, card.credit_limit_cents - card.available_credit_limit_cents)
                : Math.abs(card.current_balance_cents ?? statement?.total_cents ?? 0);
              const usage = card.credit_limit_cents ? Math.min(100, Math.round((usedCents / card.credit_limit_cents) * 100)) : 0;
              return <article className={`credit-card-preview${card.is_active ? "" : " inactive"}`} style={style} key={card.id}>
                <div className="card-heading"><div><small>{brand.label} · {card.issuer || "Cartão de crédito"}</small><strong>{card.nickname || card.name}</strong></div>{!card.is_active && <span>Inativo</span>}</div>
                <span>•••• {card.last_four_digits || "0000"}</span>
                <div className="card-limit"><div><small>{statement ? "Fatura atual" : "Limite utilizado"}</small><strong>{money.format((statement?.total_cents ?? usedCents) / 100)}</strong><small>{card.credit_limit_cents == null ? "Limite não informado" : `${usage}% de ${money.format(card.credit_limit_cents / 100)}`}</small></div>{card.credit_limit_cents != null && <div className="card-limit-track"><span style={{ width: `${usage}%` }} /></div>}</div>
                <div className="card-meta"><small>Disponível<br/><strong>{card.available_credit_limit_cents == null ? "Não informado" : money.format(card.available_credit_limit_cents / 100)}</strong></small><small>Fecha dia<br/><strong>{card.closing_day}</strong></small><small>Vence dia<br/><strong>{card.due_day}</strong></small></div>
                <EditCardDialog card={{ id: card.id, name: card.name, nickname: card.nickname, issuer: card.issuer, cardholder_name: card.cardholder_name, last_four_digits: card.last_four_digits, credit_limit: card.credit_limit_cents == null ? "" : (card.credit_limit_cents / 100).toFixed(2).replace(".", ","), closing_day: card.closing_day, due_day: card.due_day, payment_account_id: card.payment_account_id, color: card.color, is_active: card.is_active }} accounts={accounts ?? []} action={updateCreditCard} />
              </article>;
            })}</div>}
            {!!statements?.length && <div className="section-heading statements-heading"><h2>Faturas geradas</h2></div>}
            {statements?.map((statement) => {
              const isOverdue = statement.status !== "paid" && new Date(`${statement.due_date}T23:59:59`) < new Date();
              const displayStatus = isOverdue ? "overdue" : statement.status;
              return <article className="card statement-item" key={statement.id}>
                <div className="statement-summary"><strong>{statement.credit_cards?.name}</strong><small>Vence em {new Intl.DateTimeFormat("pt-BR").format(new Date(`${statement.due_date}T12:00:00`))}</small></div>
                <div className="statement-value"><span className={`statement-status ${displayStatus}`}>{displayStatus === "open" ? "Aberta" : displayStatus === "paid" ? "Paga" : displayStatus === "closed" ? "Fechada" : "Atrasada"}</span><strong>{money.format(statement.total_cents / 100)}</strong></div>
                {statement.status !== "paid" && <details className="statement-payment"><summary>Pagar fatura</summary><form action={payStatement}><input type="hidden" name="statement_id" value={statement.id} /><label>Conta<select name="account_id" defaultValue="" required><option value="" disabled>Selecione</option>{accounts?.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label><label>Data<input name="payment_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label><button type="submit">Confirmar pagamento</button></form></details>}
              </article>;
            })}
          </section>
        </div>
      </section>
    </DashboardShell>
  );
}
