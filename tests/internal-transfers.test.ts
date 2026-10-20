import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("conciliação de transferências internas", () => {
  it("converte as duas pontas em transferência sem apagar o vínculo da importação", () => {
    const migration = source("supabase/migrations/202607200039_reconcile_internal_transfers.sql");
    expect(migration).toContain("mark_transactions_as_transfer");
    expect(migration).toContain("transfer_direction = 'out'");
    expect(migration).toContain("transfer_direction = 'in'");
    expect(migration).toContain("source_record.amount_cents <> destination_record.amount_cents");
  });

  it("reconhece automaticamente somente pares bancários de alta confiança", () => {
    const migration = source("supabase/migrations/202607200040_auto_match_pluggy_internal_transfers.sql");
    expect(migration).toContain("outgoing.source = 'api'");
    expect(migration).toContain("incoming.amount_cents = outgoing.amount_cents");
    expect(migration).toContain("outgoing.occurred_on - 3");
    expect(migration).toContain("'%pix%'");
    expect(migration).toContain("perform public.auto_mark_internal_transfers");
    expect(source("src/lib/pluggy-sync.ts")).toContain('rpc("auto_mark_internal_transfers"');
  });

  it("oferece a marcação manual e exclui transferências dos totais de receita e despesa", () => {
    const page = source("src/app/dashboard/transacoes/page.tsx");
    expect(page).toContain("markSelectedTransactionsAsTransfer");
    expect(page).toContain("Marcar como transferência");
    expect(page).not.toContain('item.type === "transfer" && item.transfer_direction === "in"');
  });
});
