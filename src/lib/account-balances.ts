type AccountBalance = { id: string; initial_balance_cents: number; current_balance_cents: number | null };
type CashTransaction = { account_id: string | null; type: string; amount_cents: number; transfer_direction?: string | null };

function transactionEffect(transaction: CashTransaction) {
  if (transaction.type === "income") return transaction.amount_cents;
  if (transaction.type === "expense" || transaction.type === "card_payment") return -transaction.amount_cents;
  return transaction.transfer_direction === "in" ? transaction.amount_cents : -transaction.amount_cents;
}

export function calculateAvailableBalance(accounts: AccountBalance[], transactions: CashTransaction[], connectedAccountIds: string[]) {
  const connected = new Set(connectedAccountIds);
  const movements = new Map<string, number>();
  for (const transaction of transactions) {
    if (!transaction.account_id || connected.has(transaction.account_id)) continue;
    movements.set(transaction.account_id, (movements.get(transaction.account_id) ?? 0) + transactionEffect(transaction));
  }
  return accounts.reduce((total, account) => {
    if (connected.has(account.id)) return total + (account.current_balance_cents ?? account.initial_balance_cents);
    return total + account.initial_balance_cents + (movements.get(account.id) ?? 0);
  }, 0);
}
