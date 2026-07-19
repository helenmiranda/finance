"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createHousehold(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/dashboard?error=Informe%20o%20nome%20da%20família.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_household", { household_name: name });

  if (error) redirect(`/dashboard?error=${encodeURIComponent("Não foi possível criar o espaço familiar. Verifique se a migration foi aplicada.")}`);
  redirect("/dashboard");
}
