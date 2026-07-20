"use client";

import { setPluggyConnectionState } from "./actions";

export function ConnectionStateControl({ connectionId, active }: { connectionId: string; active: boolean }) {
  return <form className="connection-state-form" action={setPluggyConnectionState} onSubmit={(event) => {
    if (active && !window.confirm("Desvincular esta integração? O histórico será preservado, mas os dados deixarão de ser atualizados.")) event.preventDefault();
  }}><input type="hidden" name="connection_id" value={connectionId} /><input type="hidden" name="next_state" value={active ? "inactive" : "active"} /><button className={active ? "quiet-danger" : "secondary-link"} type="submit">{active ? "Desvincular" : "Reativar"}</button></form>;
}
