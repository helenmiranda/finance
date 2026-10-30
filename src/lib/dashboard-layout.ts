export type WidgetSize = "quarter" | "third" | "half" | "twothirds" | "full";

export const WIDGET_SIZE_LABELS: Record<WidgetSize, { short: string; long: string }> = {
  quarter: { short: "¼", long: "um quarto da largura" },
  third: { short: "⅓", long: "um terço da largura" },
  half: { short: "½", long: "metade da largura" },
  twothirds: { short: "⅔", long: "dois terços da largura" },
  full: { short: "1", long: "largura total" },
};

export type WidgetDefinition = { id: string; title: string; sizes: WidgetSize[]; defaultSize: WidgetSize };

// A ordem desta lista é a ordem padrão da visão geral.
export const WIDGETS: WidgetDefinition[] = [
  { id: "balance", title: "Saldo disponível", sizes: ["third", "half", "twothirds", "full"], defaultSize: "half" },
  { id: "month-expense", title: "Gastos no mês", sizes: ["quarter", "third", "half"], defaultSize: "quarter" },
  { id: "open-statements", title: "Faturas em aberto", sizes: ["quarter", "third", "half"], defaultSize: "quarter" },
  { id: "category-chart", title: "Gastos por categoria", sizes: ["third", "half", "twothirds", "full"], defaultSize: "half" },
  { id: "daily-chart", title: "Entradas e saídas por dia", sizes: ["half", "twothirds", "full"], defaultSize: "half" },
  { id: "account-balances", title: "Saldo por conta", sizes: ["third", "half", "twothirds", "full"], defaultSize: "full" },
  { id: "payables", title: "Próximos 7 dias", sizes: ["half", "full"], defaultSize: "full" },
  { id: "dream", title: "Sonho em movimento", sizes: ["half", "full"], defaultSize: "full" },
  { id: "recent", title: "Últimas movimentações", sizes: ["half", "twothirds", "full"], defaultSize: "twothirds" },
  { id: "assistant", title: "Assistente financeiro", sizes: ["third", "half", "full"], defaultSize: "third" },
];

export type DashboardLayout = { order: string[]; sizes: Record<string, WidgetSize>; hidden: string[] };

const definitions = new Map(WIDGETS.map((widget) => [widget.id, widget]));

export function widgetDefinition(id: string) {
  return definitions.get(id);
}

// Aceita qualquer valor vindo do banco ou do navegador e devolve só o que é válido.
export function sanitizeLayout(input: unknown): DashboardLayout {
  const raw = (input && typeof input === "object" ? input : {}) as { order?: unknown; sizes?: unknown; hidden?: unknown };
  const unique = (values: unknown) => [...new Set(Array.isArray(values) ? values.filter((value): value is string => typeof value === "string" && definitions.has(value)) : [])];
  const sizes: Record<string, WidgetSize> = {};
  if (raw.sizes && typeof raw.sizes === "object") {
    for (const [id, size] of Object.entries(raw.sizes as Record<string, unknown>)) {
      const definition = definitions.get(id);
      if (definition && typeof size === "string" && (definition.sizes as string[]).includes(size)) sizes[id] = size as WidgetSize;
    }
  }
  return { order: unique(raw.order), sizes, hidden: unique(raw.hidden) };
}

// Combina o layout salvo com os widgets disponíveis agora (alguns só existem quando há dados).
export function resolveLayout(stored: unknown, availableIds: string[]): DashboardLayout {
  const saved = sanitizeLayout(stored);
  const available = new Set(availableIds);
  const defaultOrder = WIDGETS.map((widget) => widget.id).filter((id) => available.has(id));
  const order = [...saved.order.filter((id) => available.has(id)), ...defaultOrder.filter((id) => !saved.order.includes(id))];
  const sizes: Record<string, WidgetSize> = {};
  for (const id of order) sizes[id] = saved.sizes[id] ?? definitions.get(id)!.defaultSize;
  return { order, sizes, hidden: saved.hidden.filter((id) => available.has(id)) };
}

// Move o widget uma posição entre os visíveis, mantendo os ocultos onde estão.
export function moveWidget(layout: DashboardLayout, id: string, direction: -1 | 1): DashboardLayout {
  const hidden = new Set(layout.hidden);
  const visible = layout.order.filter((item) => !hidden.has(item));
  const from = visible.indexOf(id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= visible.length) return layout;
  const swapWith = visible[to];
  const order = [...layout.order];
  const a = order.indexOf(id);
  const b = order.indexOf(swapWith);
  [order[a], order[b]] = [order[b], order[a]];
  return { ...layout, order };
}

export function setWidgetSize(layout: DashboardLayout, id: string, size: WidgetSize): DashboardLayout {
  if (!definitions.get(id)?.sizes.includes(size)) return layout;
  return { ...layout, sizes: { ...layout.sizes, [id]: size } };
}

export function setWidgetHidden(layout: DashboardLayout, id: string, hidden: boolean): DashboardLayout {
  const rest = layout.hidden.filter((item) => item !== id);
  return { ...layout, hidden: hidden ? [...rest, id] : rest };
}
