import Link from "next/link";
import { logout } from "@/app/auth/actions";
import { PluggyAutoCheck } from "@/components/pluggy-auto-check";
import { getAuthenticatedContext } from "@/lib/household";

type DashboardShellProps = {
  active: "overview" | "transactions" | "categories" | "accounts" | "cards" | "investments" | "imports" | "budgets" | "alerts" | "assistant" | "privacy";
  children: React.ReactNode;
};

const links = [
  { key: "overview", href: "/dashboard", label: "Visão geral" },
  { key: "transactions", href: "/dashboard/transacoes", label: "Transações" },
  { key: "categories", href: "/dashboard/categorias", label: "Categorias" },
  { key: "accounts", href: "/dashboard/contas", label: "Contas" },
  { key: "cards", href: "/dashboard/cartoes", label: "Cartões" },
  { key: "investments", href: "/dashboard/patrimonio", label: "Patrimônio" },
  { key: "imports", href: "/dashboard/importacoes", label: "Importações" },
  { key: "budgets", href: "/dashboard/orcamentos", label: "Orçamentos" },
  { key: "alerts", href: "/dashboard/alertas", label: "Alertas" },
  { key: "assistant", href: "/dashboard/assistente", label: "Assistente IA" },
  { key: "privacy", href: "/dashboard/privacidade", label: "Dados e privacidade" },
];

function relatedHousehold(value: { name: string } | { name: string }[] | null) {
  return Array.isArray(value) ? value[0] : value;
}

export async function DashboardShell({ active, children }: DashboardShellProps) {
  const { membership } = await getAuthenticatedContext();
  const householdName = relatedHousehold(membership?.households ?? null)?.name ?? "Seu espaço";
  const navigation = links.map((link) => (
    <Link className={link.key === active ? "active" : undefined} href={link.href} key={link.key}>
      {link.label}
    </Link>
  ));
  return (
    <main className="shell">
      <PluggyAutoCheck />
      <aside className="sidebar">
        <Link className="brand" href="/dashboard"><span className="brand-mark">P</span><span>Poupemos</span></Link>
        <nav aria-label="Navegação principal">{navigation}</nav>
        <Link className="family" href="/dashboard/familia"><small>Espaço familiar</small><strong>{householdName}</strong></Link>
        <form action={logout} className="logout-form"><button type="submit">Sair</button></form>
        <details className="mobile-menu">
          <summary aria-label="Abrir navegação"><span>Menu</span><span aria-hidden="true">☰</span></summary>
          <div className="mobile-menu-panel">
            <nav aria-label="Navegação móvel">{navigation}</nav>
            <Link className="family" href="/dashboard/familia"><small>Espaço familiar</small><strong>{householdName}</strong></Link>
            <form action={logout} className="logout-form"><button type="submit">Sair</button></form>
          </div>
        </details>
      </aside>
      {children}
    </main>
  );
}
