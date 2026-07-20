type CardBrandStyle = { background: string; foreground: string; label: string };

const brands: Array<{ terms: string[]; style: CardBrandStyle }> = [
  { terms: ["nubank", "nu pagamentos"], style: { background: "linear-gradient(135deg, #820ad1, #5f079e)", foreground: "#fff", label: "Nubank" } },
  { terms: ["banco inter", "inter bank", "intermedium"], style: { background: "linear-gradient(135deg, #ff7a00, #e65300)", foreground: "#fff", label: "Inter" } },
  { terms: ["itau", "itaú", "unibanco"], style: { background: "linear-gradient(135deg, #ec7000 0%, #d94f00 60%, #173f73 100%)", foreground: "#fff", label: "Itaú" } },
  { terms: ["santander"], style: { background: "linear-gradient(135deg, #ec0000, #aa0000)", foreground: "#fff", label: "Santander" } },
  { terms: ["bradesco"], style: { background: "linear-gradient(135deg, #cc092f, #8e0923)", foreground: "#fff", label: "Bradesco" } },
  { terms: ["c6 bank", "banco c6"], style: { background: "linear-gradient(135deg, #242424, #050505)", foreground: "#fff", label: "C6 Bank" } },
  { terms: ["banco do brasil", "ourocard"], style: { background: "linear-gradient(135deg, #ffe600, #f5c400)", foreground: "#14284b", label: "Banco do Brasil" } },
  { terms: ["caixa economica", "caixa"], style: { background: "linear-gradient(135deg, #006bae, #00a5d9)", foreground: "#fff", label: "Caixa" } },
  { terms: ["mercado pago"], style: { background: "linear-gradient(135deg, #009ee3, #007eb5)", foreground: "#fff", label: "Mercado Pago" } },
  { terms: ["picpay"], style: { background: "linear-gradient(135deg, #11c76f, #07964e)", foreground: "#fff", label: "PicPay" } },
  { terms: ["neon"], style: { background: "linear-gradient(135deg, #00a5f0, #006fdb)", foreground: "#fff", label: "Neon" } },
  { terms: ["xp investimentos", "banco xp"], style: { background: "linear-gradient(135deg, #262626, #050505)", foreground: "#fff", label: "XP" } },
  { terms: ["btg pactual", "btg"], style: { background: "linear-gradient(135deg, #183d68, #071d38)", foreground: "#fff", label: "BTG" } },
  { terms: ["pagbank", "pagseguro"], style: { background: "linear-gradient(135deg, #00b978, #008d65)", foreground: "#fff", label: "PagBank" } },
  { terms: ["will bank"], style: { background: "linear-gradient(135deg, #ffe000, #f6bd00)", foreground: "#252020", label: "Will Bank" } },
  { terms: ["sicredi"], style: { background: "linear-gradient(135deg, #4f9f38, #23752d)", foreground: "#fff", label: "Sicredi" } },
  { terms: ["sicoob"], style: { background: "linear-gradient(135deg, #1d6860, #12453f)", foreground: "#fff", label: "Sicoob" } },
];

export function cardBrandStyle(values: Array<string | null | undefined>, fallback = "#163300"): CardBrandStyle {
  const searchable = values.filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
  return brands.find((brand) => brand.terms.some((term) => searchable.includes(term)))?.style
    ?? { background: fallback, foreground: "#fff", label: "Cartão" };
}
