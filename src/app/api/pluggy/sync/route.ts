import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncPluggyConnection, type PluggyConnection } from "@/lib/pluggy-sync";

export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await request.json().catch(() => null) as { connectionId?: string } | null;
  if (!body?.connectionId) return NextResponse.json({ error: "Conexão inválida." }, { status: 400 });
  const { data: connection } = await supabase.from("pluggy_items").select("id, household_id, pluggy_item_id, connector_name, connected_by").eq("id", body.connectionId).eq("connected_by", user.id).eq("is_active", true).maybeSingle();
  if (!connection) return NextResponse.json({ error: "Conexão não encontrada para este usuário." }, { status: 404 });

  try {
    return NextResponse.json(await syncPluggyConnection(supabase, connection as PluggyConnection));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível sincronizar as contas." }, { status: 502 });
  }
}
