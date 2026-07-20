import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pluggyRequest } from "@/lib/pluggy";

type ItemStatus = { status?: string; executionStatus?: string; lastUpdatedAt?: string; statusDetail?: unknown; error?: { code?: string } | null };

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { data: connections } = await supabase.from("pluggy_items").select("id, pluggy_item_id, last_synced_at").eq("connected_by", user.id).eq("is_active", true);
  const pending: string[] = [];
  for (const connection of connections ?? []) {
    try {
      const item = await pluggyRequest<ItemStatus>(`/items/${connection.pluggy_item_id}`);
      await supabase.from("pluggy_items").update({ status: item.status ?? "UPDATING", execution_status: item.executionStatus ?? null, error_code: item.error?.code ?? null, provider_updated_at: item.lastUpdatedAt ?? null, status_detail: item.statusDetail ?? null }).eq("id", connection.id);
      const providerTime = item.lastUpdatedAt ? new Date(item.lastUpdatedAt).getTime() : 0;
      const importedTime = connection.last_synced_at ? new Date(connection.last_synced_at).getTime() : 0;
      if (item.status === "UPDATED" && providerTime > importedTime) pending.push(connection.id);
    } catch { /* Uma conexão indisponível não impede a abertura do app. */ }
  }
  return NextResponse.json({ pending });
}
