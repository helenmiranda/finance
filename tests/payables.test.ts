import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const migration = source("supabase/migrations/202607200035_accounts_payable.sql");
const page = source("src/app/dashboard/contas-a-pagar/page.tsx");
const reconciliation = source("supabase/migrations/202607200036_payable_reconciliation.sql");
const pluggySync = source("src/lib/pluggy-sync.ts");

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

  it("sugere conciliação sem dar baixa automaticamente", () => {
    expect(reconciliation).toContain("suggest_payable_reconciliations");
    expect(reconciliation).toContain("transaction.account_id = payable.account_id");
    expect(reconciliation).toContain("transaction.occurred_on between occurrence.due_on - 5 and occurrence.due_on + 5");
    expect(pluggySync).toContain('rpc("suggest_payable_reconciliations"');
    expect(page).toContain("É o mesmo pagamento");
  });

  it("aceita a sugestão vinculando a transação existente", () => {
    expect(reconciliation).toContain("accept_payable_reconciliation");
    expect(reconciliation).toContain("transaction_id = transaction_record.id");
    expect(reconciliation).not.toContain("insert into public.transactions");
  });

  it("permite corrigir vencimentos e cancelar somente o futuro", () => {
    const management = source("supabase/migrations/202607200037_payable_management.sql");
    expect(management).toContain("update_payable_occurrence");
    expect(management).toContain("status <> 'pending'");
    expect(management).toContain("cancel_payable_series");
    expect(management).toContain("where payable_id = payable_record.id and status = 'pending'");
    expect(page).toContain("Cancelar parcelas futuras");
  });
});
