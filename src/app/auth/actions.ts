"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

function value(formData: FormData, field: string) {
  return String(formData.get(field) ?? "").trim();
}

export async function login(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: value(formData, "email").toLowerCase(),
    password: value(formData, "password"),
  });

  if (error) redirect(`/login?error=${encodeURIComponent("E-mail ou senha inválidos.")}`);
  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();
  const email = value(formData, "email").toLowerCase();
  const password = value(formData, "password");
  const displayName = value(formData, "display_name");

  if (password.length < 8) {
    redirect(`/login?mode=signup&error=${encodeURIComponent("Use uma senha com pelo menos 8 caracteres.")}`);
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: `${getSiteUrl()}/auth/callback`,
    },
  });

  if (error) redirect(`/login?mode=signup&error=${encodeURIComponent(error.message)}`);
  redirect(`/login?message=${encodeURIComponent("Confira seu e-mail para confirmar o cadastro.")}`);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
