import type { Bill, BillFrequency, FetyStore, Transaction } from "../types/fety";

export const SCHEDULED_BILL_ID_PREFIX = "sched-bill-";

export function isScheduledBillTransaction(id: string): boolean {
  return id.startsWith(SCHEDULED_BILL_ID_PREFIX);
}

export function scheduledBillTransactionId(billId: string, dateISO: string): string {
  return `${SCHEDULED_BILL_ID_PREFIX}${billId}_${dateISO}`;
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

/** All due dates for a bill between from and to (inclusive). */
export function billOccurrencesInRange(bill: Bill, from: Date, to: Date): string[] {
  const out: string[] = [];
  const fromMs = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const toMs = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();

  const pushIfInRange = (d: Date) => {
    const t = d.getTime();
    if (t >= fromMs && t <= toMs) out.push(isoDate(d));
  };

  const freq: BillFrequency = bill.frequency ?? "monthly";

  if (freq === "monthly" || freq === "quarterly") {
    const step = freq === "monthly" ? 1 : 3;
    for (let y = from.getFullYear() - 1; y <= to.getFullYear() + 1; y++) {
      for (let m = 0; m < 12; m++) {
        if (freq === "quarterly" && m % 3 !== 0) continue;
        pushIfInRange(clampMonthDay(y, m, bill.dueDay));
      }
    }
    return [...new Set(out)].sort();
  }

  if (freq === "weekly" || freq === "biweekly") {
    const weekday = Math.min(6, Math.max(0, bill.dueDay));
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

function billMatchesManualLine(t: Transaction, bill: Bill): boolean {
  return (
    t.desc === bill.name ||
    t.desc.toLowerCase() === bill.name.toLowerCase()
  );
}

function manualLinesForBillOnDate(transactions: Transaction[], bill: Bill, dateISO: string): Transaction[] {
  return transactions.filter(
    (t) => !isScheduledBillTransaction(t.id) && t.dateISO === dateISO && billMatchesManualLine(t, bill),
  );
}

/** One manual line per bill occurrence; drop duplicate manual copies. */
function dedupeManualBillLines(manual: Transaction[], bills: Bill[]): Transaction[] {
  const dropIds = new Set<string>();
  for (const bill of bills) {
    const byDate = new Map<string, Transaction[]>();
    for (const t of manual) {
      if (!billMatchesManualLine(t, bill)) continue;
      const list = byDate.get(t.dateISO) ?? [];
      list.push(t);
      byDate.set(t.dateISO, list);
    }
    for (const list of byDate.values()) {
      if (list.length <= 1) continue;
      list.slice(1).forEach((t) => dropIds.add(t.id));
    }
  }
  return dropIds.size === 0 ? manual : manual.filter((t) => !dropIds.has(t.id));
}

export function rebuildTransactionsWithBillSchedule(
  store: Pick<FetyStore, "bills" | "transactions" | "skippedBillOccurrences">,
  ref = new Date(),
): Transaction[] {
  const skipped = new Set(store.skippedBillOccurrences ?? []);
  let manual = store.transactions.filter((t) => !isScheduledBillTransaction(t.id));
  manual = dedupeManualBillLines(manual, store.bills);

  const from = new Date(ref.getFullYear() - 1, 0, 1);
  const to = new Date(ref.getFullYear() + 1, 11, 31);

  const scheduledById = new Map<string, Transaction>();
  for (const bill of store.bills) {
    const dates = [...new Set(billOccurrencesInRange(bill, from, to))];
    for (const dateISO of dates) {
      const skipKey = `${bill.id}|${dateISO}`;
      if (skipped.has(skipKey)) continue;
      if (manualLinesForBillOnDate(manual, bill, dateISO).length > 0) continue;
      const id = scheduledBillTransactionId(bill.id, dateISO);
      scheduledById.set(id, {
        id,
        dateISO,
        desc: bill.name,
        category: bill.category,
        amount: -Math.abs(bill.amount),
        type: "bill",
        icon: bill.icon || "📋",
      });
    }
  }

  const scheduledKeys = new Set(
    [...scheduledById.values()].map((t) => {
      const parsed = parseScheduledBillId(t.id);
      return parsed ? `${parsed.billId}|${parsed.dateISO}` : t.id;
    }),
  );

  manual = manual.filter((t) => {
    for (const bill of store.bills) {
      if (t.dateISO && billMatchesManualLine(t, bill) && scheduledKeys.has(`${bill.id}|${t.dateISO}`)) {
        return false;
      }
    }
    return true;
  });

  const seenManual = new Set<string>();
  manual = manual.filter((t) => {
    const key = `${t.dateISO}|${t.desc.toLowerCase()}|${t.amount}|${t.type}`;
    if (seenManual.has(key)) return false;
    seenManual.add(key);
    return true;
  });

  const scheduled = [...scheduledById.values()];

  const occurrenceKey = (billId: string, dateISO: string) => `${billId}|${dateISO}`;
  const scheduledOccurrenceKeys = new Set(
    scheduled.map((t) => {
      const parsed = parseScheduledBillId(t.id);
      return parsed ? occurrenceKey(parsed.billId, parsed.dateISO) : t.id;
    }),
  );

  const byId = new Map<string, Transaction>();
  for (const t of manual) {
    let drop = false;
    for (const bill of store.bills) {
      if (t.dateISO && billMatchesManualLine(t, bill) && scheduledOccurrenceKeys.has(occurrenceKey(bill.id, t.dateISO))) {
        drop = true;
        break;
      }
    }
    if (!drop) byId.set(t.id, t);
  }
  for (const t of scheduled) byId.set(t.id, t);

  return [...byId.values()].sort((a, b) => b.dateISO.localeCompare(a.dateISO));
}

export function applyBillScheduleToStore(store: FetyStore, ref = new Date()): FetyStore {
  return {
    ...store,
    transactions: rebuildTransactionsWithBillSchedule(store, ref),
  };
}

export function skipKeyForBillOccurrence(billId: string, dateISO: string): string {
  return `${billId}|${dateISO}`;
}

export function parseScheduledBillId(id: string): { billId: string; dateISO: string } | null {
  if (!isScheduledBillTransaction(id)) return null;
  const rest = id.slice(SCHEDULED_BILL_ID_PREFIX.length);
  const sep = rest.lastIndexOf("_");
  if (sep <= 0) return null;
  return { billId: rest.slice(0, sep), dateISO: rest.slice(sep + 1) };
}

export function nextBillOccurrenceOnOrAfter(bill: Bill, ref = new Date()): string | null {
  const from = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const to = new Date(from.getFullYear() + 2, 11, 31);
  const todayIso = isoDate(from);
  return billOccurrencesInRange(bill, from, to).find((d) => d >= todayIso) ?? null;
}

export const BILL_FREQUENCY_LABELS: Record<BillFrequency, string> = {
  monthly: "Every month",
  weekly: "Every week",
  biweekly: "Every 2 weeks",
  quarterly: "Every 3 months",
};
