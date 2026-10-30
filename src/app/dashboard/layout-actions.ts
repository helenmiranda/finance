"use server";

import { getAuthenticatedContext } from "@/lib/household";
import { sanitizeLayout } from "@/lib/dashboard-layout";

export async function saveDashboardLayout(layout: unknown): Promise<{ ok: boolean }> {
  const { supabase, user } = await getAuthenticatedContext();
  const { error } = await supabase.from("dashboard_layouts").upsert({ user_id: user.id, layout: sanitizeLayout(layout), updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  return { ok: !error };
}
