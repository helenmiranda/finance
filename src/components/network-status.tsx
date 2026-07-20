"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

const onlineSnapshot = () => navigator.onLine;
const serverSnapshot = () => true;

export function NetworkStatus() {
  const online = useSyncExternalStore(subscribe, onlineSnapshot, serverSnapshot);
  if (online) return null;
  return <aside className="network-status" role="status" aria-live="polite">
    <span aria-hidden="true">!</span>
    <div><strong>Você está sem internet</strong><small>Reconecte-se para atualizar os dados financeiros.</small></div>
  </aside>;
}
