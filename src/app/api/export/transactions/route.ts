import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function relatedName(value: { name: string } | { name: string }[] | null) {
  return Array.isArray(value) ? value[0]?.name : value?.name;
}

function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return /[",\n\r;]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { data: membership } = await supabase.from("household_members").select("household_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership) return NextResponse.json({ error: "Espaço familiar não encontrado." }, { status: 403 });

  const rows: Array<{ occurred_on: string; description: string; type: string; amount_cents: number; status: string; source: string; categories: { name: string } | { name: string }[] | null; accounts: { name: string } | { name: string }[] | null; credit_cards: { name: string } | { name: string }[] | null }> = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("transactions").select("occurred_on, description, type, amount_cents, status, source, categories(name), accounts(name), credit_cards(name)").eq("household_id", membership.household_id).order("occurred_on", { ascending: false }).range(from, from + 999);
    if (error) return NextResponse.json({ error: "Não foi possível exportar as transações." }, { status: 500 });
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  const header = ["Data", "Descrição", "Tipo", "Valor (BRL)", "Categoria", "Conta ou cartão", "Status", "Origem"];
  const lines = rows.map((item) => [item.occurred_on, item.description, item.type, (item.amount_cents / 100).toFixed(2).replace(".", ","), relatedName(item.categories) ?? "Sem categoria", relatedName(item.accounts) || relatedName(item.credit_cards) || "", item.status, item.source].map(csvCell).join(";"));
  const csv = `\uFEFF${header.join(";")}\n${lines.join("\n")}`;
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="poupemos-transacoes-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "private, no-store" } });
}
