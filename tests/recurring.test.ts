import { describe, expect, it } from "vitest";
import { detectRecurringTransactions } from "../src/lib/finance/recurring";

describe("detectRecurringTransactions", () => {
  it("detecta uma assinatura mensal e calcula impacto anual", () => {
    const recurring = detectRecurringTransactions([
      { id: "1", description: "Netflix", amount_cents: 59_90, occurred_on: "2026-04-10", category: "Assinaturas", sourceId: "card" },
      { id: "2", description: "Netflix", amount_cents: 59_90, occurred_on: "2026-05-10", category: "Assinaturas", sourceId: "card" },
      { id: "3", description: "Netflix", amount_cents: 59_90, occurred_on: "2026-06-10", category: "Assinaturas", sourceId: "card" },
    ]);
    expect(recurring[0]).toMatchObject({ cadence: "monthly", monthlyCents: 59_90, annualCents: 718_80, occurrences: 3 });
  });

  it("não mistura descrições iguais de cartões diferentes", () => {
    const rows = ["a", "b"].flatMap((sourceId) => [1, 2].map((month) => ({ id: `${sourceId}-${month}`, description: "Spotify", amount_cents: 21_90, occurred_on: `2026-0${month}-05`, category: "Assinaturas", sourceId })));
    expect(detectRecurringTransactions(rows)).toEqual([]);
  });
});
