"use client";

import { useEffect, useState, type CSSProperties } from "react";

const coinPositions = [6, 11, 16, 21, 27, 32, 37, 42, 47, 52, 57, 62, 67, 72, 77, 82, 87, 92, 14, 25, 39, 55, 70, 84];
const coins = coinPositions.map((left, index) => ({
  left: `${left}%`, delay: `${(index * 83) % 360}ms`, duration: `${900 + (index * 47) % 360}ms`,
  size: 17 + (index * 5) % 13, pile: [0, 8, 17, 28, 12, 38][index % 6],
}));

export function PwaSplash() {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    if (!standalone || sessionStorage.getItem("poupemos:splash-seen")) {
      const hideImmediately = window.setTimeout(() => setVisible(false), 0);
      return () => window.clearTimeout(hideImmediately);
    }
    sessionStorage.setItem("poupemos:splash-seen", "1");
    const leaveTimer = window.setTimeout(() => setLeaving(true), 1550);
    const hideTimer = window.setTimeout(() => setVisible(false), 1900);
    return () => { window.clearTimeout(leaveTimer); window.clearTimeout(hideTimer); };
  }, []);

  if (!visible) return null;
  return <div className={`pwa-splash${leaving ? " leaving" : ""}`} role="status" aria-label="Abrindo o Poupemos">
    <div className="splash-coins" aria-hidden="true">{coins.map((coin, index) => <span key={index} style={{ left: coin.left, width: coin.size, height: coin.size, animationDelay: coin.delay, animationDuration: coin.duration, "--coin-pile": `${coin.pile}px` } as CSSProperties}>P</span>)}</div>
    <div className="splash-brand"><span className="splash-mark">P</span><strong>Poupemos</strong><small>Seus planos começam aqui.</small></div>
  </div>;
}
