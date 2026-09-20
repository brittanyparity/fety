import type {
  Bill,
  BillFrequency,
  FetyStore,
  IncomeFrequency,
  IncomeStream,
  RecurringScheduleBase,
  RecurringTransaction,
  Transaction,
} from "../types/fety";
import { flowForTransactionType, signAmountForFlow } from "./transactionTypes";

export const SCHEDULED_BILL_ID_PREFIX = "sched-bill-";
export const SCHEDULED_INCOME_ID_PREFIX = "sched-income-";
export const SCHEDULED_RECUR_ID_PREFIX = "sched-recur-";

export type ScheduledKind = "bill" | "income" | "recur";

export function isScheduledBillTransaction(id: string): boolean {
  return id.startsWith(SCHEDULED_BILL_ID_PREFIX);
}

export function isScheduledIncomeTransaction(id: string): boolean {
  return id.startsWith(SCHEDULED_INCOME_ID_PREFIX);
}

export function isScheduledRecurringTransaction(id: string): boolean {
  return id.startsWith(SCHEDULED_RECUR_ID_PREFIX);
}

export function isScheduledTransaction(id: string): boolean {
  return (
    isScheduledBillTransaction(id) ||
    isScheduledIncomeTransaction(id) ||
    isScheduledRecurringTransaction(id)
  );
}

export function scheduledBillTransactionId(billId: string, dateISO: string): string {
  return `${SCHEDULED_BILL_ID_PREFIX}${billId}_${dateISO}`;
}

export function scheduledIncomeTransactionId(streamId: string, dateISO: string): string {
  return `${SCHEDULED_INCOME_ID_PREFIX}${streamId}_${dateISO}`;
}

export function scheduledRecurringTransactionId(recurId: string, dateISO: string): string {
  return `${SCHEDULED_RECUR_ID_PREFIX}${recurId}_${dateISO}`;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function clampMonthDay(year: number, month: number, day: number): Date {
  const last = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(Math.max(1, day), last), 12, 0, 0, 0);
}

export function occurrencesInRange(item: Pick<RecurringScheduleBase, "dueDay" | "frequency">, from: Date, to: Date): string[] {
  const out: string[] = [];
  const fromMs = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const toMs = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();

  const pushIfInRange = (d: Date) => {
    const t = d.getTime();
    if (t >= fromMs && t <= toMs) out.push(isoDate(d));
  };

  const freq: BillFrequency = item.frequency ?? "monthly";

  if (freq === "monthly" || freq === "quarterly") {
    for (let y = from.getFullYear() - 1; y <= to.getFullYear() + 1; y++) {
      for (let m = 0; m < 12; m++) {
        if (freq === "quarterly" && m % 3 !== 0) continue;
        pushIfInRange(clampMonthDay(y, m, item.dueDay));
      }
    }
    return [...new Set(out)].sort();
  }

  if (freq === "weekly" || freq === "biweekly") {
    const weekday = Math.min(6, Math.max(0, item.dueDay));
    let cursor = new Date(from);
    cursor.setHours(12, 0, 0, 0);
    while (cursor.getDay() !== weekday) {
      cursor.setDate(cursor.getDate() + 1);
    }
    while (cursor.getTime() <= toMs) {
      pushIfInRange(cursor);
      cursor.setDate(cursor.getDate() + (freq === "weekly" ? 7 : 14));
    }
    return out;
  }

  return out;
}

function incomeDateAllowed(stream: Pick<IncomeStream, "startDateISO" | "endDateISO">, dateISO: string): boolean {
  if (stream.startDateISO && dateISO < stream.startDateISO) return false;
  if (stream.endDateISO && dateISO > stream.endDateISO) return false;
  return true;
}

/** Income-only schedule: semi-monthly days and optional active date range. */
export function incomeOccurrencesInRange(stream: IncomeStream, from: Date, to: Date): string[] {
  const fromMs = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const toMs = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  const freq = stream.frequency ?? "monthly";

  if (freq === "semimonthly") {
    const pair = stream.semiMonthlyDays ?? [stream.dueDay, 15];
    const d1 = Math.min(31, Math.max(1, pair[0]));
    const d2 = Math.min(31, Math.max(1, pair[1] ?? 15));
    const out: string[] = [];
    for (let y = from.getFullYear() - 1; y <= to.getFullYear() + 1; y++) {
      for (let m = 0; m < 12; m++) {
        for (const day of [d1, d2]) {
          const d = clampMonthDay(y, m, day);
          const iso = isoDate(d);
          if (!incomeDateAllowed(stream, iso)) continue;
          const t = d.getTime();
          if (t >= fromMs && t <= toMs) out.push(iso);
        }
      }
    }
    return [...new Set(out)].sort();
  }

  return occurrencesInRange(stream, from, to).filter((iso) => incomeDateAllowed(stream, iso));
}

