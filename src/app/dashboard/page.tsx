import { DashboardShell } from "@/components/dashboard-shell";
import { getAuthenticatedContext } from "@/lib/household";
import { createHousehold } from "./actions";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const summary = [
  { label: "Saldo disponível", value: 12480, tone: "positive" },
  { label: "Receitas do mês", value: 9200, tone: "positive" },
  { label: "Despesas do mês", value: 5840, tone: "negative" },
  { label: "Faturas em aberto", value: 2170, tone: "warning" },
];
const transactions = [
  { description: "Supermercado", category: "Alimentação", value: -286.4 },
  { description: "Salário", category: "Receita", value: 6200 },
  { description: "Conta de energia", category: "Moradia", value: -194.72 },
];

type DashboardProps = { searchParams: Promise<{ error?: string }> };

export default async function Dashboard({ searchParams }: DashboardProps) {
  const { user, membership: household } = await getAuthenticatedContext();
  const params = await searchParams;
  const firstName = String(user.user_metadata.display_name ?? user.email?.split("@")[0] ?? "").split(" ")[0];

  if (!household) {
    return (
      <main className="onboarding-shell">
        <section className="onboarding-card card">
          <span className="brand-mark">P</span>
          <p className="eyebrow">PRIMEIRO PASSO</p>
          <h1>Vamos criar o espaço da família.</h1>
          <p className="muted">Depois você poderá convidar o Ramon e cadastrar contas e cartões.</p>
          {params.error && <p className="form-message error">{params.error}</p>}
          <form action={createHousehold}>
            <label>
              Nome do espaço
              <input name="name" defaultValue="Helen & Ramon" required />
            </label>
            <button type="submit">Criar espaço familiar</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <DashboardShell active="overview">
      <section className="content" id="visao-geral">
        <header>
          <div><p className="eyebrow">JULHO DE 2026</p><h1>Olá, {firstName}!</h1><p className="muted">Aqui está o resumo financeiro da família.</p></div>
          <div className="header-actions"><button className="icon-button" aria-label="Abrir notificações">●</button><button>+ Adicionar lançamento</button></div>
        </header>
        <div className="summary-grid">
          {summary.map((item) => <article className={`card summary-card ${item.tone}`} key={item.label}><span className="muted">{item.label}</span><strong>{money.format(item.value)}</strong><span className="summary-detail">Atualizado agora</span></article>)}
        </div>
        <div className="main-grid">
          <article className="card chart-card"><div className="card-title"><div><h2>Fluxo do mês</h2><p className="muted">Receitas e despesas acumuladas</p></div><span className="badge">Visão mensal</span></div><div className="chart-placeholder" role="img" aria-label="Gráfico de fluxo mensal"><div className="chart-line" /></div></article>
          <article className="card assistant" id="assistente"><div className="assistant-heading"><span className="assistant-icon">✦</span><span className="badge">Insight novo</span></div><h2>Assistente financeiro</h2><p>Seus gastos com alimentação estão 12% acima da média dos últimos meses.</p><button className="secondary">Ver análise</button></article>
        </div>
        <article className="card transactions" id="transacoes"><div className="card-title"><div><h2>Últimas transações</h2><p className="muted">Movimentações recentes da família</p></div><a href="#todas">Ver todas</a></div><div className="transaction-list">{transactions.map((transaction) => <div className="transaction" key={transaction.description}><span className="transaction-icon">{transaction.description.slice(0, 1)}</span><div><strong>{transaction.description}</strong><small>{transaction.category}</small></div><strong className={transaction.value > 0 ? "positive" : "negative"}>{money.format(transaction.value)}</strong></div>)}</div></article>
      </section>
    </DashboardShell>
  );
}
