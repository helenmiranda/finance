import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pluggyRequest } from "@/lib/pluggy";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { data: membership } = await supabase.from("household_members").select("household_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership) return NextResponse.json({ error: "Espaço familiar não encontrado." }, { status: 403 });
  try {
    const origin = new URL(request.url).origin;
    const data = await pluggyRequest<{ accessToken?: string }>("/connect_token", { method: "POST", body: JSON.stringify({ options: { clientUserId: user.id, avoidDuplicates: true, oauthRedirectUri: `${origin}/dashboard/contas` } }) });
    if (!data.accessToken) throw new Error("Token de conexão ausente.");
    return NextResponse.json({ connectToken: data.accessToken });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível iniciar a conexão." }, { status: 502 });
  }
}
