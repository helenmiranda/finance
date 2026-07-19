import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pluggyRequest } from "@/lib/pluggy";

export const maxDuration = 60;

function brazilTime() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  const hour = Number(part("hour"));
  return { date: `${part("year")}-${part("month")}-${part("day")}`, slot: hour < 11 ? "morning" : hour < 18 ? "afternoon" : "night" };
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const supabase = createAdminClient();
  const { data: connections, error } = await supabase.from("pluggy_items").select("id, pluggy_item_id");
  if (error) return NextResponse.json({ error: "Não foi possível carregar as conexões." }, { status: 500 });
  const window = brazilTime();
  let triggered = 0;
  let skipped = 0;
  let failed = 0;

  for (const connection of connections ?? []) {
    const { data: run, error: claimError } = await supabase.from("pluggy_refresh_runs").insert({ pluggy_item_id: connection.id, reference_date: window.date, slot: window.slot, status: "processing" }).select("id").maybeSingle();
    if (claimError || !run) { skipped += 1; continue; }
    try {
      await pluggyRequest(`/items/${connection.pluggy_item_id}`, { method: "PATCH", body: "{}" });
      await supabase.from("pluggy_refresh_runs").update({ status: "triggered", finished_at: new Date().toISOString() }).eq("id", run.id);
      triggered += 1;
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : "Falha ao atualizar.";
      await supabase.from("pluggy_refresh_runs").update({ status: "failed", error_message: message.slice(0, 500), finished_at: new Date().toISOString() }).eq("id", run.id);
      await supabase.from("pluggy_items").update({ error_code: message.slice(0, 200) }).eq("id", connection.id);
      failed += 1;
    }
  }
  return NextResponse.json({ date: window.date, slot: window.slot, triggered, skipped, failed });
}
