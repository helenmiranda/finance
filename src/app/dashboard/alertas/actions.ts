"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedContext } from "@/lib/household";

export async function markAllNotificationsRead() {
  const { supabase, membership, user } = await getAuthenticatedContext();
  if (!membership) return;
  const { data: notifications } = await supabase.from("notifications").select("id").eq("household_id", membership.household_id);
  if (notifications?.length) {
    await supabase.from("notification_reads").upsert(notifications.map((notification) => ({ notification_id: notification.id, user_id: user.id })), { onConflict: "notification_id,user_id" });
  }
  revalidatePath("/dashboard/alertas");
}
