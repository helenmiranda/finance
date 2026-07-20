"use client";

import { useRef } from "react";

type Account = { id: string; name: string };
type EditableCard = {
  id: string; name: string; nickname: string | null; issuer: string | null; cardholder_name: string | null;
  last_four_digits: string | null; credit_limit: string; closing_day: number | null; due_day: number | null;
  payment_account_id: string | null; color: string | null; is_active: boolean;
};

export function EditCardDialog({ card, accounts, action }: { card: EditableCard; accounts: Account[]; action: (formData: FormData) => void | Promise<void> }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  return <>
    <button className="card-edit-trigger" type="button" onClick={() => dialogRef.current?.showModal()}>Gerenciar</button>
    <dialog className="form-dialog" ref={dialogRef} onClick={(event) => { if (event.target === dialogRef.current) dialogRef.current.close(); }}>
      <div className="dialog-heading"><div><p className="eyebrow">DETALHES DO CARTÃO</p><h2>{card.nickname || card.name}</h2><p className="muted">Edite os dados, a conta de pagamento ou a disponibilidade do cartão.</p></div><button className="dialog-close" type="button" aria-label="Fechar" onClick={() => dialogRef.current?.close()}>×</button></div>
      <form action={action}>
        <input type="hidden" name="id" value={card.id} />
        <div className="form-row"><label>Nome<input name="name" defaultValue={card.name} required /></label><label>Apelido<input name="nickname" defaultValue={card.nickname ?? ""} placeholder="Ex.: Cartão da Helen" maxLength={60} /></label></div>
        <div className="form-row"><label>Emissor<input name="issuer" defaultValue={card.issuer ?? ""} /></label><label>Titular<input name="cardholder_name" defaultValue={card.cardholder_name ?? ""} /></label></div>
        <div className="form-row"><label>Final<input name="last_four_digits" inputMode="numeric" maxLength={4} defaultValue={card.last_four_digits ?? ""} /></label><label>Limite<input name="credit_limit" inputMode="decimal" defaultValue={card.credit_limit} /></label></div>
        <div className="form-row"><label>Dia de fechamento<input name="closing_day" type="number" min="1" max="31" defaultValue={card.closing_day ?? ""} required /></label><label>Dia de vencimento<input name="due_day" type="number" min="1" max="31" defaultValue={card.due_day ?? ""} required /></label></div>
        <label>Conta para pagamento<select name="payment_account_id" defaultValue={card.payment_account_id ?? ""}><option value="">Não definida</option>{accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label>
        <label>Cor personalizada<input className="color-input" name="color" type="color" defaultValue={card.color ?? "#163300"} /><small>Usada quando a instituição não for reconhecida automaticamente.</small></label>
        <label className="toggle-field"><input name="is_active" type="checkbox" defaultChecked={card.is_active} /><span><strong>Cartão ativo</strong><small>Cartões inativos mantêm o histórico, mas deixam de aparecer nas novas transações.</small></span></label>
        <div className="dialog-actions"><button className="secondary-link" type="button" onClick={() => dialogRef.current?.close()}>Cancelar</button><button type="submit">Salvar alterações</button></div>
      </form>
    </dialog>
  </>;
}
