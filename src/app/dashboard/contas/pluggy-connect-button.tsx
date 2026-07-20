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
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(itemId)) {
        throw new Error("Digite um Item ID válido no formato xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.");
      }
      const response = await fetch("/api/pluggy/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId }) });
      const responseBody = await response.text();
      const data = (() => { try { return JSON.parse(responseBody) as { connectionId?: string; error?: string }; } catch { return {}; } })();
      if (!response.ok) throw new Error(data.error || "Não foi possível vincular a conexão.");
      if (!data.connectionId) throw new Error("A conexão foi vinculada, mas não pôde iniciar a importação.");
      setMessage("Conexão vinculada. Importando os dados…");
      const syncResponse = await fetch("/api/pluggy/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ connectionId: data.connectionId }) });
      const syncBody = await syncResponse.text();
      const syncData = (() => { try { return JSON.parse(syncBody) as { bankCount?: number; cardCount?: number; transactionCount?: number; investmentCount?: number; error?: string }; } catch { return {}; } })();
      if (!syncResponse.ok) throw new Error(`Conexão vinculada, mas a primeira importação falhou: ${syncData.error || "tente importar novamente."}`);
      setStatus("success"); setMessage(`${syncData.bankCount ?? 0} contas, ${syncData.cardCount ?? 0} cartões, ${syncData.transactionCount ?? 0} transações e ${syncData.investmentCount ?? 0} ativos importados.`); router.refresh();
    } catch (error) { setStatus("error"); setMessage(error instanceof Error ? error.message : "Não foi possível vincular a conexão."); }
  }
  return <form className="pluggy-connect-action" action={connect}><label>Item ID do Meu Pluggy<input name="item_id" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" autoCapitalize="none" autoCorrect="off" spellCheck={false} required /></label><button type="submit" disabled={status === "loading"}>{status === "loading" ? "Validando…" : "Vincular conexão"}</button>{message && <small className={status === "error" ? "negative" : "positive"}>{message}</small>}</form>;
}

export function PluggySyncButton({ connectionId }: { connectionId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  async function sync() {
    setLoading(true); setMessage("");
    try {
      const response = await fetch("/api/pluggy/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ connectionId }) });
      const data = await response.json() as { bankCount?: number; cardCount?: number; transactionCount?: number; investmentCount?: number; error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível sincronizar.");
      setMessage(`${data.bankCount ?? 0} contas, ${data.cardCount ?? 0} cartões, ${data.transactionCount ?? 0} novas transações e ${data.investmentCount ?? 0} ativos.`); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível sincronizar."); }
    finally { setLoading(false); }
  }
  return <><button className="sync-connection" type="button" onClick={sync} disabled={loading}>{loading ? "Importando…" : "Importar dados agora"}</button>{message && <small>{message}</small>}</>;
}
