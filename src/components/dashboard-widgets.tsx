"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { saveDashboardLayout } from "@/app/dashboard/layout-actions";
import { moveWidget, resolveLayout, setWidgetHidden, setWidgetSize, widgetDefinition, WIDGET_SIZE_LABELS, type DashboardLayout } from "@/lib/dashboard-layout";

type Item = { id: string; node: ReactNode };
type Status = "idle" | "saving" | "saved" | "error";

export function DashboardWidgets({ items, initialLayout }: { items: Item[]; initialLayout: DashboardLayout }) {
  const [layout, setLayout] = useState(initialLayout);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const dirty = useRef(false);
  const nodes = new Map(items.map((item) => [item.id, item.node]));

  function change(next: DashboardLayout) {
    dirty.current = true;
    setStatus("saving");
    setLayout(next);
  }

  // Salva depois de uma pausa nas alterações, para não gravar a cada clique.
  useEffect(() => {
    if (!dirty.current) return;
    const timer = setTimeout(async () => {
      const result = await saveDashboardLayout(layout).catch(() => ({ ok: false }));
      setStatus(result.ok ? "saved" : "error");
    }, 600);
    return () => clearTimeout(timer);
  }, [layout]);

  const hiddenIds = new Set(layout.hidden);
  const visible = layout.order.filter((id) => nodes.has(id) && !hiddenIds.has(id));
  const hidden = layout.order.filter((id) => nodes.has(id) && hiddenIds.has(id));

  return <section className="dashboard-widgets-wrap" aria-label="Visão geral">
    <div className="widgets-bar">
      <span className="widgets-status" role="status" aria-live="polite">{status === "saving" ? "Salvando…" : status === "saved" ? "Layout salvo ✓" : status === "error" ? "Não foi possível salvar o layout" : editing ? "Mude a ordem, o tamanho ou oculte os blocos." : ""}</span>
      {editing && <button type="button" className="secondary-link" onClick={() => change(resolveLayout(null, items.map((item) => item.id)))}>Restaurar padrão</button>}
      <button type="button" className={editing ? "primary-link" : "secondary-link"} onClick={() => setEditing((value) => !value)} aria-pressed={editing}>{editing ? "Concluir" : "Personalizar"}</button>
    </div>

    <div className="dashboard-widgets" data-editing={editing}>
      {visible.map((id, index) => {
        const definition = widgetDefinition(id);
        if (!definition) return null;
        return <div className={`dashboard-widget size-${layout.sizes[id] ?? definition.defaultSize}`} data-editing={editing} key={id}>
          {editing && <div className="widget-toolbar" role="group" aria-label={`Personalizar ${definition.title}`}>
            <strong>{definition.title}</strong>
            <span className="widget-tools">
              <span className="widget-sizes">{definition.sizes.map((size) => <button type="button" key={size} aria-pressed={(layout.sizes[id] ?? definition.defaultSize) === size} aria-label={`Tamanho: ${WIDGET_SIZE_LABELS[size].long}`} title={WIDGET_SIZE_LABELS[size].long} onClick={() => change(setWidgetSize(layout, id, size))}>{WIDGET_SIZE_LABELS[size].short}</button>)}</span>
              <button type="button" aria-label={`Mover ${definition.title} para antes`} title="Mover para antes" disabled={index === 0} onClick={() => change(moveWidget(layout, id, -1))}>↑</button>
              <button type="button" aria-label={`Mover ${definition.title} para depois`} title="Mover para depois" disabled={index === visible.length - 1} onClick={() => change(moveWidget(layout, id, 1))}>↓</button>
              <button type="button" aria-label={`Ocultar ${definition.title}`} title="Ocultar" onClick={() => change(setWidgetHidden(layout, id, true))}>✕</button>
            </span>
          </div>}
          <div className="widget-body" inert={editing}>{nodes.get(id)}</div>
        </div>;
      })}
    </div>

    {editing && hidden.length > 0 && <div className="widgets-hidden"><span>Ocultos</span>{hidden.map((id) => <button type="button" key={id} onClick={() => change(setWidgetHidden(layout, id, false))}>＋ {widgetDefinition(id)?.title}</button>)}</div>}
  </section>;
}
