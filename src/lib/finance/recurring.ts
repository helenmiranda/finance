export type RecurringTransaction = {
  id: string;
  description: string;
  category: string;
  cadence: "weekly" | "monthly";
  averageCents: number;
  monthlyCents: number;
  annualCents: number;
  occurrences: number;
  lastDate: string;
  confidence: number;
  sourceId: string;
};

type SourceTransaction = {
  id: string;
  description: string;
  amount_cents: number;
  occurred_on: string;
  category: string;
  sourceId: string;
};

function normalizedDescription(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(?:compra|pagamento|pgto|debito|credito|parcela)\b/g, " ")
    .replace(/\b\d{2,}\b/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function daysBetween(first: string, second: string) {
  return Math.abs(new Date(`${second}T12:00:00`).getTime() - new Date(`${first}T12:00:00`).getTime()) / 86_400_000;
}

export function detectRecurringTransactions(transactions: SourceTransaction[]): RecurringTransaction[] {
  const groups = new Map<string, SourceTransaction[]>();
  transactions.forEach((transaction) => {
    const normalized = normalizedDescription(transaction.description);
    if (normalized.length < 3) return;
    const key = `${transaction.sourceId}:${normalized}`;
    groups.set(key, [...(groups.get(key) ?? []), transaction]);
  });

  const recurring: RecurringTransaction[] = [];
  groups.forEach((items, key) => {
    if (items.length < 3) return;
    const sorted = items.toSorted((first, second) => first.occurred_on.localeCompare(second.occurred_on));
    const gaps = sorted.slice(1).map((item, index) => daysBetween(sorted[index].occurred_on, item.occurred_on));
    const averageGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    const cadence = averageGap >= 5 && averageGap <= 10 && items.length >= 4
      ? "weekly"
      : averageGap >= 20 && averageGap <= 40
        ? "monthly"
        : null;
    if (!cadence) return;

    const averageCents = Math.round(items.reduce((sum, item) => sum + item.amount_cents, 0) / items.length);
    const averageVariation = items.reduce((sum, item) => sum + Math.abs(item.amount_cents - averageCents), 0) / items.length;
    const variationRatio = averageCents ? averageVariation / averageCents : 1;
    if (variationRatio > 0.35) return;

    const regularity = gaps.filter((gap) => cadence === "monthly" ? gap >= 20 && gap <= 40 : gap >= 5 && gap <= 10).length / gaps.length;
    const confidence = Math.round(Math.max(0, Math.min(1, regularity * .65 + (1 - variationRatio) * .35)) * 100);
    const monthlyCents = cadence === "weekly" ? Math.round(averageCents * 4.33) : averageCents;
    const last = sorted.at(-1)!;

    recurring.push({
      id: key,
      description: last.description,
      category: last.category,
      cadence,
      averageCents,
      monthlyCents,
      annualCents: monthlyCents * 12,
      occurrences: items.length,
      lastDate: last.occurred_on,
      confidence,
      sourceId: last.sourceId,
    });
  });

  return recurring.toSorted((first, second) => second.monthlyCents - first.monthlyCents);
}
