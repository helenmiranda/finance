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
    expect(source("src/app/api/pluggy/items/route.ts")).toContain("is_active: true");
  });

  it("desvincula por estado sem apagar os mapeamentos financeiros", () => {
    const action = source("src/app/dashboard/privacidade/actions.ts");
    expect(action).toContain("update({ is_active: nextState })");
    expect(action).not.toContain(".delete()");
  });
});
