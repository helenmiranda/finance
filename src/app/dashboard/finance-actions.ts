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
  const installmentCount = Number(text(formData, "installment_count") || "1");

  if (!description || !amount || !occurredOn || !["income", "expense"].includes(type) || !sourceId || !["account", "card"].includes(sourceType)) {
    redirect("/dashboard/transacoes?error=Confira%20os%20dados%20do%20lançamento.");
  }
  if (type === "income" && sourceType === "card") {
    redirect("/dashboard/transacoes?error=Receitas%20devem%20entrar%20em%20uma%20conta.");
  }
  if (!Number.isInteger(installmentCount) || installmentCount < 1 || installmentCount > 60) {
    redirect("/dashboard/transacoes?error=Número%20de%20parcelas%20inválido.");
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

  const notes = optionalText(formData, "notes");
  const { error } = sourceType === "card"
    ? await supabase.rpc("create_card_purchase", {
        target_card_id: sourceId,
        target_category_id: categoryId,
        purchase_description: description,
        purchase_amount_cents: amount,
        purchase_date: occurredOn,
        installment_total: installmentCount,
        purchase_notes: notes,
      })
    : await supabase.from("transactions").insert({
        household_id: membership.household_id,
        account_id: sourceId,
        credit_card_id: null,
        category_id: categoryId,
        created_by: user.id,
        type,
        description,
        amount_cents: amount,
        occurred_on: occurredOn,
        notes,
      });

  if (error) redirect(`/dashboard/transacoes?error=${encodeURIComponent("Não foi possível salvar o lançamento.")}`);
  revalidatePath("/dashboard/transacoes");
  revalidatePath("/dashboard");
  redirect("/dashboard/transacoes?success=Lançamento%20adicionado.");
}

export async function addTransfer(formData: FormData) {
  const { supabase, membership } = await getAuthenticatedContext();
  if (!membership) redirect("/dashboard");
  const sourceAccountId = text(formData, "source_account_id");
  const destinationAccountId = text(formData, "destination_account_id");
  const amount = cents(text(formData, "amount"));
  const transferDate = text(formData, "occurred_on");
  const description = text(formData, "description") || "Transferência";

  if (!sourceAccountId || !destinationAccountId || sourceAccountId === destinationAccountId || !amount || !transferDate) {
    redirect("/dashboard/transacoes?error=Confira%20os%20dados%20da%20transferência.");
  }

  const { error } = await supabase.rpc("create_transfer", {
    source_account_id: sourceAccountId,
    destination_account_id: destinationAccountId,
    transfer_amount_cents: amount,
    transfer_date: transferDate,
    transfer_description: description,
  });

  if (error) redirect(`/dashboard/transacoes?error=${encodeURIComponent("Não foi possível transferir. A nova migration já foi aplicada?")}`);
  revalidatePath("/dashboard/transacoes");
  revalidatePath("/dashboard");
  redirect("/dashboard/transacoes?success=Transferência%20registrada.");
}

export async function payStatement(formData: FormData) {
  const { supabase, membership } = await getAuthenticatedContext();
  if (!membership) redirect("/dashboard");
  const statementId = text(formData, "statement_id");
  const accountId = text(formData, "account_id");
  const paymentDate = text(formData, "payment_date");

  if (!statementId || !accountId || !paymentDate) {
    redirect("/dashboard/cartoes?error=Confira%20os%20dados%20do%20pagamento.");
  }

  const { error } = await supabase.rpc("pay_card_statement", {
    target_statement_id: statementId,
    source_account_id: accountId,
    payment_date: paymentDate,
  });

  if (error) redirect(`/dashboard/cartoes?error=${encodeURIComponent("Não foi possível pagar a fatura. A nova migration já foi aplicada?")}`);
  revalidatePath("/dashboard/cartoes");
  revalidatePath("/dashboard/transacoes");
  revalidatePath("/dashboard");
  redirect("/dashboard/cartoes?success=Fatura%20marcada%20como%20paga.");
}

