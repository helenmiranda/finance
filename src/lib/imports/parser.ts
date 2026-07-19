export type ParsedImportRow = {
  row_number: number;
  occurred_on: string | null;
  description: string | null;
  amount_cents: number | null;
  suggested_type: "income" | "expense" | null;
  raw_data: Record<string, string>;
  parse_error: string | null;
  review_status: "ready" | "pending";
};

const DATE_NAMES = ["data", "date", "dtposted", "lançamento", "lancamento"];
const DESCRIPTION_NAMES = ["descrição", "descricao", "description", "memo", "histórico", "historico", "name"];
const AMOUNT_NAMES = ["valor", "amount", "trnamt", "quantia"];

function csvLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"') { current += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === delimiter && !quoted) { values.push(current.trim()); current = ""; }
    else current += character;
  }
  values.push(current.trim());
  return values;
}

function normalizedKey(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

function findColumn(headers: string[], candidates: string[]) {
  return headers.findIndex((header) => candidates.includes(normalizedKey(header)));
}

function parseDate(value: string) {
  const compactOfx = value.match(/^(\d{4})(\d{2})(\d{2})/);
  if (compactOfx) return `${compactOfx[1]}-${compactOfx[2]}-${compactOfx[3]}`;
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return value;
  const brazilian = value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (brazilian) return `${brazilian[3]}-${brazilian[2].padStart(2, "0")}-${brazilian[1].padStart(2, "0")}`;
  return null;
}

function parseAmount(value: string) {
  const cleaned = value.replace(/R\$/gi, "").replace(/\s/g, "");
  const decimalSeparator = cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".") ? "," : ".";
  const normalized = decimalSeparator === ","
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned.replace(/,/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) && number !== 0 ? Math.round(number * 100) : null;
}

export function parseCsv(content: string): ParsedImportRow[] {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("O CSV não possui linhas suficientes.");
  const delimiter = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const headers = csvLine(lines[0], delimiter);
  const dateIndex = findColumn(headers, DATE_NAMES);
  const descriptionIndex = findColumn(headers, DESCRIPTION_NAMES);
  const amountIndex = findColumn(headers, AMOUNT_NAMES);
  if (dateIndex < 0 || descriptionIndex < 0 || amountIndex < 0) {
    throw new Error("Não encontramos automaticamente as colunas de data, descrição e valor.");
  }

  return lines.slice(1).map((line, index) => {
    const values = csvLine(line, delimiter);
    const raw = Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ""]));
    const occurredOn = parseDate(values[dateIndex] ?? "");
    const description = values[descriptionIndex]?.trim() || null;
    const signedAmount = parseAmount(values[amountIndex] ?? "");
    const valid = Boolean(occurredOn && description && signedAmount);
    return {
      row_number: index + 2,
      occurred_on: occurredOn,
      description,
      amount_cents: signedAmount === null ? null : Math.abs(signedAmount),
      suggested_type: signedAmount === null ? null : signedAmount < 0 ? "expense" : "income",
      raw_data: raw,
      parse_error: valid ? null : "Confira data, descrição e valor.",
      review_status: valid ? "ready" : "pending",
    };
  });
}

function ofxValue(block: string, tag: string) {
  return block.match(new RegExp(`<${tag}>([^<\\r\\n]+)`, "i"))?.[1]?.trim() ?? "";
}

export function parseOfx(content: string): ParsedImportRow[] {
  const blocks = content.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];
  if (!blocks.length) throw new Error("Nenhuma transação foi encontrada no OFX.");
  return blocks.map((block, index) => {
    const rawDate = ofxValue(block, "DTPOSTED");
    const memo = ofxValue(block, "MEMO") || ofxValue(block, "NAME");
    const rawAmount = ofxValue(block, "TRNAMT");
    const signedAmount = parseAmount(rawAmount);
    const occurredOn = parseDate(rawDate);
    const valid = Boolean(occurredOn && memo && signedAmount);
    return {
      row_number: index + 1,
      occurred_on: occurredOn,
      description: memo || null,
      amount_cents: signedAmount === null ? null : Math.abs(signedAmount),
      suggested_type: signedAmount === null ? null : signedAmount < 0 ? "expense" : "income",
      raw_data: { DTPOSTED: rawDate, MEMO: memo, TRNAMT: rawAmount, FITID: ofxValue(block, "FITID") },
      parse_error: valid ? null : "Confira data, descrição e valor.",
      review_status: valid ? "ready" : "pending",
    };
  });
}
