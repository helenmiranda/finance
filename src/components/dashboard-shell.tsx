import Link from "next/link";
import { logout } from "@/app/auth/actions";
import { PluggyAutoCheck } from "@/components/pluggy-auto-check";

type DashboardShellProps = {
  active: "overview" | "transactions" | "categories" | "accounts" | "cards" | "investments" | "imports" | "budgets" | "assistant";
  householdName?: string;
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
  { key: "assistant", href: "/dashboard/assistente", label: "Assistente IA" },
];

export function DashboardShell({ active, householdName = "Helen & Ramon", children }: DashboardShellProps) {
  return (
    <main className="shell">
      <PluggyAutoCheck />
      <aside className="sidebar">
        <Link className="brand" href="/dashboard"><span className="brand-mark">P</span><span>Poupemos</span></Link>
        <nav aria-label="Navegação principal">
          {links.map((link) => (
            <Link className={link.key === active ? "active" : undefined} href={link.href} key={link.key}>
              {link.label}
            </Link>
          ))}
        </nav>
        <Link className="family" href="/dashboard/familia"><small>Espaço familiar</small><strong>{householdName}</strong></Link>
        <form action={logout} className="logout-form"><button type="submit">Sair</button></form>
      </aside>
      {children}
    </main>
  );
}
