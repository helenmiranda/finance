import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pluggyRequest } from "@/lib/pluggy";

type PluggyAccount = {
  id: string; type: "BANK" | "CREDIT"; subtype?: string; name: string; marketingName?: string | null;
  number?: string | null; balance?: number | null; owner?: string | null;
  creditData?: { creditLimit?: number | null; availableCreditLimit?: number | null; balanceCloseDate?: string | null; balanceDueDate?: string | null } | null;
};

const cents = (value?: number | null) => value == null || !Number.isFinite(value) ? null : Math.round(value * 100);
const day = (value?: string | null) => value ? new Date(`${value.slice(0, 10)}T12:00:00Z`).getUTCDate() : null;
const accountType = (subtype?: string) => subtype === "SAVINGS_ACCOUNT" ? "savings" : subtype === "INVESTMENT_ACCOUNT" ? "investment" : "checking";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await request.json().catch(() => null) as { connectionId?: string } | null;
  if (!body?.connectionId) return NextResponse.json({ error: "Conexão inválida." }, { status: 400 });
  const { data: connection } = await supabase.from("pluggy_items").select("id, household_id, pluggy_item_id, connector_name").eq("id", body.connectionId).eq("connected_by", user.id).maybeSingle();
  if (!connection) return NextResponse.json({ error: "Conexão não encontrada para este usuário." }, { status: 404 });

  try {
    const response = await pluggyRequest<{ results?: PluggyAccount[] }>(`/accounts?itemId=${encodeURIComponent(connection.pluggy_item_id)}`);
    const remoteAccounts = response.results ?? [];
    let bankCount = 0;
    let cardCount = 0;

    for (const remote of remoteAccounts) {
      const { data: mapping } = await supabase.from("pluggy_accounts").select("id, account_id, credit_card_id").eq("pluggy_account_id", remote.id).maybeSingle();
      const displayName = remote.marketingName || remote.name;
      if (remote.type === "BANK") {
        let localId = mapping?.account_id ?? null;
        const values = { name: displayName, institution_name: connection.connector_name, type: accountType(remote.subtype), current_balance_cents: cents(remote.balance), is_active: true };
        if (localId) {
          const { error } = await supabase.from("accounts").update(values).eq("id", localId).eq("household_id", connection.household_id);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.from("accounts").insert({ ...values, household_id: connection.household_id, initial_balance_cents: cents(remote.balance) ?? 0, color: "#9fe870" }).select("id").single();
          if (error || !data) throw error ?? new Error("Não foi possível criar a conta.");
          localId = data.id;
        }
        const { error } = await supabase.from("pluggy_accounts").upsert({ household_id: connection.household_id, item_id: connection.id, pluggy_account_id: remote.id, account_id: localId, credit_card_id: null, type: remote.type, subtype: remote.subtype ?? null, name: displayName, number_masked: remote.number ?? null, balance_cents: cents(remote.balance), updated_at: new Date().toISOString() }, { onConflict: "pluggy_account_id" });
        if (error) throw error;
        bankCount += 1;
      } else if (remote.type === "CREDIT") {
        let localId = mapping?.credit_card_id ?? null;
        const lastFour = remote.number?.match(/\d{4}$/)?.[0] ?? null;
        const values = { name: displayName, issuer: connection.connector_name, last_four_digits: lastFour, cardholder_name: remote.owner ?? null, credit_limit_cents: cents(remote.creditData?.creditLimit), available_credit_limit_cents: cents(remote.creditData?.availableCreditLimit), current_balance_cents: cents(remote.balance), closing_day: day(remote.creditData?.balanceCloseDate), due_day: day(remote.creditData?.balanceDueDate), is_active: true };
        if (localId) {
          const { error } = await supabase.from("credit_cards").update(values).eq("id", localId).eq("household_id", connection.household_id);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.from("credit_cards").insert({ ...values, household_id: connection.household_id, color: "#163300" }).select("id").single();
          if (error || !data) throw error ?? new Error("Não foi possível criar o cartão.");
          localId = data.id;
        }
        const { error } = await supabase.from("pluggy_accounts").upsert({ household_id: connection.household_id, item_id: connection.id, pluggy_account_id: remote.id, account_id: null, credit_card_id: localId, type: remote.type, subtype: remote.subtype ?? null, name: displayName, number_masked: remote.number ?? null, balance_cents: cents(remote.balance), updated_at: new Date().toISOString() }, { onConflict: "pluggy_account_id" });
        if (error) throw error;
        cardCount += 1;
      }
    }
    await supabase.from("pluggy_items").update({ last_synced_at: new Date().toISOString(), status: "UPDATED", error_code: null }).eq("id", connection.id);
    return NextResponse.json({ success: true, bankCount, cardCount });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível sincronizar as contas." }, { status: 502 });
  }
}
