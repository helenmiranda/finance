import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pluggyRequest } from "@/lib/pluggy";

function currentWindow() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  const hour = Number(part("hour"));
  const slot = hour >= 6 && hour < 12 ? "morning" : hour >= 12 && hour < 18 ? "afternoon" : null;
  return { date: `${part("year")}-${part("month")}-${part("day")}`, slot };
}

export async function POST() {
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const window = currentWindow();
  if (!window.slot) return NextResponse.json({ triggered: 0, reason: "outside_window" });
  const { data: connections } = await userClient.from("pluggy_items").select("id, pluggy_item_id").eq("connected_by", user.id);
  const admin = createAdminClient();
  let triggered = 0;
  for (const connection of connections ?? []) {
    const { data: run } = await admin.from("pluggy_refresh_runs").insert({ pluggy_item_id: connection.id, reference_date: window.date, slot: window.slot, status: "processing" }).select("id").maybeSingle();
    if (!run) continue;
    try {
      await pluggyRequest(`/items/${connection.pluggy_item_id}`, { method: "PATCH", body: "{}" });
      await admin.from("pluggy_refresh_runs").update({ status: "triggered", finished_at: new Date().toISOString() }).eq("id", run.id);
      triggered += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao atualizar.";
      await admin.from("pluggy_refresh_runs").update({ status: "failed", error_message: message.slice(0, 500), finished_at: new Date().toISOString() }).eq("id", run.id);
    }
  }
  return NextResponse.json({ triggered, slot: window.slot });
}
