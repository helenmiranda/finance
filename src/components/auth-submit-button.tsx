"use client";

import { useEffect } from "react";
import { useFormStatus } from "react-dom";

export function AuthSubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();

  useEffect(() => {
    document.documentElement.classList.toggle("navigation-pending", pending);
    return () => document.documentElement.classList.remove("navigation-pending");
  }, [pending]);

  return <button type="submit" disabled={pending} aria-busy={pending} onClick={() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); }}>
    {pending ? <><span className="button-spinner" aria-hidden="true" />{pendingLabel}</> : label}
  </button>;
}
