"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAuthenticatedContext } from "@/lib/household";
import { parseCsv, parseOfx } from "@/lib/imports/parser";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function amountInCents(value: string) {
  const normalized = value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : null;
}

export async function uploadImport(formData: FormData) {
  const { supabase, membership, user } = await getAuthenticatedContext();
  if (!membership) redirect("/dashboard");

  const file = formData.get("file");
  const target = String(formData.get("target") ?? "");
  const [targetType, targetId] = target.split(":");

  if (!(file instanceof File) || file.size === 0 || file.size > MAX_FILE_SIZE) {
    redirect("/dashboard/importacoes?error=Escolha%20um%20arquivo%20de%20até%205%20MB.");
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !["csv", "ofx"].includes(extension)) {
    redirect("/dashboard/importacoes?error=Formato%20não%20suportado.%20Use%20CSV%20ou%20OFX.");
  }
  if (!targetId || !["account", "card"].includes(targetType)) {
    redirect("/dashboard/importacoes?error=Selecione%20uma%20conta%20ou%20cartão.");
  }

  const targetTable = targetType === "account" ? "accounts" : "credit_cards";
  const { data: validTarget } = await supabase.from(targetTable).select("id")
    .eq("id", targetId).eq("household_id", membership.household_id).maybeSingle();
  if (!validTarget) redirect("/dashboard/importacoes?error=Conta%20ou%20cartão%20inválido.");

  const safeName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-");
  const storagePath = `${membership.household_id}/${user.id}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from("financial-imports").upload(storagePath, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (uploadError) redirect(`/dashboard/importacoes?error=${encodeURIComponent("Não foi possível enviar o arquivo. A migration de importação foi aplicada?")}`);

  const { data: importRecord, error: importError } = await supabase.from("imports").insert({
    household_id: membership.household_id,
    account_id: targetType === "account" ? targetId : null,
    credit_card_id: targetType === "card" ? targetId : null,
    imported_by: user.id,
    original_filename: file.name,
    storage_path: storagePath,
    file_format: extension,
    status: "processing",
  }).select("id").single();

  if (importError || !importRecord) {
    await supabase.storage.from("financial-imports").remove([storagePath]);
    redirect("/dashboard/importacoes?error=Não%20foi%20possível%20iniciar%20a%20importação.");
  }

  try {
    const content = await file.text();
    const rows = extension === "csv" ? parseCsv(content) : parseOfx(content);
    if (rows.length > 5000) throw new Error("O arquivo possui mais de 5.000 movimentações.");

    const payload = rows.map((row) => ({ ...row, import_id: importRecord.id, household_id: membership.household_id }));
    const { error: rowsError } = await supabase.from("import_rows").insert(payload);
    if (rowsError) throw rowsError;

    await supabase.from("imports").update({ status: "review", row_count: rows.length }).eq("id", importRecord.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível interpretar o arquivo.";
    await supabase.from("imports").update({ status: "failed", error_message: message }).eq("id", importRecord.id);
  }

  redirect(`/dashboard/importacoes/${importRecord.id}`);
}

export async function updateImportRow(formData: FormData) {
  const { supabase, membership } = await getAuthenticatedContext();
  if (!membership) redirect("/dashboard");
  const rowId = text(formData, "row_id");
  const importId = text(formData, "import_id");
  const reviewStatus = text(formData, "review_status");

  if (reviewStatus === "ignored") {
    const { error } = await supabase.from("import_rows").update({ review_status: "ignored" })
      .eq("id", rowId).eq("import_id", importId).eq("household_id", membership.household_id);
    if (error) redirect(`/dashboard/importacoes/${importId}?error=${encodeURIComponent("Não foi possível ignorar a linha.")}`);
    revalidatePath(`/dashboard/importacoes/${importId}`);
    redirect(`/dashboard/importacoes/${importId}?success=Linha%20ignorada.`);
  }

  const occurredOn = text(formData, "occurred_on");
  const description = text(formData, "description");
  const amount = amountInCents(text(formData, "amount"));
  const suggestedType = text(formData, "suggested_type");
  const categoryId = text(formData, "category_id") || null;
  if (!occurredOn || !description || !amount || !["income", "expense"].includes(suggestedType)) {
    redirect(`/dashboard/importacoes/${importId}?error=${encodeURIComponent("Confira os dados da linha.")}`);
  }

  if (categoryId) {
    const { data: category } = await supabase.from("categories").select("id, kind")
      .eq("id", categoryId).eq("household_id", membership.household_id).maybeSingle();
    if (!category || category.kind !== suggestedType) {
      redirect(`/dashboard/importacoes/${importId}?error=${encodeURIComponent("A categoria não corresponde ao tipo da movimentação.")}`);
    }
  }

  const { error } = await supabase.from("import_rows").update({
    occurred_on: occurredOn,
    description,
    amount_cents: amount,
    suggested_type: suggestedType,
    category_id: categoryId,
    parse_error: null,
    review_status: "ready",
  }).eq("id", rowId).eq("import_id", importId).eq("household_id", membership.household_id);

  if (error) redirect(`/dashboard/importacoes/${importId}?error=${encodeURIComponent("Não foi possível salvar a linha.")}`);
  revalidatePath(`/dashboard/importacoes/${importId}`);
  redirect(`/dashboard/importacoes/${importId}?success=Linha%20atualizada.`);
}

export async function confirmImport(formData: FormData) {
  const { supabase, membership } = await getAuthenticatedContext();
  if (!membership) redirect("/dashboard");
  const importId = text(formData, "import_id");
  if (!importId) redirect("/dashboard/importacoes");

  const { data, error } = await supabase.rpc("confirm_import", { target_import_id: importId });
  if (error) redirect(`/dashboard/importacoes/${importId}?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transacoes");
  revalidatePath("/dashboard/cartoes");
  revalidatePath("/dashboard/importacoes");
  revalidatePath(`/dashboard/importacoes/${importId}`);
  const result = data as { confirmed?: number; duplicates?: number } | null;
  redirect(`/dashboard/importacoes/${importId}?success=${encodeURIComponent(`${result?.confirmed ?? 0} movimentações importadas; ${result?.duplicates ?? 0} duplicadas ignoradas.`)}`);
}
