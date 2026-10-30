import { describe, expect, it } from "vitest";
import { moveWidget, resolveLayout, sanitizeLayout, setWidgetHidden, setWidgetSize, WIDGETS } from "../src/lib/dashboard-layout";

const all = WIDGETS.map((widget) => widget.id);

describe("layout da visão geral", () => {
  it("usa a ordem e os tamanhos padrão quando nada foi salvo", () => {
    const layout = resolveLayout(null, all);
    expect(layout.order).toEqual(all);
    expect(layout.sizes.balance).toBe("half");
    expect(layout.hidden).toEqual([]);
  });

  it("descarta widgets desconhecidos e tamanhos não permitidos", () => {
    const layout = sanitizeLayout({ order: ["recent", "nao-existe", "recent"], sizes: { recent: "quarter", balance: "full" }, hidden: ["x", "dream"] });
    expect(layout.order).toEqual(["recent"]);
    expect(layout.sizes).toEqual({ balance: "full" });
    expect(layout.hidden).toEqual(["dream"]);
  });

  it("ignora widgets indisponíveis e acrescenta os novos no fim", () => {
    const layout = resolveLayout({ order: ["recent", "dream", "balance"], hidden: ["dream"] }, all.filter((id) => id !== "dream" && id !== "payables"));
    expect(layout.order.slice(0, 2)).toEqual(["recent", "balance"]);
    expect(layout.order).not.toContain("dream");
    expect(layout.order).toHaveLength(all.length - 2);
    expect(layout.hidden).toEqual([]);
  });

  it("move entre os visíveis sem passar pelos ocultos", () => {
    let layout = resolveLayout({ order: ["balance", "month-expense", "open-statements"], hidden: ["month-expense"] }, ["balance", "month-expense", "open-statements"]);
    layout = moveWidget(layout, "open-statements", -1);
    expect(layout.order).toEqual(["open-statements", "month-expense", "balance"]);
    expect(moveWidget(layout, "open-statements", -1)).toBe(layout);
  });

  it("só aceita tamanhos permitidos para o widget", () => {
    const layout = resolveLayout(null, all);
    expect(setWidgetSize(layout, "daily-chart", "quarter")).toBe(layout);
    expect(setWidgetSize(layout, "daily-chart", "full").sizes["daily-chart"]).toBe("full");
  });

  it("oculta e mostra widgets", () => {
    const layout = setWidgetHidden(resolveLayout(null, all), "dream", true);
    expect(layout.hidden).toEqual(["dream"]);
    expect(setWidgetHidden(layout, "dream", false).hidden).toEqual([]);
  });
});
