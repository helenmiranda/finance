"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedContext } from "@/lib/household";

export async function setPluggyConnectionState(formData: FormData) {
  const { supabase, membership, user } = await getAuthenticatedContext();
  if (!membership) redirect("/dashboard");
  const connectionId = String(formData.get("connection_id") ?? "");
  const nextState = String(formData.get("next_state") ?? "") === "active";
  if (!connectionId) redirect("/dashboard/privacidade?error=Conexão%20inválida.");
  const { data: connection } = await supabase.from("pluggy_items").select("id").eq("id", connectionId).eq("household_id", membership.household_id).eq("connected_by", user.id).maybeSingle();
  if (!connection) redirect("/dashboard/privacidade?error=Apenas%20quem%20vinculou%20a%20conexão%20pode%20alterá-la.");
  const { error } = await supabase.from("pluggy_items").update({ is_active: nextState }).eq("id", connectionId).eq("connected_by", user.id);
  if (error) redirect("/dashboard/privacidade?error=Não%20foi%20possível%20alterar%20a%20integração.%20A%20migration%20028%20foi%20aplicada%3F");
  revalidatePath("/dashboard/privacidade"); revalidatePath("/dashboard/contas"); revalidatePath("/dashboard");
  redirect(`/dashboard/privacidade?success=${nextState ? "Integração%20reativada." : "Integração%20desvinculada.%20O%20histórico%20foi%20preservado."}`);
}