/** @deprecated use occurrencesInRange */
export function billOccurrencesInRange(bill: Bill, from: Date, to: Date): string[] {
  return occurrencesInRange(bill, from, to);
}

export function skipKeyForOccurrence(kind: ScheduledKind, sourceId: string, dateISO: string): string {
  return `${kind}|${sourceId}|${dateISO}`;
}

export function skipKeyForBillOccurrence(billId: string, dateISO: string): string {
  return skipKeyForOccurrence("bill", billId, dateISO);
}

export function normalizeSkippedOccurrences(store: Pick<FetyStore, "skippedBillOccurrences" | "skippedScheduledOccurrences">): string[] {
  const raw = [...(store.skippedScheduledOccurrences ?? []), ...(store.skippedBillOccurrences ?? [])];
  const out = new Set<string>();
  for (const key of raw) {
    if (key.startsWith("bill|") || key.startsWith("income|") || key.startsWith("recur|")) {
      out.add(key);
      continue;
    }
    const legacy = key.match(/^(.+)\|(\d{4}-\d{2}-\d{2})$/);
    if (legacy) out.add(skipKeyForOccurrence("bill", legacy[1], legacy[2]));
  }
  return [...out];
}

export function parseScheduledTransactionId(
  id: string,
): { kind: ScheduledKind; sourceId: string; dateISO: string } | null {
  let prefix = "";
  let kind: ScheduledKind | null = null;
  if (id.startsWith(SCHEDULED_BILL_ID_PREFIX)) {
    prefix = SCHEDULED_BILL_ID_PREFIX;
    kind = "bill";
  } else if (id.startsWith(SCHEDULED_INCOME_ID_PREFIX)) {
    prefix = SCHEDULED_INCOME_ID_PREFIX;
    kind = "income";
  } else if (id.startsWith(SCHEDULED_RECUR_ID_PREFIX)) {
    prefix = SCHEDULED_RECUR_ID_PREFIX;
    kind = "recur";
  } else return null;
  const rest = id.slice(prefix.length);
  const sep = rest.lastIndexOf("_");
  if (sep <= 0) return null;
  return { kind, sourceId: rest.slice(0, sep), dateISO: rest.slice(sep + 1) };
}

export function parseScheduledBillId(id: string): { billId: string; dateISO: string } | null {
  const parsed = parseScheduledTransactionId(id);
  if (!parsed || parsed.kind !== "bill") return null;
  return { billId: parsed.sourceId, dateISO: parsed.dateISO };
}

function matchesManualLine(t: Transaction, item: Pick<RecurringScheduleBase, "name" | "amount">): boolean {
  if (t.desc === item.name || t.desc.toLowerCase() === item.name.toLowerCase()) return true;
  const a = t.desc.toLowerCase();
  const b = item.name.toLowerCase();
  if (a.includes(b) || b.includes(a)) {
    return Math.abs(t.amount) === Math.abs(Number(item.amount));
  }
  return false;
}

export function billMatchesManualLine(t: Transaction, bill: Bill): boolean {
  return matchesManualLine(t, bill);
}

function scheduleSignature(item: RecurringScheduleBase, extra = ""): string {
  return [
    item.name.trim().toLowerCase(),
    Number(item.amount),
    Number(item.dueDay),
    item.frequency ?? "monthly",
    extra,
  ].join("|");
}

export function incomeStreamSignature(s: IncomeStream): string {
  const semi =
    s.frequency === "semimonthly" ? (s.semiMonthlyDays ?? [s.dueDay, 15]).join(",") : "";
  return [
    s.name.trim().toLowerCase(),
    Number(s.amount),
    Number(s.dueDay),
    s.frequency ?? "monthly",
    semi,
    s.startDateISO ?? "",
    s.endDateISO ?? "",
  ].join("|");
}

export function recurringTransactionSignature(r: RecurringTransaction): string {
  return scheduleSignature(r, r.transactionType);
}

export function billSignature(b: Bill): string {
  return scheduleSignature(b);
}

export function dedupeBySignature<T extends RecurringScheduleBase>(items: T[], extraKey: (t: T) => string = () => ""): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const key = scheduleSignature(item, extraKey(item));
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      ...item,
      amount: Number(item.amount),
      dueDay: Number(item.dueDay),
      frequency: item.frequency ?? "monthly",
    });
  }
  return out;
}

export function dedupeBills(bills: Bill[]): Bill[] {
  return dedupeBySignature(bills);
}

