"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteDataControl({ householdName, canDeleteHousehold }: { householdName: string; canDeleteHousehold: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [mode, setMode] = useState<"household" | "account">("account");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const confirmation = mode === "household" ? householdName : "EXCLUIR MINHA CONTA";

  async function remove(formData: FormData) {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/privacy/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, password: formData.get("password"), confirmation: formData.get("confirmation") }) });
      const data = await response.json() as { error?: string; redirectTo?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível concluir a exclusão.");
      router.push(data.redirectTo || "/login"); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível concluir a exclusão."); setLoading(false); }
  }

  return <article className="danger-zone">
    <div><p className="eyebrow">ZONA DE EXCLUSÃO</p><h2>Excluir dados</h2><p>Estas ações são permanentes. Exporte uma cópia antes de continuar.</p></div>
    <div className="danger-actions">{canDeleteHousehold && <button type="button" onClick={() => { setMode("household"); setError(""); dialogRef.current?.showModal(); }}>Excluir espaço familiar</button>}<button type="button" onClick={() => { setMode("account"); setError(""); dialogRef.current?.showModal(); }}>Excluir minha conta</button></div>
    <dialog className="form-dialog delete-dialog" ref={dialogRef} onClick={(event) => { if (event.target === dialogRef.current && !loading) dialogRef.current.close(); }}>
      <div className="dialog-heading"><div><p className="eyebrow">AÇÃO PERMANENTE</p><h2>{mode === "household" ? `Excluir ${householdName}` : "Excluir minha conta"}</h2></div><button className="dialog-close" type="button" disabled={loading} onClick={() => dialogRef.current?.close()}>×</button></div>
      <p className="muted">{mode === "household" ? "Todos os dados financeiros, arquivos e acessos deste espaço serão apagados." : "Seu acesso será removido. Espaços somente seus também serão apagados; históricos compartilhados serão preservados."}</p>
      <form action={remove}><label>Digite <strong>{confirmation}</strong><input name="confirmation" autoComplete="off" required /></label><label>Confirme sua senha<input name="password" type="password" autoComplete="current-password" required /></label>{error && <p className="form-message error" role="alert">{error}</p>}<div className="dialog-actions"><button type="button" disabled={loading} onClick={() => dialogRef.current?.close()}>Cancelar</button><button className="danger-confirm" type="submit" disabled={loading}>{loading ? "Excluindo…" : "Excluir permanentemente"}</button></div></form>
    </dialog>
  </article>;
}
