import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const migration = source("supabase/migrations/202607200035_accounts_payable.sql");
const page = source("src/app/dashboard/contas-a-pagar/page.tsx");

describe("contas a pagar", () => {
  it("isola agenda e ocorrências por espaço familiar", () => {
    expect(migration).toContain("payables_member_access");
    expect(migration).toContain("payable_occurrences_member_access");
    expect(migration).toContain("public.is_household_member");
  });

  it("gera contas únicas, parcelamentos e recorrências", () => {
    expect(migration).toContain("'one_time', 'installment', 'recurring'");
    expect(migration).toContain("for item in 1..total_occurrences");
    expect(migration).toContain("schedule_amount_cents / total_occurrences");
  });

  it("só cria a transação ao confirmar o pagamento", () => {
    expect(migration).toContain("pay_payable_occurrence");
    expect(migration).toContain("insert into public.transactions");
    expect(migration).toContain("status = 'paid'");
  });

  it("mostra parcelas de cartão apenas como agenda", () => {
    expect(page).toContain("Próximas parcelas dos cartões");
    expect(page).toContain("Aqui aparecem apenas como agenda");
  });

  it("avisa sobre vencimentos sem repetir", () => {
    expect(migration).toContain("evaluate_payable_due_alerts");
    expect(migration).toContain("'due-soon'");
    expect(migration).toContain("'overdue'");
    expect(migration).toContain("on conflict (household_id, dedupe_key) do nothing");
  });
});
