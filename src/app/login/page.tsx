import Link from "next/link";
import { redirect } from "next/navigation";
import { login, signup } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { AuthSubmitButton } from "@/components/auth-submit-button";

type LoginPageProps = {
  searchParams: Promise<{ mode?: string; error?: string; message?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect("/dashboard");

  const params = await searchParams;
  const isSignup = params.mode === "signup";

  return (
    <main className="auth-shell">
      <section className="auth-story">
        <Link className="auth-brand" href="/">
          <span className="brand-mark">P</span>
          <span>Poupemos</span>
        </Link>
        <div>
          <p className="eyebrow">FINANÇAS EM FAMÍLIA</p>
          <h1>Dinheiro mais leve. Planos mais próximos.</h1>
          <p>Um espaço compartilhado para Helen e Ramon cuidarem do presente e construírem o futuro.</p>
        </div>
        <span className="auth-footnote">Seguro, privado e feito para vocês dois.</span>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <span className="auth-kicker">{isSignup ? "Comece agora" : "Bem-vinda de volta"}</span>
          <h2>{isSignup ? "Crie sua conta" : "Entre no Poupemos"}</h2>
          <p className="muted">
            {isSignup ? "Use seu e-mail pessoal para entrar no espaço da família." : "Acesse o painel financeiro da família."}
          </p>

          {params.error && <p className="form-message error" role="alert">{params.error}</p>}
          {params.message && <p className="form-message success" role="status">{params.message}</p>}

          <form action={isSignup ? signup : login}>
            {isSignup && (
              <label>
                Seu nome
                <input name="display_name" placeholder="Como devemos chamar você?" required />
              </label>
            )}
            <label>
              E-mail
              <input name="email" type="email" placeholder="voce@exemplo.com" autoComplete="email" required />
            </label>
            <label>
              Senha
              <input name="password" type="password" placeholder="Mínimo de 8 caracteres" autoComplete={isSignup ? "new-password" : "current-password"} minLength={8} required />
            </label>
            <AuthSubmitButton label={isSignup ? "Criar minha conta" : "Entrar"} pendingLabel={isSignup ? "Criando sua conta…" : "Entrando…"} />
          </form>

          <p className="auth-switch">
            {isSignup ? "Já tem uma conta?" : "Ainda não tem uma conta?"}{" "}
            <Link href={isSignup ? "/login" : "/login?mode=signup"}>
              {isSignup ? "Entrar" : "Criar conta"}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
