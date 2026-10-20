"use client";

import { useEffect, useRef, useState } from "react";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function TransactionSelectionSummary({ formId }: { formId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState({ count: 0, cents: 0 });

  useEffect(() => {
    const update = () => {
      const selected = [...document.querySelectorAll<HTMLInputElement>(`input[name="transaction_ids"][form="${formId}"]:checked`)];
      setSelection({
        count: selected.length,
        cents: selected.reduce((sum, input) => sum + Number(input.dataset.signedCents ?? 0), 0),
      });
    };
    document.addEventListener("change", update);
    return () => document.removeEventListener("change", update);
  }, [formId]);

  return <div className="selection-summary" ref={ref} aria-live="polite"><strong>{selection.count} selecionada{selection.count === 1 ? "" : "s"}</strong><span>Saldo: {money.format(selection.cents / 100)}</span></div>;
}
