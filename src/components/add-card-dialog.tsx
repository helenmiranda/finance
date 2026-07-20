"use client";

import { useRef } from "react";

type Account = { id: string; name: string };
type AddCardDialogProps = {
  accounts: Account[];
  action: (formData: FormData) => void | Promise<void>;
};

export function AddCardDialog({ accounts, action }: AddCardDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return <>
    <button className="primary-link add-card-trigger" type="button" onClick={() => dialogRef.current?.showModal()}>+ Adicionar cartão</button>
    <dialog className="form-dialog" ref={dialogRef} onClick={(event) => {
      if (event.target === dialogRef.current) dialogRef.current.close();
    }}>
      <div className="dialog-heading"><div><p className="eyebrow">NOVO CARTÃO</p><h2>Adicionar cartão</h2><p className="muted">Cadastre os dados principais. Você poderá importar as faturas depois.</p></div><button className="dialog-close" type="button" aria-label="Fechar" onClick={() => dialogRef.current?.close()}>×</button></div>
      <form action={action}>
        <div className="form-row"><label>Nome<input name="name" placeholder="Ex.: Nubank Helen" required /></label><label>Emissor<input name="issuer" placeholder="Ex.: Mastercard" /></label></div>
        <div className="form-row"><label>Titular<input name="cardholder_name" placeholder="Nome no cartão" /></label><label>Final<input name="last_four_digits" inputMode="numeric" maxLength={4} placeholder="1234" /></label></div>
        <label>Limite<input name="credit_limit" inputMode="decimal" placeholder="5.000,00" /></label>
        <div className="form-row"><label>Dia de fechamento<input name="closing_day" type="number" min="1" max="31" required /></label><label>Dia de vencimento<input name="due_day" type="number" min="1" max="31" required /></label></div>
        <label>Conta para pagamento<select name="payment_account_id" defaultValue=""><option value="">Definir depois</option>{accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label>
        <label>Cor<input className="color-input" name="color" type="color" defaultValue="#163300" /></label>
        <div className="dialog-actions"><button className="secondary-link" type="button" onClick={() => dialogRef.current?.close()}>Cancelar</button><button type="submit">Adicionar cartão</button></div>
      </form>
    </dialog>
  </>;
}
