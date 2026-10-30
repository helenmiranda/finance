import Link from "next/link";

type AccountBalanceDatum = { id: string; name: string; color: string; balance: number };

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function AccountBalancesChart({ accounts }: { accounts: AccountBalanceDatum[] }) {
  const max = Math.max(...accounts.map((item) => Math.abs(item.balance)), 1);
  const total = accounts.reduce((sum, item) => sum + item.balance, 0);

  return <section className="finance-charts single-chart" aria-label="Saldo por conta">
    <article className="clean-panel category-chart-card">
      <div className="card-title"><div><h2>Saldo por conta</h2><p className="muted">Quanto há em cada conta agora · total {money.format(total / 100)}</p></div><Link href="/dashboard/contas">Ver contas</Link></div>
      {!accounts.length ? <p className="chart-empty">Nenhuma conta ativa cadastrada.</p> : <div className="category-bars">
        {accounts.map((account) => {
          const color = account.balance < 0 ? "#d03238" : account.color;
          return <Link className="category-bar-row" href={`/dashboard/transacoes?source=account:${account.id}`} aria-label={`Ver transações de ${account.name}`} key={account.id}>
            <div><span style={{ background: color }} /><strong>{account.name}</strong><small>{money.format(account.balance / 100)}</small></div>
            <div className="category-bar-track"><span style={{ width: `${Math.max(3, Math.abs(account.balance) / max * 100)}%`, background: color }} /></div>
          </Link>;
        })}
      </div>}
    </article>
  </section>;
}
