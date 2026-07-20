import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { data: membership } = await supabase.from("household_members").select("household_id, role, households(name, currency_code, timezone)").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership) return NextResponse.json({ error: "Espaço familiar não encontrado." }, { status: 403 });
  const householdId = membership.household_id;

  const [members, accounts, cards, statements, categories, transactions, budgets, goals, rules, investments, connections] = await Promise.all([
    supabase.from("household_members").select("role, joined_at, profiles(display_name, email)").eq("household_id", householdId).limit(1000),
    supabase.from("accounts").select("*").eq("household_id", householdId).limit(10000),
    supabase.from("credit_cards").select("*").eq("household_id", householdId).limit(10000),
    supabase.from("card_statements").select("*").eq("household_id", householdId).limit(10000),
    supabase.from("categories").select("*").eq("household_id", householdId).limit(10000),
    supabase.from("transactions").select("*").eq("household_id", householdId).order("occurred_on").limit(10000),
    supabase.from("budgets").select("*").eq("household_id", householdId).limit(10000),
    supabase.from("goals").select("*").eq("household_id", householdId).limit(10000),
    supabase.from("categorization_rules").select("*").eq("household_id", householdId).limit(10000),
    supabase.from("investments").select("*").eq("household_id", householdId).limit(10000),
    supabase.from("pluggy_items").select("connector_name, status, connected_by, last_synced_at, created_at").eq("household_id", householdId).limit(1000),
  ]);
  const results = [members, accounts, cards, statements, categories, transactions, budgets, goals, rules, investments, connections];
  if (results.some((result) => result.error)) return NextResponse.json({ error: "Não foi possível preparar todos os dados." }, { status: 500 });
  const payload = { exported_at: new Date().toISOString(), format_version: 1, household: membership.households, membership_role: membership.role, members: members.data, accounts: accounts.data, credit_cards: cards.data, card_statements: statements.data, categories: categories.data, transactions: transactions.data, budgets: budgets.data, goals: goals.data, categorization_rules: rules.data, investments: investments.data, pluggy_connections: connections.data };
  return NextResponse.json(payload, { headers: { "Content-Disposition": `attachment; filename="poupemos-dados-${new Date().toISOString().slice(0, 10)}.json"`, "Cache-Control": "private, no-store" } });
}
