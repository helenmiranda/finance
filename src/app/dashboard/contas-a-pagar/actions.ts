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
  await supabase.rpc("suggest_payable_reconciliations", { target_household_id: membership.household_id });
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

export async function acceptReconciliation(formData: FormData) {
  const { supabase, membership } = await getAuthenticatedContext();
  if (!membership) redirect("/dashboard");
  const { error } = await supabase.rpc("accept_payable_reconciliation", { target_suggestion_id: text(formData, "suggestion_id") });
  if (error) redirect("/dashboard/contas-a-pagar?error=Esta%20conciliação%20não%20está%20mais%20disponível.");
  revalidatePath("/dashboard/contas-a-pagar"); revalidatePath("/dashboard");
  redirect("/dashboard/contas-a-pagar?success=Pagamento%20conciliado%20sem%20criar%20uma%20nova%20despesa.");
}

export async function rejectReconciliation(formData: FormData) {
  const { supabase, membership, user } = await getAuthenticatedContext();
  if (!membership) redirect("/dashboard");
  const { error } = await supabase.from("payable_reconciliation_suggestions").update({ status: "rejected", reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("id", text(formData, "suggestion_id")).eq("household_id", membership.household_id).eq("status", "pending");
  if (error) redirect("/dashboard/contas-a-pagar?error=Não%20foi%20possível%20ignorar%20a%20sugestão.");
  revalidatePath("/dashboard/contas-a-pagar");
  redirect("/dashboard/contas-a-pagar?success=Sugestão%20ignorada.");
}

export async function updateOccurrence(formData: FormData) {
  const { supabase, membership } = await getAuthenticatedContext();
  if (!membership) redirect("/dashboard");
  const amount = cents(text(formData, "amount"));
  const dueOn = text(formData, "due_on");
  if (!amount || !dueOn) redirect("/dashboard/contas-a-pagar?error=Confira%20o%20valor%20e%20o%20vencimento.");
  const { error } = await supabase.rpc("update_payable_occurrence", {
    target_occurrence_id: text(formData, "occurrence_id"),
    new_due_on: dueOn,
    new_amount_cents: amount,
  });
  if (error) redirect("/dashboard/contas-a-pagar?error=Não%20foi%20possível%20editar.%20A%20migration%20037%20foi%20aplicada?");
  await supabase.rpc("suggest_payable_reconciliations", { target_household_id: membership.household_id });
  revalidatePath("/dashboard/contas-a-pagar"); revalidatePath("/dashboard");
  redirect("/dashboard/contas-a-pagar?success=Vencimento%20atualizado.");
}

export async function cancelPayableSeries(formData: FormData) {
  const { supabase, membership } = await getAuthenticatedContext();
  if (!membership) redirect("/dashboard");
  if (text(formData, "confirmation") !== "CANCELAR") redirect("/dashboard/contas-a-pagar?error=Digite%20CANCELAR%20para%20confirmar.");
  const { error } = await supabase.rpc("cancel_payable_series", { target_payable_id: text(formData, "payable_id") });
  if (error) redirect("/dashboard/contas-a-pagar?error=Não%20foi%20possível%20cancelar%20a%20série.");
  revalidatePath("/dashboard/contas-a-pagar"); revalidatePath("/dashboard");
  redirect("/dashboard/contas-a-pagar?success=Parcelas%20futuras%20canceladas.%20O%20histórico%20foi%20preservado.");
}