export async function addCategorizationRule(formData: FormData) {
  const { supabase, membership } = await getAuthenticatedContext();
  if (!membership) redirect("/dashboard");
  const name = text(formData, "name");
  const pattern = text(formData, "pattern");
  const matchType = text(formData, "match_type");
  const categoryId = text(formData, "category_id");
  const priority = Number(text(formData, "priority") || "100");

  if (!name || !pattern || !categoryId || !["contains", "starts_with", "exact"].includes(matchType)
    || !Number.isInteger(priority) || priority < 1 || priority > 1000) {
    redirect("/dashboard/regras?error=Confira%20os%20dados%20da%20regra.");
  }

  const { data: category } = await supabase.from("categories").select("id")
    .eq("id", categoryId).eq("household_id", membership.household_id).maybeSingle();
  if (!category) redirect("/dashboard/regras?error=Categoria%20inválida.");

  const { error } = await supabase.from("categorization_rules").insert({
    household_id: membership.household_id,
    category_id: categoryId,
    name,
    pattern,
    match_type: matchType,
    priority,
  });

  if (error) redirect(`/dashboard/regras?error=${encodeURIComponent("Não foi possível criar a regra. A nova migration foi aplicada?")}`);
  revalidatePath("/dashboard/regras");
  redirect("/dashboard/regras?success=Regra%20adicionada.");
}

export async function deleteCategorizationRule(formData: FormData) {
  const { supabase, membership } = await getAuthenticatedContext();
  if (!membership) redirect("/dashboard");
  const ruleId = text(formData, "rule_id");
  const { error } = await supabase.from("categorization_rules").delete()
    .eq("id", ruleId).eq("household_id", membership.household_id);
  if (error) redirect("/dashboard/regras?error=Não%20foi%20possível%20remover%20a%20regra.");
  revalidatePath("/dashboard/regras");
  redirect("/dashboard/regras?success=Regra%20removida.");
}

export async function saveBudget(formData: FormData) {
  const { supabase, membership } = await getAuthenticatedContext();
  if (!membership) redirect("/dashboard");
  const categoryId = text(formData, "category_id");
  const referenceMonth = text(formData, "reference_month");
  const limit = cents(text(formData, "limit"));

  if (!categoryId || !/^\d{4}-\d{2}-01$/.test(referenceMonth) || !limit) {
    redirect(`/dashboard/orcamentos?month=${referenceMonth.slice(0, 7)}&error=${encodeURIComponent("Confira os dados do orçamento.")}`);
  }

  const { data: category } = await supabase.from("categories").select("id, kind")
    .eq("id", categoryId).eq("household_id", membership.household_id).eq("is_active", true).maybeSingle();
  if (!category || category.kind !== "expense") {
    redirect(`/dashboard/orcamentos?month=${referenceMonth.slice(0, 7)}&error=${encodeURIComponent("Escolha uma categoria de despesa.")}`);
  }

  const { error } = await supabase.from("budgets").upsert({
    household_id: membership.household_id,
    category_id: categoryId,
    reference_month: referenceMonth,
    limit_cents: limit,
  }, { onConflict: "household_id,category_id,reference_month" });

  if (error) redirect(`/dashboard/orcamentos?month=${referenceMonth.slice(0, 7)}&error=${encodeURIComponent("Não foi possível salvar o orçamento.")}`);
  revalidatePath("/dashboard/orcamentos");
  revalidatePath("/dashboard");
  redirect(`/dashboard/orcamentos?month=${referenceMonth.slice(0, 7)}&success=${encodeURIComponent("Orçamento salvo.")}`);
}

export async function deleteBudget(formData: FormData) {
  const { supabase, membership } = await getAuthenticatedContext();
  if (!membership) redirect("/dashboard");
  const budgetId = text(formData, "budget_id");
  const month = text(formData, "month");
  const { error } = await supabase.from("budgets").delete()
    .eq("id", budgetId).eq("household_id", membership.household_id);
  if (error) redirect(`/dashboard/orcamentos?month=${month}&error=${encodeURIComponent("Não foi possível remover o orçamento.")}`);
  revalidatePath("/dashboard/orcamentos");
  redirect(`/dashboard/orcamentos?month=${month}&success=${encodeURIComponent("Orçamento removido.")}`);
}
