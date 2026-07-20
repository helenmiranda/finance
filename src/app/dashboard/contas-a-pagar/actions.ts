"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedContext } from "@/lib/household";
import { evaluateAndDispatchFinancialAlerts } from "@/lib/financial-alerts";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
function cents(value: string) {
  const parsed = Number(value.replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : null;
}

export async function createPayable(formData: FormData) {
  const { supabase, membership } = await getAuthenticatedContext();
  if (!membership) redirect("/dashboard");
  const type = text(formData, "schedule_type");
  const count = type === "one_time" ? 1 : Number(text(formData, "occurrence_count"));
  const amount = cents(text(formData, "amount"));
  if (!text(formData, "title") || !text(formData, "account_id") || !text(formData, "first_due_on") || !amount || !["one_time", "installment", "recurring"].includes(type) || !Number.isInteger(count) || count < 1 || count > 60) {
    redirect("/dashboard/contas-a-pagar?error=Confira%20os%20dados%20da%20conta.");
  }
  const { error } = await supabase.rpc("create_payable_schedule", {
    target_account_id: text(formData, "account_id"),
    target_category_id: text(formData, "category_id") || null,
    payable_title: text(formData, "title"),
    payable_notes: text(formData, "notes") || null,
    schedule_kind: type,
    schedule_amount_cents: amount,
    first_due_date: text(formData, "first_due_on"),
    total_occurrences: count,
  });
  if (error) redirect("/dashboard/contas-a-pagar?error=Não%20foi%20possível%20criar.%20A%20migration%20035%20foi%20aplicada?");
  await evaluateAndDispatchFinancialAlerts(membership.household_id);
  revalidatePath("/dashboard/contas-a-pagar"); revalidatePath("/dashboard");
  redirect("/dashboard/contas-a-pagar?success=Conta%20adicionada%20à%20agenda.");
}

export async function payOccurrence(formData: FormData) {
  const { supabase, membership } = await getAuthenticatedContext();
  if (!membership) redirect("/dashboard");
  const { error } = await supabase.rpc("pay_payable_occurrence", { target_occurrence_id: text(formData, "occurrence_id"), payment_date: text(formData, "paid_on") });
  if (error) redirect("/dashboard/contas-a-pagar?error=Não%20foi%20possível%20baixar%20a%20conta.");
  await evaluateAndDispatchFinancialAlerts(membership.household_id);
  revalidatePath("/dashboard/contas-a-pagar"); revalidatePath("/dashboard/transacoes"); revalidatePath("/dashboard");
  redirect("/dashboard/contas-a-pagar?success=Conta%20paga%20e%20lançamento%20registrado.");
}

export async function cancelOccurrence(formData: FormData) {
  const { supabase, membership } = await getAuthenticatedContext();
  if (!membership) redirect("/dashboard");
  const { error } = await supabase.rpc("cancel_payable_occurrence", { target_occurrence_id: text(formData, "occurrence_id") });
  if (error) redirect("/dashboard/contas-a-pagar?error=Não%20foi%20possível%20cancelar.");
  revalidatePath("/dashboard/contas-a-pagar"); revalidatePath("/dashboard");
  redirect("/dashboard/contas-a-pagar?success=Vencimento%20cancelado.");
}
