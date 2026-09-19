import type { TransactionType } from "../types/fety";

/** Fields Fety can read from a spreadsheet column */
export type MappableField =
  | "date"
  | "description"
  | "amount"
  | "debit"
  | "credit"
  | "inflow"
  | "outflow"
  | "category";

export type ColumnRole = MappableField | "ignore";

/** @deprecated use MappableField */
export type CsvField = MappableField;

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  /** 0-based index of the header row in the original file */
  headerRowIndex: number;
}

export interface ImportDraftRow {
  draftId: string;
  include: boolean;
  dateISO: string;
  desc: string;
  amount: number;
  type: TransactionType;
  category: string;
  icon: string;
}

export const COLUMN_ROLE_LABELS: Record<ColumnRole, string> = {
  ignore: "Ignore",
  date: "Date",
  description: "Description / label",
  amount: "Amount (+ or −)",
  debit: "Debit / money out",
  credit: "Credit / money in",
  inflow: "Inflow / income column",
  outflow: "Outflow / expense column",
  category: "Category",
};

const HEADER_ALIASES: Record<MappableField, string[]> = {
  date: [
    "date",
    "day",
    "daily",
    "when",
    "transaction date",
    "posting date",
    "posted date",
    "trans date",
    "week of",
  ],
  description: [
    "description",
    "desc",
    "memo",
    "payee",
    "name",
    "details",
    "narrative",
    "note",
    "notes",
    "label",
    "item",
    "merchant",
    "vendor",
    "activity",
    "transaction",
    "what",
  ],
  amount: ["amount", "transaction amount", "value", "net", "change", "delta", "plus minus", "amt"],
  debit: ["debit", "withdrawal", "money out", "spent", "expense", "expenses", "out", "payment"],
  credit: ["credit", "deposit", "money in", "received", "income", "in"],
  inflow: ["inflow", "money in", "cash in", "deposits", "incoming", "+"],
  outflow: ["outflow", "money out", "cash out", "outgoing", "-"],
  category: ["category", "type", "class", "bucket", "tag", "group"],
};

function parseCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function detectDelimiter(line: string): string {
  const tabs = (line.match(/\t/g) || []).length;
  const commas = (line.match(/,/g) || []).length;
  if (tabs > commas) return "\t";
  return ",";
}

