"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedContext } from "@/lib/household";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalText(formData: FormData, key: string) {
  return text(formData, key) || null;
}

function cents(value: string) {
  if (!value) return null;
  const normalized = value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : null;
}

function day(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 31 ? parsed : null;
}

export async function addAccount(formData: FormData) {
  const { supabase, membership } = await getAuthenticatedContext();
  if (!membership) redirect("/dashboard");

  const name = text(formData, "name");
  const type = text(formData, "type");
  if (!name || !["checking", "savings", "cash", "investment", "other"].includes(type)) {
    redirect("/dashboard/contas?error=Confira%20os%20dados%20da%20conta.");
  }

  const { error } = await supabase.from("accounts").insert({
    household_id: membership.household_id,
    name,
    institution_name: optionalText(formData, "institution_name"),
    type,
    initial_balance_cents: cents(text(formData, "initial_balance")) ?? 0,
    color: text(formData, "color") || "#9fe870",
  });

  if (error) redirect(`/dashboard/contas?error=${encodeURIComponent("Não foi possível adicionar a conta.")}`);
  revalidatePath("/dashboard/contas");
  redirect("/dashboard/contas?success=Conta%20adicionada.");
}

export async function addCreditCard(formData: FormData) {
  const { supabase, membership } = await getAuthenticatedContext();
  if (!membership) redirect("/dashboard");

  const name = text(formData, "name");
  const lastFour = optionalText(formData, "last_four_digits");
  const closingDay = day(text(formData, "closing_day"));
  const dueDay = day(text(formData, "due_day"));

  if (!name || !closingDay || !dueDay || (lastFour && !/^\d{4}$/.test(lastFour))) {
    redirect("/dashboard/cartoes?error=Confira%20os%20dados%20do%20cartão.");
  }

  const paymentAccountId = optionalText(formData, "payment_account_id");
  if (paymentAccountId) {
    const { data: account } = await supabase
      .from("accounts")
      .select("id")
      .eq("id", paymentAccountId)
      .eq("household_id", membership.household_id)
      .maybeSingle();
    if (!account) redirect("/dashboard/cartoes?error=Conta%20de%20pagamento%20inválida.");
  }

  const { error } = await supabase.from("credit_cards").insert({
    household_id: membership.household_id,
    payment_account_id: paymentAccountId,
    name,
    issuer: optionalText(formData, "issuer"),
    last_four_digits: lastFour,
    cardholder_name: optionalText(formData, "cardholder_name"),
    credit_limit_cents: cents(text(formData, "credit_limit")),
    closing_day: closingDay,
    due_day: dueDay,
    color: text(formData, "color") || "#163300",
  });

  if (error) redirect(`/dashboard/cartoes?error=${encodeURIComponent("Não foi possível adicionar o cartão.")}`);
  revalidatePath("/dashboard/cartoes");
  redirect("/dashboard/cartoes?success=Cartão%20adicionado.");
}
