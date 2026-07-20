"use client";

import { useEffect, useState } from "react";

function decodeKey(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

export function PushSettings({ publicKey }: { publicKey?: string }) {
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) { setSupported(false); return; }
    navigator.serviceWorker.ready.then((registration) => registration.pushManager.getSubscription()).then((subscription) => setEnabled(Boolean(subscription))).catch(() => undefined);
  }, []);

  async function toggle() {
    if (!publicKey) { setMessage("Configure as chaves VAPID para ativar esta opção."); return; }
    setLoading(true); setMessage("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const current = await registration.pushManager.getSubscription();
      if (current) {
        await fetch("/api/push/subscription", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: current.endpoint }) });
        await current.unsubscribe(); setEnabled(false); setMessage("Notificações desativadas neste dispositivo.");
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") throw new Error("A permissão de notificações não foi concedida.");
        const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(publicKey) });
        const response = await fetch("/api/push/subscription", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(subscription.toJSON()) });
        if (!response.ok) { await subscription.unsubscribe(); throw new Error("Não foi possível salvar este dispositivo."); }
        setEnabled(true); setMessage("Notificações ativadas neste dispositivo.");
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível alterar as notificações."); }
    finally { setLoading(false); }
  }

  if (!supported) return <p className="muted">Este navegador não oferece notificações Web Push.</p>;
  return <div className="push-settings"><div><strong>Notificações neste dispositivo</strong><small>Somente alertas importantes, sem valores na tela bloqueada.</small></div><button type="button" onClick={toggle} disabled={loading}>{loading ? "Aguarde…" : enabled ? "Desativar" : "Ativar notificações"}</button>{message && <small>{message}</small>}</div>;
}