export function dedupeIncomeStreams(streams: IncomeStream[]): IncomeStream[] {
  const out: IncomeStream[] = [];
  const seen = new Set<string>();
  for (const item of streams) {
    const key = incomeStreamSignature(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      ...item,
      amount: Number(item.amount),
      dueDay: Number(item.dueDay),
      frequency: item.frequency ?? "monthly",
    });
  }
  return out;
}

export function dedupeRecurringTransactions(items: RecurringTransaction[]): RecurringTransaction[] {
  return dedupeBySignature(items, (t) => t.transactionType);
}

function occurrenceDisplayKey(dateISO: string, item: RecurringScheduleBase, typeSuffix = ""): string {
  return `${dateISO}|${item.name.trim().toLowerCase()}|${Math.abs(Number(item.amount))}|${typeSuffix}`;
}

function transactionContentKey(t: Transaction): string {
  return `${t.dateISO}|${t.desc.trim().toLowerCase()}|${t.amount}|${t.type}`;
}

/** Drop duplicate projected schedule lines; never remove user-entered (manual) transactions. */
function collapseDuplicateScheduledTransactions(transactions: Transaction[]): Transaction[] {
  const manual: Transaction[] = [];
  const scheduled: Transaction[] = [];
  for (const t of transactions) {
    if (isScheduledTransaction(t.id)) scheduled.push(t);
    else manual.push(t);
  }
  const manualKeys = new Set(manual.map(transactionContentKey));
  const bySig = new Map<string, Transaction>();
  for (const t of scheduled) {
    const sig = transactionContentKey(t);
    if (manualKeys.has(sig)) continue;
    if (!bySig.has(sig)) bySig.set(sig, t);
  }
  return [...manual, ...bySig.values()];
}

type RebuildStore = Pick<
  FetyStore,
  "bills" | "incomeStreams" | "recurringTransactions" | "transactions" | "skippedBillOccurrences" | "skippedScheduledOccurrences"
>;

function projectOccurrences(
  store: RebuildStore,
  manual: Transaction[],
  skipped: Set<string>,
  from: Date,
  to: Date,
  configs: {
    kind: ScheduledKind;
    items: RecurringScheduleBase[];
    scheduledId: (id: string, dateISO: string) => string;
    buildTx: (item: RecurringScheduleBase, dateISO: string, id: string) => Transaction;
    typeSuffix: string;
    datesForItem?: (item: RecurringScheduleBase, from: Date, to: Date) => string[];
  },
  consumedManualIds: Set<string>,
  occurrenceByDisplayKey: Map<string, Transaction>,
): void {
  for (const item of configs.items) {
    const dates = [
      ...new Set(configs.datesForItem?.(item, from, to) ?? occurrencesInRange(item, from, to)),
    ];
    for (const dateISO of dates) {
      if (skipped.has(skipKeyForOccurrence(configs.kind, item.id, dateISO))) continue;

      const displayKey = occurrenceDisplayKey(dateISO, item, configs.typeSuffix);
      if (occurrenceByDisplayKey.has(displayKey)) continue;

      const matchingManual = manual.filter(
        (t) => !consumedManualIds.has(t.id) && t.dateISO === dateISO && matchesManualLine(t, item),
      );

      if (matchingManual.length > 0) {
        occurrenceByDisplayKey.set(displayKey, matchingManual[0]);
        consumedManualIds.add(matchingManual[0].id);
        for (const extra of matchingManual.slice(1)) consumedManualIds.add(extra.id);
      } else {
        occurrenceByDisplayKey.set(
          displayKey,
          configs.buildTx(item, dateISO, configs.scheduledId(item.id, dateISO)),
        );
      }
    }
  }
}