export function splitCsvLines(text: string): string[] {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

function normHeader(h: string) {
  return h.toLowerCase().replace(/[^a-z0-9 +\-]/g, " ").replace(/\s+/g, " ").trim();
}

function scoreRowAsHeader(cells: string[]): number {
  if (cells.length < 2) return 0;
  let score = 0;
  const joined = cells.map(normHeader).join(" ");
  for (const aliases of Object.values(HEADER_ALIASES)) {
    if (aliases.some((a) => joined.includes(a))) score += 3;
  }
  const textCells = cells.filter((c) => c && Number.isNaN(parseFloat(c.replace(/[$,]/g, "")))).length;
  score += textCells;
  if (/total|summary|balance sheet/i.test(joined)) score -= 4;
  return score;
}

/** Pick the row most likely to be column headers (scans first 15 lines). */
export function detectHeaderRowIndex(lines: string[]): number {
  let best = 0;
  let bestScore = -1;
  const limit = Math.min(15, lines.length);
  for (let i = 0; i < limit; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;
    const delim = detectDelimiter(line);
    const cells = parseCsvLine(line, delim);
    const score = scoreRowAsHeader(cells);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

export function parseCsvText(text: string, options?: { headerRowIndex?: number }): ParsedCsv {
  const lines = splitCsvLines(text).map((l) => l.trimEnd());
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  if (nonEmpty.length === 0) return { headers: [], rows: [], headerRowIndex: 0 };

  const headerRowIndex = options?.headerRowIndex ?? detectHeaderRowIndex(lines);
  const headerLine = lines[headerRowIndex] ?? nonEmpty[0];
  const delimiter = detectDelimiter(headerLine);
  const headers = parseCsvLine(headerLine, delimiter).map((h) => h.replace(/^"|"$/g, "").trim());

  const rows: string[][] = [];
  for (let i = headerRowIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line?.trim()) continue;
    const cells = parseCsvLine(line, delimiter);
    if (cells.every((c) => !c.trim())) continue;
    rows.push(cells);
  }

  return { headers, rows, headerRowIndex };
}

const FIELD_PRIORITY: MappableField[] = [
  "date",
  "description",
  "amount",
  "inflow",
  "outflow",
  "debit",
  "credit",
  "category",
];

export function guessColumnMapping(headers: string[]): Partial<Record<MappableField, number>> {
  const mapping: Partial<Record<MappableField, number>> = {};
  const normalized = headers.map(normHeader);
  const used = new Set<number>();

  for (const field of FIELD_PRIORITY) {
    let bestIdx = -1;
    let bestScore = 0;
    normalized.forEach((h, idx) => {
      if (used.has(idx)) return;
      for (const alias of HEADER_ALIASES[field]) {
        let score = 0;
        if (h === alias) score = 10;
        else if (h.includes(alias)) score = 6;
        else if (alias.split(" ").every((w) => h.includes(w))) score = 4;
        if (score > bestScore) {
          bestScore = score;
          bestIdx = idx;
        }
      }
    });
    if (bestIdx >= 0 && bestScore >= 4) {
      mapping[field] = bestIdx;
      used.add(bestIdx);
    }
  }

  return mapping;
}

export function mappingFromAssignments(assignments: ColumnRole[]): Partial<Record<MappableField, number>> {
  const mapping: Partial<Record<MappableField, number>> = {};
  assignments.forEach((role, idx) => {
    if (role !== "ignore") mapping[role] = idx;
  });
  return mapping;
}

export function assignmentsFromMapping(
  headers: string[],
  mapping: Partial<Record<MappableField, number>>,
): ColumnRole[] {
  return headers.map((_, idx) => {
    const entry = (Object.entries(mapping) as [MappableField, number][]).find(([, col]) => col === idx);
    return entry ? entry[0] : "ignore";
  });
}

export function assignmentsFromGuess(headers: string[]): ColumnRole[] {
  return assignmentsFromMapping(headers, guessColumnMapping(headers));
}

export function validateImportMapping(mapping: Partial<Record<MappableField, number>>): string[] {
  const errors: string[] = [];
  if (mapping.date === undefined) errors.push("Map one column to Date.");
  if (mapping.description === undefined) {
    errors.push("Map one column to Description (any label you use for what happened).");
  }
  const hasAmount =
    mapping.amount !== undefined ||
    mapping.debit !== undefined ||
    mapping.credit !== undefined ||
    mapping.inflow !== undefined ||
    mapping.outflow !== undefined;
  if (!hasAmount) {
    errors.push("Map Amount, or separate In/Out or Debit/Credit columns.");
  }
  const slots = Object.values(mapping);
  if (new Set(slots).size !== slots.length) {
    errors.push("Each column can only map to one field — check for duplicates.");
  }
  return errors;
}

function parseMoney(raw: string): number | null {
  if (!raw?.trim()) return null;
  let cleaned = raw.trim();
  if (cleaned.startsWith("(") && cleaned.endsWith(")")) {
    cleaned = `-${cleaned.slice(1, -1)}`;
  }
  cleaned = cleaned.replace(/[$,\s]/g, "");
  if (cleaned.endsWith("-")) cleaned = `-${cleaned.slice(0, -1)}`;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseExcelSerial(n: number): string | null {
  if (n < 20000 || n > 60000) return null;
  const utc = (n - 25569) * 86400 * 1000;
  const d = new Date(utc);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function parseDateToISO(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;

  const asNum = parseFloat(t);
  if (Number.isFinite(asNum) && !t.includes("/") && !t.includes("-")) {
    const excel = parseExcelSerial(asNum);
    if (excel) return excel;
  }

  const slash = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (slash) {
    const [, a, b, y] = slash;
    let year = parseInt(y, 10);
    if (year < 100) year += 2000;
    const n1 = parseInt(a, 10);
    const n2 = parseInt(b, 10);
    const month = n1 > 12 ? n2 : n1;
    const day = n1 > 12 ? n1 : n2;
    const d = new Date(year, month - 1, day);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  const parsed = new Date(t);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

function isSummaryRow(desc: string, row: string[]): boolean {
  const head = (row[0] ?? "").trim().toLowerCase();
  if (/^total|^subtotal|^summary|^balance|^opening|^closing|^end balance|^start balance/.test(head)) return true;
  if (/^total|^subtotal|^summary/.test(desc.toLowerCase())) return true;
  return false;
}

function guessCategory(desc: string, type: TransactionType): string {
  if (type === "income") return "Income";
  const lower = desc.toLowerCase();
  if (/rent|mortgage/.test(lower)) return "Housing";
  if (/grocery|whole foods|trader|market/.test(lower)) return "Groceries";
  if (/gas|uber|lyft|parking/.test(lower)) return "Transportation";
  if (/amazon|target|shopping/.test(lower)) return "Shopping";
  if (/netflix|spotify|movie/.test(lower)) return "Entertainment";
  if (/electric|internet|phone|utility|bill/.test(lower)) return "Bills";
  if (/restaurant|chipotle|coffee|dining/.test(lower)) return "Dining Out";
  return "Other";
}

function guessType(amount: number, desc: string): TransactionType {
  if (amount > 0) return "income";
  if (/bill|rent|electric|insurance|subscription/.test(desc.toLowerCase())) return "bill";
  if (/transfer|savings/.test(desc.toLowerCase())) return "transfer";
  return "expense";
}

function guessIcon(type: TransactionType): string {
  if (type === "income") return "💼";
  if (type === "bill") return "📄";
  if (type === "transfer") return "🏦";
  return "📥";
}

function resolveAmount(row: string[], mapping: Partial<Record<MappableField, number>>): number | null {
  if (mapping.amount !== undefined) {
    return parseMoney(row[mapping.amount] ?? "");
  }

  const inflow =
    mapping.inflow !== undefined ? parseMoney(row[mapping.inflow] ?? "") : mapping.credit !== undefined ? parseMoney(row[mapping.credit] ?? "") : null;
  const outflow =
    mapping.outflow !== undefined
      ? parseMoney(row[mapping.outflow] ?? "")
      : mapping.debit !== undefined
        ? parseMoney(row[mapping.debit] ?? "")
        : null;

  if (inflow !== null && inflow !== 0) return Math.abs(inflow);
  if (outflow !== null && outflow !== 0) return -Math.abs(outflow);

  if (mapping.inflow !== undefined && mapping.outflow !== undefined) {
    const inf = parseMoney(row[mapping.inflow] ?? "") ?? 0;
    const out = parseMoney(row[mapping.outflow] ?? "") ?? 0;
    if (inf !== 0 || out !== 0) return inf !== 0 ? Math.abs(inf) : -Math.abs(out);
  }

  return null;
}

export function rowsToImportDrafts(
  parsed: ParsedCsv,
  mapping: Partial<Record<MappableField, number>>,
  categoryNames: string[],
): ImportDraftRow[] {
  const drafts: ImportDraftRow[] = [];
  let i = 0;

  for (const row of parsed.rows) {
    const dateIdx = mapping.date;
    const descIdx = mapping.description;
    if (dateIdx === undefined || descIdx === undefined) continue;

    const dateISO = parseDateToISO(row[dateIdx] ?? "");
    const desc = (row[descIdx] ?? "").trim() || "Imported row";
    if (!dateISO) continue;
    if (isSummaryRow(desc, row)) continue;

    const amount = resolveAmount(row, mapping);
    if (amount === null || amount === 0) continue;

    let category = "Other";
    if (mapping.category !== undefined) {
      const fromCsv = (row[mapping.category] ?? "").trim();
      if (fromCsv) category = fromCsv;
    }
    const type = guessType(amount, desc);
    if (category === "Other") category = guessCategory(desc, type);
    if (!categoryNames.includes(category) && category !== "Income" && category !== "Other") {
      category = categoryNames.find((c) => c.toLowerCase() === category.toLowerCase()) ?? category;
    }

    drafts.push({
      draftId: `draft-${i++}-${Date.now()}`,
      include: true,
      dateISO,
      desc,
      amount: type === "income" ? Math.abs(amount) : -Math.abs(amount),
      type,
      category,
      icon: guessIcon(type),
    });
  }
  return drafts;
}
