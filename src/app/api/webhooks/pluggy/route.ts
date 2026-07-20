import { after, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pluggyRequest } from "@/lib/pluggy";
import { reconcilePluggyTransactions, syncPluggyConnection, type PluggyConnection, type PluggyTransactionEvent } from "@/lib/pluggy-sync";
import { evaluateAndDispatchFinancialAlerts } from "@/lib/financial-alerts";

export const maxDuration = 60;

type PluggyWebhookPayload = {
  event?: string;
  eventId?: string;
  itemId?: string;
  triggeredBy?: string;
  accountId?: string;
  transactionIds?: string[];
  transactionsCreatedAtFrom?: string;
  error?: { code?: string; message?: string } | null;
};

type PluggyItem = {
  status?: string;
  executionStatus?: string;
  lastUpdatedAt?: string;
  statusDetail?: unknown;
  error?: { code?: string; message?: string } | null;
};

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const payload = await request.json().catch(() => null) as PluggyWebhookPayload | null;
  const supportedEvents = ["item/updated", "item/error", "transactions/created", "transactions/updated", "transactions/deleted"];
  if (!payload?.eventId || !payload.itemId || !payload.event || !supportedEvents.includes(payload.event)) {
    return NextResponse.json({ accepted: true, ignored: true });
  }
  if (payload.event.startsWith("transactions/") && !payload.accountId) return NextResponse.json({ accepted: true, ignored: true });
  const event = payload.event;
  const eventId = payload.eventId;
  const itemId = payload.itemId;

  const admin = createAdminClient();
  const { data: connection } = await admin.from("pluggy_items")
    .select("id, household_id, pluggy_item_id, connector_name, connected_by")
    .eq("pluggy_item_id", itemId)
    .eq("is_active", true)
    .maybeSingle();
  if (!connection) return NextResponse.json({ accepted: true, ignored: true });

  const { error: eventError } = await admin.from("pluggy_webhook_events").insert({
    event_id: eventId.slice(0, 200),
    item_id: connection.id,
    event_type: event,
    triggered_by: payload.triggeredBy?.slice(0, 40) ?? null,
    payload,
    status: "processing",
  });
  if (eventError?.code === "23505") return NextResponse.json({ accepted: true, duplicate: true });
  if (eventError) return NextResponse.json({ error: "Não foi possível registrar o evento." }, { status: 500 });

  after(async () => {
    try {
      if (event.startsWith("item/")) {
        const item = await pluggyRequest<PluggyItem>(`/items/${encodeURIComponent(itemId)}`);
        const providerError = payload.error?.code || item.error?.code || null;
        await admin.from("pluggy_items").update({
          status: item.status ?? (event === "item/error" ? "OUTDATED" : "UPDATED"),
          execution_status: item.executionStatus ?? null,
          error_code: providerError,
          provider_updated_at: item.lastUpdatedAt ?? null,
          status_detail: item.statusDetail ?? null,
        }).eq("id", connection.id);
        if (event === "item/updated") await syncPluggyConnection(admin, connection as PluggyConnection, { includeTransactions: false });
      } else {
        await reconcilePluggyTransactions(admin, connection as PluggyConnection, payload as PluggyTransactionEvent);
        await evaluateAndDispatchFinancialAlerts(connection.household_id);
      }
      await admin.from("pluggy_webhook_events").update({ status: "completed", finished_at: new Date().toISOString() }).eq("event_id", eventId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao processar o webhook.";
      await admin.from("pluggy_items").update({ error_code: message.slice(0, 200) }).eq("id", connection.id);
      await admin.from("pluggy_webhook_events").update({ status: "failed", error_message: message.slice(0, 500), finished_at: new Date().toISOString() }).eq("event_id", eventId);
    }
  });

  return NextResponse.json({ accepted: true }, { status: 202 });
}
