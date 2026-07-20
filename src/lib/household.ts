import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

type Membership = { household_id: string; role: string; joined_at: string; households: { name: string } | { name: string }[] | null };

export async function resolveMembership(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: memberships, error } = await supabase
    .from("household_members")
    .select("household_id, role, joined_at, households(name)")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true });
  if (error) throw new Error("Não foi possível carregar o espaço familiar.");
  if (!memberships?.length) return null;
  if (memberships.length === 1) return memberships[0] as Membership;

  const householdIds = memberships.map((membership) => membership.household_id);
  const { data: ownConnection } = await supabase
    .from("pluggy_items")
    .select("household_id")
    .eq("connected_by", userId)
    .eq("is_active", true)
    .in("household_id", householdIds)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (memberships.find((membership) => membership.household_id === ownConnection?.household_id) ?? memberships[0]) as Membership;
}

export const getAuthenticatedContext = cache(async function getAuthenticatedContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membership = await resolveMembership(supabase, user.id);

  return {
    supabase,
    user,
    membership,
  };
});
