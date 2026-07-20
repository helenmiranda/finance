import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

let vapidConfigured = false;

function configureVapid() {
  if (vapidConfigured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export async function dispatchFinancialPushes(householdId: string) {
  if (!configureVapid()) return;
  const admin = createAdminClient();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: notifications }, { data: members }] = await Promise.all([
    admin.from("notifications").select("id, severity, link_url").eq("household_id", householdId).in("severity", ["warning", "critical"]).gte("created_at", since),
    admin.from("household_members").select("user_id").eq("household_id", householdId),
  ]);
  if (!notifications?.length || !members?.length) return;
  const userIds = members.map((member) => member.user_id);
  const { data: subscriptions } = await admin.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").in("user_id", userIds);
  if (!subscriptions?.length) return;
  const { data: deliveries } = await admin.from("notification_push_deliveries").select("notification_id, subscription_id").in("notification_id", notifications.map((notification) => notification.id));
  const delivered = new Set((deliveries ?? []).map((delivery) => `${delivery.notification_id}:${delivery.subscription_id}`));

  for (const notification of notifications) {
    for (const subscription of subscriptions) {
      if (delivered.has(`${notification.id}:${subscription.id}`)) continue;
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify({
          title: notification.severity === "critical" ? "Atenção ao orçamento" : "Novo alerta financeiro",
          body: "Abra o Poupemos para ver os detalhes.",
          url: notification.link_url || "/dashboard/alertas",
        }), { TTL: 60 * 60 * 12, urgency: notification.severity === "critical" ? "high" : "normal" });
        await admin.from("notification_push_deliveries").insert({ notification_id: notification.id, subscription_id: subscription.id, user_id: subscription.user_id, status: "sent" });
      } catch (error) {
        const pushError = error as { statusCode?: number; message?: string };
        if ([404, 410].includes(pushError.statusCode ?? 0)) await admin.from("push_subscriptions").delete().eq("id", subscription.id);
        else await admin.from("notification_push_deliveries").insert({ notification_id: notification.id, subscription_id: subscription.id, user_id: subscription.user_id, status: "failed", error_message: (pushError.message || "Falha no Web Push").slice(0, 300) });
      }
    }
  }
}

export async function evaluateAndDispatchFinancialAlerts(householdId: string) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("evaluate_financial_alerts", { target_household_id: householdId });
  if (!error) await dispatchFinancialPushes(householdId);
}
