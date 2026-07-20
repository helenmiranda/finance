import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("estado das conexões Pluggy", () => {
  it.each([
    "src/app/api/pluggy/check/route.ts",
    "src/app/api/pluggy/refresh/route.ts",
    "src/app/api/pluggy/sync/route.ts",
    "src/app/api/cron/pluggy-refresh/route.ts",
    "src/app/api/webhooks/pluggy/route.ts",
  ])("impede processamento de conexões inativas em %s", (file) => {
    expect(source(file)).toContain('.eq("is_active", true)');
  });

  it("reativa um Item ID quando ele é vinculado novamente", () => {
    const itemRoute = source("src/app/api/pluggy/items/route.ts");
    expect(itemRoute).toContain("is_active: true");
    expect(itemRoute).toContain("last_synced_at: null");
  });

  it("inicia a primeira importação logo após o vínculo", () => {
    expect(source("src/app/dashboard/contas/pluggy-connect-button.tsx")).toContain('fetch("/api/pluggy/sync"');
  });

  it("não confirma uma sincronização enquanto o banco ainda atualiza", () => {
    const syncRoute = source("src/app/api/pluggy/sync/route.ts");
    expect(syncRoute).toContain('item.status === "UPDATING"');
    expect(syncRoute).toContain("pending: true");
  });

  it("não marca como sincronizada uma conexão sem contas", () => {
    expect(source("src/lib/pluggy-sync.ts")).toContain("if (!remoteAccounts.length) throw new Error");
  });

  it("usa o saldo de fechamento quando o saldo principal não vem preenchido", () => {
    expect(source("src/lib/pluggy-sync.ts")).toContain("account.balance ?? account.bankData?.closingBalance");
  });

  it("desvincula por estado sem apagar os mapeamentos financeiros", () => {
    const action = source("src/app/dashboard/privacidade/actions.ts");
    expect(action).toContain("update({ is_active: nextState })");
    expect(action).not.toContain(".delete()");
  });
});
