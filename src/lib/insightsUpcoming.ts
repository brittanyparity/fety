import { nextBillOccurrenceOnOrAfter } from "./billScheduling";
import { flowForTransactionType } from "./transactionTypes";
import type { FetyStore } from "../types/fety";

export type UpcomingExpenseRow = {
  id: string;
  name: string;
  amount: number;
  dateISO: string;
  category: string;
  icon: string;
  source: "bill" | "recurring";
};

export function buildUpcomingExpenses(
  store: FetyStore,
  ref = new Date(),
  options: { limit?: number; withinDays?: number } = {},
): UpcomingExpenseRow[] {
  const limit = options.limit ?? 12;
  const withinDays = options.withinDays ?? 90;
  const horizonMs = ref.getTime() + withinDays * 86400000;
  const rows: UpcomingExpenseRow[] = [];

  const pushIfSoon = (
    id: string,
    name: string,
    amount: number,
    category: string,
    icon: string,
    source: UpcomingExpenseRow["source"],
    nextISO: string | null,
  ) => {
    if (!nextISO) return;
    const t = new Date(`${nextISO}T12:00:00`).getTime();
    if (t > horizonMs) return;
    rows.push({ id, name, amount, dateISO: nextISO, category, icon, source });
  };

  for (const bill of store.bills ?? []) {
    pushIfSoon(
      `bill-${bill.id}`,
      bill.name,
      bill.amount,
      bill.category,
      bill.icon,
      "bill",
      nextBillOccurrenceOnOrAfter(bill, ref),
    );
  }

  for (const recur of store.recurringTransactions ?? []) {
    const flow = flowForTransactionType(store, recur.transactionType);
    if (flow === "income") continue;
    pushIfSoon(
      `recur-${recur.id}`,
      recur.name,
      recur.amount,
      recur.category,
      recur.icon,
      "recurring",
      nextBillOccurrenceOnOrAfter(recur, ref),
    );
  }

  rows.sort((a, b) => a.dateISO.localeCompare(b.dateISO) || a.name.localeCompare(b.name));
  return rows.slice(0, limit);
}
