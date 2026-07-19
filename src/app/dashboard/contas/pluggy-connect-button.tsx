"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PluggyConnectButton() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  async function connect() {
    setStatus("loading"); setMessage("");
    try {
      const tokenResponse = await fetch("/api/pluggy/connect-token", { method: "POST" });
      const tokenData = await tokenResponse.json() as { connectToken?: string; error?: string };
      if (!tokenResponse.ok || !tokenData.connectToken) throw new Error(tokenData.error || "Não foi possível iniciar a conexão.");
      const { PluggyConnect } = await import("pluggy-connect-sdk");
      const widget = new PluggyConnect({ connectToken: tokenData.connectToken, includeSandbox: process.env.NEXT_PUBLIC_PLUGGY_INCLUDE_SANDBOX === "true", language: "pt", theme: "light", onSuccess: async ({ item }) => {
        const response = await fetch("/api/pluggy/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: item.id }) });
        const data = await response.json() as { error?: string };
        if (!response.ok) { setStatus("error"); setMessage(data.error || "Conexão feita, mas não foi possível salvá-la."); return; }
        setStatus("success"); setMessage("Instituição conectada. A primeira sincronização será preparada agora."); router.refresh();
      }, onError: ({ message: errorMessage }) => { setStatus("error"); setMessage(errorMessage || "A conexão não foi concluída."); } });
      await widget.init(); setStatus("idle");
    } catch (error) { setStatus("error"); setMessage(error instanceof Error ? error.message : "Não foi possível abrir a Pluggy."); }
  }
  return <div className="pluggy-connect-action"><button type="button" onClick={connect} disabled={status === "loading"}>{status === "loading" ? "Abrindo conexão…" : "+ Conectar instituição"}</button>{message && <small className={status === "error" ? "negative" : "positive"}>{message}</small>}</div>;
}
