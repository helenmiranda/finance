const knownMerchants = [
  "uber", "99app", "ifood", "rappi", "amazon", "mercado livre", "mercadolivre", "shopee",
  "netflix", "spotify", "youtube", "google", "apple", "disney plus", "globoplay",
  "carrefour", "assai", "atacadao", "pao de acucar", "droga raia", "drogasil", "shell",
];

const merchantNoise = new Set(["compra", "pagamento", "pag", "pgto", "pix", "debito", "credito", "cartao", "visa", "mastercard", "elo", "br", "sa", "ltda", "me"]);

export function normalizedMerchantText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, " ").trim();
}

export function merchantCandidate(value: string) {
  const normalized = normalizedMerchantText(value);
  const known = knownMerchants.find((merchant) => normalized.includes(merchant));
  if (known) return { pattern: known, trusted: true };
  const words = normalized.split(" ").filter((word) => word.length >= 3 && !/^\d+$/.test(word) && !merchantNoise.has(word));
  const pattern = [...new Set(words)].slice(0, 2).join(" ");
  return pattern.length >= 5 ? { pattern, trusted: false } : null;
}

export function learnableMerchantPatterns(descriptions: string[]) {
  const candidates = descriptions.map(merchantCandidate).filter((candidate): candidate is { pattern: string; trusted: boolean } => Boolean(candidate));
  const frequency = candidates.reduce((counts, candidate) => counts.set(candidate.pattern, (counts.get(candidate.pattern) ?? 0) + 1), new Map<string, number>());
  return [...new Set(candidates.filter((candidate) => candidate.trusted || (frequency.get(candidate.pattern) ?? 0) >= 2).map((candidate) => candidate.pattern))];
}
