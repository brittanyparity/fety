import type { Bill, FetyStore, IncomeStream, RecurringScheduleBase, RecurringTransaction, ScheduledItemKind } from "../types/fety";
import { occurrencesInRange } from "./billScheduling";
import { roundMoney } from "./scheduleAmounts";

export type ScheduledItemRef = { kind: ScheduledItemKind; id: string };

export function encodeScheduledItemRef(ref: ScheduledItemRef): string {
  return `${ref.kind}:${ref.id}`;
}

export function decodeScheduledItemRef(value: string): ScheduledItemRef | null {
  const sep = value.indexOf(":");
  if (sep <= 0) return null;
  const kind = value.slice(0, sep) as ScheduledItemKind;
  if (kind !== "bill" && kind !== "income" && kind !== "recur") return null;
  const id = value.slice(sep + 1);
  if (!id) return null;
  return { kind, id };
}

export type ScheduledItemOption = {
  ref: ScheduledItemRef;
  label: string;
  amount: number;
  category: string;
  icon: string;
  schedule: Pick<RecurringScheduleBase, "dueDay" | "frequency">;
};

export function listScheduledItemOptions(store: FetyStore): ScheduledItemOption[] {
  const out: ScheduledItemOption[] = [];
  for (const b of store.bills) {
    out.push({
      ref: { kind: "bill", id: b.id },
      label: `Bill · ${b.name}`,
      amount: b.amount,
      category: scheduledItemStoredCategory(b.name),
      icon: b.icon,
      schedule: b,
    });
  }
  for (const s of store.incomeStreams ?? []) {
    out.push({
      ref: { kind: "income", id: s.id },
      label: `Income · ${s.name}`,
      amount: s.amount,
      category: scheduledItemStoredCategory(s.name),
      icon: s.icon,
      schedule: s,
    });
  }
  for (const r of store.recurringTransactions ?? []) {
    out.push({
      ref: { kind: "recur", id: r.id },
      label: `Recurring · ${r.name}`,
      amount: r.amount,
      category: scheduledItemStoredCategory(r.name),
      icon: r.icon,
      schedule: r,
    });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

export function getScheduledItemOption(
  store: FetyStore,
  ref: ScheduledItemRef,
): ScheduledItemOption | null {
  return listScheduledItemOptions(store).find((o) => o.ref.kind === ref.kind && o.ref.id === ref.id) ?? null;
}

export function transactionDateMatchesSchedule(
  schedule: Pick<RecurringScheduleBase, "dueDay" | "frequency">,
  dateISO: string,
): boolean {
  const d = new Date(`${dateISO}T12:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return occurrencesInRange(schedule, from, to).includes(dateISO);
}

export function scheduledItemDiffersFromTransaction(
  item: ScheduledItemOption,
  txAmount: number,
  dateISO: string,
): { amountDiff: boolean; dateDiff: boolean; shouldPrompt: boolean } {
  const amountDiff = roundMoney(Math.abs(txAmount)) !== roundMoney(Math.abs(item.amount));
  const dateDiff = !transactionDateMatchesSchedule(item.schedule, dateISO);
  return {
    amountDiff,
    dateDiff,
    shouldPrompt: amountDiff && dateDiff,
  };
}

export function dueDayFromDateISO(dateISO: string): number {
  const day = parseInt(dateISO.slice(8, 10), 10);
  return Number.isFinite(day) ? day : 1;
}

export function applyScheduledItemTransactionSync(
  store: FetyStore,
  ref: ScheduledItemRef,
  txAmount: number,
  dateISO: string,
): FetyStore {
  const amount = roundMoney(Math.abs(txAmount));
  const dueDay = dueDayFromDateISO(dateISO);
  if (ref.kind === "bill") {
    return {
      ...store,
      bills: store.bills.map((b) => (b.id === ref.id ? { ...b, amount, dueDay } : b)),
    };
  }
  if (ref.kind === "income") {
    return {
      ...store,
      incomeStreams: (store.incomeStreams ?? []).map((s) =>
        s.id === ref.id ? { ...s, amount, dueDay } : s,
      ),
    };
  }
  return {
    ...store,
    recurringTransactions: (store.recurringTransactions ?? []).map((r) =>
      r.id === ref.id ? { ...r, amount, dueDay } : r,
    ),
  };
}

/** Scheduled items are identified by name; stored category matches for projected transactions. */
export function scheduledItemStoredCategory(name: string): string {
  const trimmed = name.trim();
  return trimmed || "Other";
}

export function scheduledItemStoredCategoryFromItem(item: { name: string; category?: string }): string {
  return scheduledItemStoredCategory(item.name);
}

export function scheduledItemKindLabel(kind: ScheduledItemKind): string {
  if (kind === "bill") return "Bill";
  if (kind === "income") return "Income";
  return "Recurring";
}
