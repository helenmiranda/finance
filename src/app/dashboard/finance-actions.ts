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

export async function addCategory(formData: FormData) {
  const { supabase, membership } = await getAuthenticatedContext();
  if (!membership) redirect("/dashboard");
  const name = text(formData, "name");
  const kind = text(formData, "kind");
  const parentId = optionalText(formData, "parent_id");

  if (!name || !["income", "expense"].includes(kind)) {
    redirect("/dashboard/categorias?error=Confira%20os%20dados%20da%20categoria.");
  }

  if (parentId) {
    const { data: parent } = await supabase.from("categories").select("id, kind")
      .eq("id", parentId).eq("household_id", membership.household_id).maybeSingle();
    if (!parent || parent.kind !== kind) redirect("/dashboard/categorias?error=Categoria%20principal%20inválida.");
  }

  const { error } = await supabase.from("categories").insert({
    household_id: membership.household_id,
    parent_id: parentId,
    name,
    kind,
    color: text(formData, "color") || "#9fe870",
    icon: optionalText(formData, "icon"),
  });

  if (error) redirect(`/dashboard/categorias?error=${encodeURIComponent("Não foi possível adicionar. Talvez a categoria já exista.")}`);
  revalidatePath("/dashboard/categorias");
  redirect("/dashboard/categorias?success=Categoria%20adicionada.");
}

export async function addTransaction(formData: FormData) {
  const { supabase, membership, user } = await getAuthenticatedContext();
  if (!membership) redirect("/dashboard");
  const type = text(formData, "type");
  const description = text(formData, "description");
  const amount = cents(text(formData, "amount"));
  const occurredOn = text(formData, "occurred_on");
  const categoryId = optionalText(formData, "category_id");
  const paymentSource = text(formData, "payment_source");
  const [sourceType, sourceId] = paymentSource.split(":");

  if (!description || !amount || !occurredOn || !["income", "expense"].includes(type) || !sourceId || !["account", "card"].includes(sourceType)) {
    redirect("/dashboard/transacoes?error=Confira%20os%20dados%20do%20lançamento.");
  }
  if (type === "income" && sourceType === "card") {
    redirect("/dashboard/transacoes?error=Receitas%20devem%20entrar%20em%20uma%20conta.");
  }

  const sourceTable = sourceType === "account" ? "accounts" : "credit_cards";
  const { data: source } = await supabase.from(sourceTable).select("id")
    .eq("id", sourceId).eq("household_id", membership.household_id).maybeSingle();
  if (!source) redirect("/dashboard/transacoes?error=Conta%20ou%20cartão%20inválido.");

  if (categoryId) {
    const { data: category } = await supabase.from("categories").select("id, kind")
      .eq("id", categoryId).eq("household_id", membership.household_id).maybeSingle();
    if (!category || category.kind !== type) redirect("/dashboard/transacoes?error=Categoria%20incompatível%20com%20o%20lançamento.");
  }

  const { error } = await supabase.from("transactions").insert({
    household_id: membership.household_id,
    account_id: sourceType === "account" ? sourceId : null,
    credit_card_id: sourceType === "card" ? sourceId : null,
    category_id: categoryId,
    created_by: user.id,
    type,
    description,
    amount_cents: amount,
    occurred_on: occurredOn,
    notes: optionalText(formData, "notes"),
  });

  if (error) redirect(`/dashboard/transacoes?error=${encodeURIComponent("Não foi possível salvar o lançamento.")}`);
  revalidatePath("/dashboard/transacoes");
  revalidatePath("/dashboard");
  redirect("/dashboard/transacoes?success=Lançamento%20adicionado.");
}
