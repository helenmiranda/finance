import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("gráficos do dashboard", () => {
  it("agrupa despesas por categoria e limita a leitura principal", () => {
    const dashboard = source("src/app/dashboard/page.tsx");
    expect(dashboard).toContain('item.type === "expense"');
    expect(dashboard).toContain("categoryTotals.values()");
    expect(dashboard).toContain("slice(0, 7)");
  });

  it("calcula entradas e saídas por dia", () => {
    const dashboard = source("src/app/dashboard/page.tsx");
    expect(dashboard).toContain("dailyChart[day - 1].income");
    expect(dashboard).toContain("dailyChart[day - 1].expense");
  });

  it("mantém descrição acessível nos gráficos", () => {
    const charts = source("src/components/dashboard-charts.tsx");
    expect(charts).toContain('role="img"');
    expect(charts).toContain("<title>");
  });

  it("abre as transações filtradas ao selecionar uma categoria", () => {
    const charts = source("src/components/dashboard-charts.tsx");
    expect(charts).toContain("category=${encodeURIComponent(category.id)}");
    expect(charts).toContain("&from=${periodFrom}&to=${periodTo}");
    expect(charts).toContain('"review=uncategorized"');
    expect(charts).toContain("Ver transações de");
  });

  it("mostra entradas, saídas e saldo para os filtros aplicados", () => {
    const transactions = source("src/app/dashboard/transacoes/page.tsx");
    expect(transactions).toContain("filteredIncome");
    expect(transactions).toContain("filteredExpense");
    expect(transactions).toContain("Saldo líquido");
  });
});
