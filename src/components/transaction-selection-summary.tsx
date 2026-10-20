"use client";

import { useEffect, useRef, useState } from "react";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function TransactionSelectionSummary() {
  const ref = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState({ count: 0, cents: 0 });

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const update = () => {
      const selected = [...form.querySelectorAll<HTMLInputElement>('input[name="transaction_ids"]:checked')];
      setSelection({
        count: selected.length,
        cents: selected.reduce((sum, input) => sum + Number(input.dataset.amountCents ?? 0), 0),
      });
    };
    form.addEventListener("change", update);
    return () => form.removeEventListener("change", update);
  }, []);

  return <div className="selection-summary" ref={ref} aria-live="polite"><strong>{selection.count} selecionada{selection.count === 1 ? "" : "s"}</strong><span>Soma: {money.format(selection.cents / 100)}</span></div>;
}
