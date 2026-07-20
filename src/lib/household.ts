import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export const getAuthenticatedContext = cache(async function getAuthenticatedContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships, error } = await supabase
    .from("household_members")
    .select("household_id, role, households(name)")
    .limit(1);

  if (error) throw new Error("Não foi possível carregar o espaço familiar.");

  return {
    supabase,
    user,
    membership: memberships?.[0] ?? null,
  };
});
