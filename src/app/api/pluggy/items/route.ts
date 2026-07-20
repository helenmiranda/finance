import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pluggyRequest } from "@/lib/pluggy";

type PluggyItem = { id: string; clientUserId?: string; status?: string; executionStatus?: string; lastUpdatedAt?: string; statusDetail?: unknown; connector?: { id?: number; name?: string }; error?: { code?: string } | null };

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { data: membership } = await supabase.from("household_members").select("household_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership) return NextResponse.json({ error: "Espaço familiar não encontrado." }, { status: 403 });
  const body = await request.json().catch(() => null) as { itemId?: string } | null;
  if (!body?.itemId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.itemId)) return NextResponse.json({ error: "Item ID inválido." }, { status: 400 });
  try {
    const item = await pluggyRequest<PluggyItem>(`/items/${body.itemId}`);
    const { data: connection, error } = await supabase.from("pluggy_items").upsert({ household_id: membership.household_id, connected_by: user.id, pluggy_item_id: item.id, connector_id: item.connector?.id ?? null, connector_name: item.connector?.name ?? "Instituição financeira", status: item.status ?? "UPDATING", execution_status: item.executionStatus ?? null, error_code: item.error?.code ?? null, provider_updated_at: item.lastUpdatedAt ?? null, status_detail: item.statusDetail ?? null, last_synced_at: null, is_active: true, updated_at: new Date().toISOString() }, { onConflict: "pluggy_item_id" }).select("id").single();
    if (error) {
      const missingObservabilityMigration = error.message.includes("provider_updated_at") || error.message.includes("status_detail");
      if (missingObservabilityMigration) throw new Error("A migration 020 precisa ser aplicada antes de vincular novas conexões.");
      if (error.code === "23505") throw new Error("Este Item ID já está vinculado a outra conta do Poupemos.");
      throw new Error(`Não foi possível salvar a conexão (${error.code || "banco"}).`);
    }
    if (!connection) throw new Error("A conexão foi salva, mas não pôde ser preparada para importação.");
    return NextResponse.json({ success: true, connectionId: connection.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível salvar a conexão." }, { status: 502 });
  }
}
