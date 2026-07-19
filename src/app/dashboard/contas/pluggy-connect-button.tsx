"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PluggyConnectButton() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  async function connect(formData: FormData) {
    setStatus("loading"); setMessage("");
    try {
      const itemId = String(formData.get("item_id") ?? "").trim();
      const response = await fetch("/api/pluggy/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível vincular a conexão.");
      setStatus("success"); setMessage("Conexão vinculada ao Poupemos."); router.refresh();
    } catch (error) { setStatus("error"); setMessage(error instanceof Error ? error.message : "Não foi possível vincular a conexão."); }
  }
  return <form className="pluggy-connect-action" action={connect}><label>Item ID do Meu Pluggy<input name="item_id" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" pattern="[0-9a-fA-F-]{36}" required /></label><button type="submit" disabled={status === "loading"}>{status === "loading" ? "Validando…" : "Vincular conexão"}</button>{message && <small className={status === "error" ? "negative" : "positive"}>{message}</small>}</form>;
}

export function PluggySyncButton({ connectionId }: { connectionId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  async function sync() {
    setLoading(true); setMessage("");
    try {
      const response = await fetch("/api/pluggy/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ connectionId }) });
      const data = await response.json() as { bankCount?: number; cardCount?: number; error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível sincronizar.");
      setMessage(`${data.bankCount ?? 0} contas e ${data.cardCount ?? 0} cartões atualizados.`); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível sincronizar."); }
    finally { setLoading(false); }
  }
  return <><button className="sync-connection" type="button" onClick={sync} disabled={loading}>{loading ? "Sincronizando…" : "Sincronizar"}</button>{message && <small>{message}</small>}</>;
}
