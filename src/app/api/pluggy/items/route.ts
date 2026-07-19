import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pluggyRequest } from "@/lib/pluggy";

type PluggyItem = { id: string; clientUserId?: string; status?: string; executionStatus?: string; lastUpdatedAt?: string; connector?: { id?: number; name?: string }; error?: { code?: string } | null };

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { data: membership } = await supabase.from("household_members").select("household_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership) return NextResponse.json({ error: "Espaço familiar não encontrado." }, { status: 403 });
  const body = await request.json().catch(() => null) as { itemId?: string } | null;
  if (!body?.itemId || !/^[0-9a-f-]{36}$/i.test(body.itemId)) return NextResponse.json({ error: "Conexão inválida." }, { status: 400 });
  try {
    const item = await pluggyRequest<PluggyItem>(`/items/${body.itemId}`);
    if (item.clientUserId !== user.id) return NextResponse.json({ error: "A conexão pertence a outro usuário." }, { status: 403 });
    const { error } = await supabase.from("pluggy_items").upsert({ household_id: membership.household_id, connected_by: user.id, pluggy_item_id: item.id, connector_id: item.connector?.id ?? null, connector_name: item.connector?.name ?? "Instituição financeira", status: item.status ?? "UPDATING", execution_status: item.executionStatus ?? null, error_code: item.error?.code ?? null, last_synced_at: item.lastUpdatedAt ?? null, updated_at: new Date().toISOString() }, { onConflict: "pluggy_item_id" });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível salvar a conexão." }, { status: 502 });
  }
}
