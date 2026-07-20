"use client";

import { useRef, useState } from "react";

type CategoryOption = { id: string; name: string; kind: string; parent_id: string | null; is_active: boolean };
type Category = CategoryOption & { color: string | null; icon: string | null; usageCount: number };

export function EditCategoryDialog({ category, categories, updateAction, mergeAction }: {
  category: Category;
  categories: CategoryOption[];
  updateAction: (formData: FormData) => void | Promise<void>;
  mergeAction: (formData: FormData) => void | Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState(category.kind);
  const parentOptions = categories.filter((item) => item.id !== category.id && item.kind === kind && !item.parent_id && item.is_active);
  const mergeOptions = categories.filter((item) => item.id !== category.id && item.kind === category.kind && item.is_active);

  return <>
    <button className="category-manage" type="button" onClick={() => dialogRef.current?.showModal()}>Gerenciar</button>
    <dialog className="form-dialog category-dialog" ref={dialogRef} onClick={(event) => { if (event.target === dialogRef.current) dialogRef.current.close(); }}>
      <div className="dialog-heading"><div><p className="eyebrow">GERENCIAR CATEGORIA</p><h2>{category.name}</h2><p className="muted">{category.usageCount} vínculo{category.usageCount === 1 ? "" : "s"} entre transações, regras e orçamentos.</p></div><button className="dialog-close" type="button" aria-label="Fechar" onClick={() => dialogRef.current?.close()}>×</button></div>
      <form action={updateAction}>
        <input type="hidden" name="id" value={category.id} />
        <div className="form-row"><label>Nome<input name="name" defaultValue={category.name} required /></label><label>Tipo<select name="kind" value={kind} onChange={(event) => setKind(event.target.value)}><option value="expense">Despesa</option><option value="income">Receita</option></select></label></div>
        <label>Categoria principal<select name="parent_id" defaultValue={category.parent_id ?? ""}><option value="">Nenhuma</option>{parentOptions.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
        <div className="form-row"><label>Ícone<input name="icon" defaultValue={category.icon ?? ""} maxLength={4} /></label><label>Cor<input className="color-input" name="color" type="color" defaultValue={category.color ?? "#9fe870"} /></label></div>
        <label className="toggle-field"><input name="is_active" type="checkbox" defaultChecked={category.is_active} /><span><strong>Categoria ativa</strong><small>Categorias inativas preservam o histórico, mas deixam de aparecer em novos lançamentos.</small></span></label>
        <div className="dialog-actions"><button className="secondary-link" type="button" onClick={() => dialogRef.current?.close()}>Cancelar</button><button type="submit">Salvar alterações</button></div>
      </form>
      <div className="category-merge"><div><strong>Substituir categoria</strong><small>Mova todos os vínculos para outra categoria do mesmo tipo e desative esta.</small></div><form action={mergeAction} onSubmit={(event) => { if (!window.confirm(`Substituir “${category.name}” e mover todo o histórico?`)) event.preventDefault(); }}><input type="hidden" name="source_category_id" value={category.id} /><select name="target_category_id" defaultValue="" required><option value="" disabled>Selecione o destino</option>{mergeOptions.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><button className="quiet-danger" type="submit" disabled={!mergeOptions.length}>Substituir</button></form></div>
    </dialog>
  </>;
}
