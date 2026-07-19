"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function PluggyAutoCheck() {
  const router = useRouter();
  const checked = useRef(false);
  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    void (async () => {
      await fetch("/api/pluggy/refresh", { method: "POST" });
      const response = await fetch("/api/pluggy/check", { cache: "no-store" });
      if (!response.ok) return;
      const { pending } = await response.json() as { pending?: string[] };
      for (const connectionId of pending ?? []) {
        await fetch("/api/pluggy/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ connectionId }) });
      }
      if (pending?.length) router.refresh();
    })();
  }, [router]);
  return null;
}
