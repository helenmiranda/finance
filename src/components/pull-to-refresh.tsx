"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const TRIGGER_DISTANCE = 72;

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const startY = useRef<number | null>(null);
  const distanceRef = useRef(0);
  const refreshingRef = useRef(false);
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("Puxe para atualizar");

  useEffect(() => {
    const isMobileGesture = () => window.innerWidth <= 760 && window.matchMedia("(pointer: coarse)").matches;
    const ignoredTarget = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest("input, textarea, select, [role='dialog'], .dialog-backdrop"));

    const onTouchStart = (event: TouchEvent) => {
      if (!isMobileGesture() || refreshingRef.current || window.scrollY > 0 || ignoredTarget(event.target) || event.touches.length !== 1) return;
      startY.current = event.touches[0].clientY;
      distanceRef.current = 0;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (startY.current == null || event.touches.length !== 1) return;
      const delta = event.touches[0].clientY - startY.current;
      if (delta <= 0 || window.scrollY > 0) {
        startY.current = null;
        distanceRef.current = 0;
        setDistance(0);
        return;
      }
      event.preventDefault();
      const resistedDistance = Math.min(110, delta * 0.55);
      distanceRef.current = resistedDistance;
      setDistance(resistedDistance);
      setMessage(resistedDistance >= TRIGGER_DISTANCE ? "Solte para atualizar" : "Puxe para atualizar");
    };

    const refresh = async () => {
      refreshingRef.current = true;
      setRefreshing(true);
      setDistance(56);
      setMessage("Atualizando seus dados…");
      router.refresh();
      try {
        const checkResponse = await fetch("/api/pluggy/check", { cache: "no-store" });
        if (checkResponse.ok) {
          const { pending } = await checkResponse.json() as { pending?: string[] };
          for (const connectionId of pending ?? []) {
            await fetch("/api/pluggy/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ connectionId }) });
          }
          if (pending?.length) setMessage("Novos dados bancários importados");
          else setMessage("Dados atualizados");
        } else setMessage("Dados locais atualizados");
        router.refresh();
      } catch {
        setMessage("Dados locais atualizados");
      }
      window.setTimeout(() => {
        refreshingRef.current = false;
        setRefreshing(false);
        setDistance(0);
      }, 700);
    };

    const onTouchEnd = () => {
      const shouldRefresh = distanceRef.current >= TRIGGER_DISTANCE;
      startY.current = null;
      distanceRef.current = 0;
      if (shouldRefresh && !refreshingRef.current) void refresh();
      else setDistance(0);
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [router]);

  return <>
    <div className={`pull-refresh-indicator${refreshing ? " refreshing" : ""}`} style={{ transform: `translate(-50%, ${distance - 52}px)`, opacity: distance ? 1 : 0 }} role="status" aria-live="polite">
      <span aria-hidden="true">↓</span><small>{message}</small>
    </div>
    {children}
  </>;
}
