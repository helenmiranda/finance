"use server";

import { redirect } from "next/navigation";
import { getAuthenticatedContext } from "@/lib/household";
import { parseCsv, parseOfx } from "@/lib/imports/parser";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

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
