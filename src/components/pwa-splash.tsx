"use client";

import { useEffect, useState } from "react";

const coins = [
  { left: "8%", delay: "0ms", duration: "1450ms", size: 24 },
  { left: "19%", delay: "240ms", duration: "1700ms", size: 18 },
  { left: "32%", delay: "80ms", duration: "1550ms", size: 28 },
  { left: "47%", delay: "360ms", duration: "1650ms", size: 20 },
  { left: "61%", delay: "140ms", duration: "1500ms", size: 26 },
  { left: "74%", delay: "420ms", duration: "1750ms", size: 18 },
  { left: "88%", delay: "190ms", duration: "1580ms", size: 24 },
];

export function PwaSplash() {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    if (!standalone || sessionStorage.getItem("poupemos:splash-seen")) return;
    sessionStorage.setItem("poupemos:splash-seen", "1");
    const showTimer = window.setTimeout(() => setVisible(true), 0);
    const leaveTimer = window.setTimeout(() => setLeaving(true), 1750);
    const hideTimer = window.setTimeout(() => setVisible(false), 2200);
    return () => { window.clearTimeout(showTimer); window.clearTimeout(leaveTimer); window.clearTimeout(hideTimer); };
  }, []);

  if (!visible) return null;
  return <div className={`pwa-splash${leaving ? " leaving" : ""}`} role="status" aria-label="Abrindo o Poupemos">
    <div className="splash-coins" aria-hidden="true">{coins.map((coin, index) => <span key={index} style={{ left: coin.left, width: coin.size, height: coin.size, animationDelay: coin.delay, animationDuration: coin.duration }}>P</span>)}</div>
    <div className="splash-brand"><span className="splash-mark">P</span><strong>Poupemos</strong><small>Seus planos começam aqui.</small></div>
  </div>;
}
