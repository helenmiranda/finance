"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const pendingClass = "navigation-pending";

export function NavigationFeedback() {
  const pathname = usePathname();

  useEffect(() => {
    document.documentElement.classList.remove(pendingClass);
  }, [pathname]);

  useEffect(() => {
    const finish = () => document.documentElement.classList.remove(pendingClass);
    const start = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || link.hasAttribute("download")) return;
      const target = new URL(link.href, window.location.href);
      if (target.origin !== window.location.origin || `${target.pathname}${target.search}` === `${window.location.pathname}${window.location.search}`) return;
      document.documentElement.classList.add(pendingClass);
    };
    document.addEventListener("click", start, true);
    window.addEventListener("pageshow", finish);
    window.addEventListener("popstate", finish);
    return () => {
      document.removeEventListener("click", start, true);
      window.removeEventListener("pageshow", finish);
      window.removeEventListener("popstate", finish);
    };
  }, []);

  return <div className="navigation-progress" role="progressbar" aria-label="Carregando página" />;
}
