import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type SubscriptionBody = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await request.json().catch(() => null) as SubscriptionBody | null;
  if (!body?.endpoint?.startsWith("https://") || !body.keys?.p256dh || !body.keys.auth) return NextResponse.json({ error: "Inscrição inválida." }, { status: 400 });
  const { error } = await supabase.from("push_subscriptions").upsert({ user_id: user.id, endpoint: body.endpoint, p256dh: body.keys.p256dh, auth: body.keys.auth, user_agent: request.headers.get("user-agent"), updated_at: new Date().toISOString() }, { onConflict: "endpoint" });
  if (error) return NextResponse.json({ error: "Não foi possível ativar as notificações." }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await request.json().catch(() => null) as { endpoint?: string } | null;
  if (body?.endpoint) await supabase.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", body.endpoint);
  return NextResponse.json({ success: true });
}
