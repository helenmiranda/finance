import { describe, expect, it } from "vitest";
import { calculateAvailableBalance } from "../src/lib/account-balances";

describe("calculateAvailableBalance", () => {
  it("usa o saldo atual da Pluggy sem somar novamente as transações importadas", () => {
    const result = calculateAvailableBalance(
      [{ id: "pluggy", initial_balance_cents: 100_00, current_balance_cents: 850_00 }],
      [{ account_id: "pluggy", type: "expense", amount_cents: 200_00 }],
      ["pluggy"],
    );
    expect(result).toBe(850_00);
  });

  it("calcula contas manuais com receitas, despesas, faturas e transferências", () => {
    const result = calculateAvailableBalance(
      [{ id: "manual", initial_balance_cents: 1_000_00, current_balance_cents: null }],
      [
        { account_id: "manual", type: "income", amount_cents: 500_00 },
        { account_id: "manual", type: "expense", amount_cents: 120_00 },
        { account_id: "manual", type: "card_payment", amount_cents: 200_00 },
        { account_id: "manual", type: "transfer", amount_cents: 50_00, transfer_direction: "in" },
        { account_id: "manual", type: "transfer", amount_cents: 30_00, transfer_direction: "out" },
      ],
      [],
    );
    expect(result).toBe(1_200_00);
  });

  it("ignora movimentos sem conta", () => {
    expect(calculateAvailableBalance([{ id: "cash", initial_balance_cents: 50_00, current_balance_cents: null }], [{ account_id: null, type: "income", amount_cents: 999_00 }], [])).toBe(50_00);
  });
});
