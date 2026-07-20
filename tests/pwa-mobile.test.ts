import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("experiência PWA mobile", () => {
  const pullToRefresh = source("src/components/pull-to-refresh.tsx");

  it("oferece gesto de puxar para atualizar apenas no topo", () => {
    expect(pullToRefresh).toContain("window.scrollY > 0");
    expect(pullToRefresh).toContain("TRIGGER_DISTANCE");
  });

  it("consulta atualizações concluídas sem disparar uma nova execução bancária", () => {
    expect(pullToRefresh).toContain('fetch("/api/pluggy/check"');
    expect(pullToRefresh).toContain('fetch("/api/pluggy/sync"');
    expect(pullToRefresh).not.toContain('fetch("/api/pluggy/refresh"');
  });

  it("impede gestos concorrentes durante a atualização", () => {
    expect(pullToRefresh).toContain("refreshingRef.current");
  });

  it("informa quando o aparelho está offline", () => {
    const status = source("src/components/network-status.tsx");
    expect(status).toContain("useSyncExternalStore");
    expect(status).toContain("Você está sem internet");
    expect(pullToRefresh).toContain("navigator.onLine");
  });

  it("respeita as áreas seguras do aparelho", () => {
    const styles = source("src/app/styles.css");
    expect(styles).toContain("env(safe-area-inset-top)");
    expect(styles).toContain("env(safe-area-inset-bottom)");
  });
});
