import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveMembership } from "@/lib/household";

type DeleteRequest = { mode?: "household" | "account"; password?: string; confirmation?: string };

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await request.json().catch(() => null) as DeleteRequest | null;
  if (!body?.mode || !body.password || !body.confirmation) return NextResponse.json({ error: "Preencha a senha e a confirmação." }, { status: 400 });

  const { error: passwordError } = await supabase.auth.signInWithPassword({ email: user.email, password: body.password });
  if (passwordError) return NextResponse.json({ error: "Senha incorreta." }, { status: 403 });
  const admin = createAdminClient();

  if (body.mode === "household") {
    const membership = await resolveMembership(supabase, user.id);
    if (!membership) return NextResponse.json({ error: "Espaço familiar não encontrado." }, { status: 404 });
    const [{ data: files }, { data: covers }] = await Promise.all([
      supabase.from("imports").select("storage_path").eq("household_id", membership.household_id),
      supabase.from("dreams").select("cover_path").eq("household_id", membership.household_id).not("cover_path", "is", null),
    ]);
    const { error } = await supabase.rpc("delete_household_secure", { target_household_id: membership.household_id, confirmation_name: body.confirmation });
    if (error) return NextResponse.json({ error: error.message }, { status: 422 });
    const paths = (files ?? []).map((file) => file.storage_path).filter(Boolean);
    if (paths.length) await admin.storage.from("financial-imports").remove(paths);
    const coverPaths = (covers ?? []).map((dream) => dream.cover_path).filter((path): path is string => Boolean(path));
    if (coverPaths.length) await admin.storage.from("dream-covers").remove(coverPaths);
    return NextResponse.json({ success: true, redirectTo: "/dashboard" });
  }

  if (body.confirmation !== "EXCLUIR MINHA CONTA") return NextResponse.json({ error: "Digite EXCLUIR MINHA CONTA para confirmar." }, { status: 400 });
  const { data: ownedMemberships } = await supabase.from("household_members").select("household_id, role").eq("user_id", user.id).eq("role", "owner");
  const ownedIds = (ownedMemberships ?? []).map((membership) => membership.household_id);
  const [{ data: files }, { data: covers }] = ownedIds.length ? await Promise.all([
    supabase.from("imports").select("storage_path").in("household_id", ownedIds),
    supabase.from("dreams").select("cover_path").in("household_id", ownedIds).not("cover_path", "is", null),
  ]) : [{ data: [] }, { data: [] }];
  const { error: prepareError } = await supabase.rpc("prepare_account_deletion");
  if (prepareError) return NextResponse.json({ error: prepareError.message }, { status: 422 });
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return NextResponse.json({ error: "Não foi possível concluir a exclusão da conta." }, { status: 502 });
  const paths = (files ?? []).map((file) => file.storage_path).filter(Boolean);
  if (paths.length) await admin.storage.from("financial-imports").remove(paths);
  const coverPaths = (covers ?? []).map((dream) => dream.cover_path).filter((path): path is string => Boolean(path));
  if (coverPaths.length) await admin.storage.from("dream-covers").remove(coverPaths);
  return NextResponse.json({ success: true, redirectTo: "/login" });
}
