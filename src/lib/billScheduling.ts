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

export function billMatchesManualLine(t: Transaction, bill: Bill): boolean {
  if (t.desc === bill.name || t.desc.toLowerCase() === bill.name.toLowerCase()) return true;
  const a = t.desc.toLowerCase();
  const b = bill.name.toLowerCase();
  if (a.includes(b) || b.includes(a)) {
    return Math.abs(t.amount) === Math.abs(bill.amount);
  }
  return false;
}

function isManualLineForAnyBill(t: Transaction, bills: Bill[]): boolean {
  return bills.some((bill) => billMatchesManualLine(t, bill));
}

/** Collapse accidental duplicate bill definitions (same name, amount, schedule). */
export function dedupeBills(bills: Bill[]): Bill[] {
  const out: Bill[] = [];
  const seen = new Set<string>();
  for (const b of bills) {
    const key = [
      b.name.trim().toLowerCase(),
      b.amount,
      b.dueDay,
      b.frequency ?? "monthly",
      b.category.trim().toLowerCase(),
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(b);
  }
  return out;
}

export function rebuildTransactionsWithBillSchedule(
  store: Pick<FetyStore, "bills" | "transactions" | "skippedBillOccurrences">,
  ref = new Date(),
): Transaction[] {
  const skipped = new Set(store.skippedBillOccurrences ?? []);
  const bills = dedupeBills(store.bills);
  let manual = store.transactions.filter((t) => !isScheduledBillTransaction(t.id));

  const from = new Date(ref.getFullYear() - 1, 0, 1);
  const to = new Date(ref.getFullYear() + 1, 11, 31);

  const consumedManualIds = new Set<string>();
  const occurrenceLines: Transaction[] = [];

  for (const bill of bills) {
    const dates = [...new Set(billOccurrencesInRange(bill, from, to))];
    for (const dateISO of dates) {
      if (skipped.has(skipKeyForBillOccurrence(bill.id, dateISO))) continue;

      const matchingManual = manual.filter(
        (t) => !consumedManualIds.has(t.id) && t.dateISO === dateISO && billMatchesManualLine(t, bill),
      );

      if (matchingManual.length > 0) {
        occurrenceLines.push(matchingManual[0]);
        consumedManualIds.add(matchingManual[0].id);
        for (const extra of matchingManual.slice(1)) {
          consumedManualIds.add(extra.id);
        }
      } else {
        occurrenceLines.push({
          id: scheduledBillTransactionId(bill.id, dateISO),
          dateISO,
          desc: bill.name,
          category: bill.category,
          amount: -Math.abs(bill.amount),
          type: "bill",
          icon: bill.icon || "📋",
        });
      }
    }
  }

  const unrelatedManual = manual.filter(
    (t) => !consumedManualIds.has(t.id) && !isManualLineForAnyBill(t, bills),
  );
  const leftoverBillManual = manual.filter(
    (t) => !consumedManualIds.has(t.id) && isManualLineForAnyBill(t, bills),
  );

  const seenKey = new Set<string>();
  const dedupePass = (list: Transaction[]) =>
    list.filter((t) => {
      const key = `${t.dateISO}|${t.desc.toLowerCase()}|${t.amount}|${t.type}`;
      if (seenKey.has(key)) return false;
      seenKey.add(key);
      return true;
    });

  return [...dedupePass(unrelatedManual), ...occurrenceLines, ...dedupePass(leftoverBillManual)].sort((a, b) =>
    b.dateISO.localeCompare(a.dateISO),
  );
}

export function applyBillScheduleToStore(store: FetyStore, ref = new Date()): FetyStore {
  const bills = dedupeBills(store.bills);
  const base = {
    ...store,
    bills,
    transactions: store.transactions.filter((t) => !isScheduledBillTransaction(t.id)),
  };
  return {
    ...base,
    transactions: rebuildTransactionsWithBillSchedule(base, ref),
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
