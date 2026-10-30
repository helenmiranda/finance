"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTransactionMovement } from "@/app/dashboard/finance-actions";

export function TransactionMovementButton({ transactionId, marked }: { transactionId: string; marked: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await setTransactionMovement(transactionId, !marked).catch(() => ({ ok: false, error: "Não foi possível salvar." }));
      if (result.ok) router.refresh();
      else setError(result.error ?? "Não foi possível salvar.");
    });
  }

  return <span className="movement-action">
    <button type="button" className="movement-chip" data-marked={marked} onClick={toggle} disabled={pending} title={marked ? "Volta a contar como receita ou despesa" : "Não conta como receita nem despesa. Use quando a outra conta não está no app."}>
      {pending ? "Salvando…" : marked ? "Desfazer movimentação" : "⇄ Movimentação"}
    </button>
    {error && <span className="movement-error" role="alert">{error}</span>}
  </span>;
}
