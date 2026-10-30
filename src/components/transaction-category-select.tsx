"use client";

import { useRef, useState, useTransition } from "react";
import { setTransactionCategory } from "@/app/dashboard/finance-actions";

type Option = { id: string; name: string; color?: string | null };

export function TransactionCategorySelect({ transactionId, value, options, leaveListWhenSet = false }: { transactionId: string; value: string | null; options: Option[]; leaveListWhenSet?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [current, setCurrent] = useState(value ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [, startTransition] = useTransition();

  function change(next: string) {
    const previous = current;
    setCurrent(next);
    setStatus("saving");
    startTransition(async () => {
      const result = await setTransactionCategory(transactionId, next || null).catch(() => ({ ok: false }));
      if (result.ok) {
        setStatus("saved");
        // No filtro "sem categoria", a linha já resolvida sai da lista sem recarregar a página.
        if (leaveListWhenSet && next) ref.current?.closest(".transaction-row")?.classList.add("row-leaving");
        setTimeout(() => setStatus((state) => (state === "saved" ? "idle" : state)), 1500);
      } else {
        setCurrent(previous);
        setStatus("error");
      }
    });
  }

  const selected = options.find((option) => option.id === current);

  return <span className="inline-category" ref={ref}>
    <span className="category-chip" data-empty={current ? "false" : "true"} data-status={status}>
      <i className="category-chip-dot" style={{ background: selected?.color ?? "#b7bdb4" }} aria-hidden="true" />
      <span className="category-chip-label">{selected?.name ?? "Sem categoria"}</span>
      <i className="category-chip-chevron" aria-hidden="true" />
      <select value={current} onChange={(event) => change(event.target.value)} aria-label="Categoria">
        <option value="">Sem categoria</option>
        {options.map((option) => <option value={option.id} key={option.id}>{option.name}</option>)}
      </select>
    </span>
    <span className="inline-category-status" role="status" aria-live="polite">{status === "saving" ? "Salvando…" : status === "saved" ? "Salvo ✓" : status === "error" ? "Não salvou" : ""}</span>
  </span>;
}