export function rebuildTransactionsWithBillSchedule(store: RebuildStore, ref = new Date()): Transaction[] {
  const skipped = new Set(normalizeSkippedOccurrences(store));
  const bills = dedupeBills(store.bills ?? []);
  const incomeStreams = dedupeIncomeStreams(store.incomeStreams ?? []);
  const recurringTransactions = dedupeRecurringTransactions(store.recurringTransactions ?? []);

  let manual = (store.transactions ?? []).filter((t) => !isScheduledTransaction(t.id));

  const from = new Date(ref.getFullYear() - 1, 0, 1);
  const to = new Date(ref.getFullYear() + 1, 11, 31);

  const consumedManualIds = new Set<string>();
  const occurrenceByDisplayKey = new Map<string, Transaction>();

  const storeForFlow = store as FetyStore;

  projectOccurrences(
    store,
    manual,
    skipped,
    from,
    to,
    {
      kind: "bill",
      items: bills,
      scheduledId: scheduledBillTransactionId,
      typeSuffix: "bill",
      buildTx: (item, dateISO, id) => ({
        id,
        dateISO,
        desc: item.name,
        category: item.category,
        amount: -Math.abs(Number(item.amount)),
        type: "bill",
        icon: item.icon || "📋",
      }),
    },
    consumedManualIds,
    occurrenceByDisplayKey,
  );

  projectOccurrences(
    store,
    manual,
    skipped,
    from,
    to,
    {
      kind: "income",
      items: incomeStreams,
      scheduledId: scheduledIncomeTransactionId,
      typeSuffix: "income",
      buildTx: (item, dateISO, id) => ({
        id,
        dateISO,
        desc: item.name,
        category: item.category,
        amount: Math.abs(Number(item.amount)),
        type: "income",
        icon: item.icon || "💵",
      }),
      datesForItem: (item, rangeFrom, rangeTo) =>
        incomeOccurrencesInRange(item as IncomeStream, rangeFrom, rangeTo),
    },
    consumedManualIds,
    occurrenceByDisplayKey,
  );

  projectOccurrences(
    store,
    manual,
    skipped,
    from,
    to,
    {
      kind: "recur",
      items: recurringTransactions,
      scheduledId: scheduledRecurringTransactionId,
      typeSuffix: "recur",
      buildTx: (item, dateISO, id) => {
        const recur = item as RecurringTransaction;
        const typeId = recur.transactionType || "expense";
        const flow = flowForTransactionType(storeForFlow, typeId);
        return {
          id,
          dateISO,
          desc: item.name,
          category: item.category,
          amount: signAmountForFlow(flow, Number(item.amount)),
          type: typeId,
          icon: item.icon || "🔄",
          fromAccountId: recur.fromAccountId,
          toAccountId: recur.toAccountId,
          goalId: recur.goalId,
        };
      },
    },
    consumedManualIds,
    occurrenceByDisplayKey,
  );

  const occurrenceLines = [...occurrenceByDisplayKey.values()];

  const allScheduledItems: RecurringScheduleBase[] = [...bills, ...incomeStreams, ...recurringTransactions];
  const isManualForScheduled = (t: Transaction) => allScheduledItems.some((item) => matchesManualLine(t, item));

  const unrelatedManual = manual.filter((t) => !consumedManualIds.has(t.id) && !isManualForScheduled(t));
  const leftoverScheduledManual = manual.filter((t) => !consumedManualIds.has(t.id) && isManualForScheduled(t));

  const seenScheduledKey = new Set<string>();
  const dedupePass = (list: Transaction[]) =>
    list.filter((t) => {
      if (!isScheduledTransaction(t.id)) return true;
      const key = transactionContentKey(t);
      if (seenScheduledKey.has(key)) return false;
      seenScheduledKey.add(key);
      return true;
    });

  const merged = [...dedupePass(unrelatedManual), ...occurrenceLines, ...dedupePass(leftoverScheduledManual)];
  return collapseDuplicateScheduledTransactions(merged).sort((a, b) => b.dateISO.localeCompare(a.dateISO));
}

export function applyBillScheduleToStore(store: FetyStore, ref = new Date()): FetyStore {
  const bills = dedupeBills(store.bills ?? []);
  const incomeStreams = dedupeIncomeStreams(store.incomeStreams ?? []);
  const recurringTransactions = dedupeRecurringTransactions(store.recurringTransactions ?? []);
  const skippedScheduledOccurrences = normalizeSkippedOccurrences(store);

  const base: FetyStore = {
    ...store,
    bills,
    incomeStreams,
    recurringTransactions,
    skippedScheduledOccurrences,
    skippedBillOccurrences: undefined,
    transactions: (store.transactions ?? []).filter((t) => !isScheduledTransaction(t.id)),
  };
  return {
    ...base,
    transactions: rebuildTransactionsWithBillSchedule(base, ref),
  };
}

export function nextBillOccurrenceOnOrAfter(bill: Bill, ref = new Date()): string | null {
  const from = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const to = new Date(from.getFullYear() + 2, 11, 31);
  const todayIso = isoDate(from);
  return occurrencesInRange(bill, from, to).find((d) => d >= todayIso) ?? null;
}

export function nextIncomeOccurrenceOnOrAfter(stream: IncomeStream, ref = new Date()): string | null {
  const from = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const to = new Date(from.getFullYear() + 2, 11, 31);
  const todayIso = isoDate(from);
  return incomeOccurrencesInRange(stream, from, to).find((d) => d >= todayIso) ?? null;
}

export const BILL_FREQUENCY_LABELS: Record<BillFrequency, string> = {
  monthly: "Every month",
  weekly: "Every week",
  biweekly: "Every 2 weeks",
  quarterly: "Every 3 months",
};

export const INCOME_FREQUENCY_LABELS: Record<IncomeFrequency, string> = {
  ...BILL_FREQUENCY_LABELS,
  semimonthly: "Twice a month",
};
