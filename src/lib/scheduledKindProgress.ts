import type { FetyStore, ScheduledItemKind, Transaction } from "../types/fety";
import { parseScheduledTransactionId } from "./billScheduling";
import { balanceAsOfISO, dateToISOLocal } from "./fetyCalculations";
import {
  billsScheduledTotalInMonth,
  incomeScheduledTotalInMonth,
  recurringScheduledTotalInMonth,
} from "./scheduleMonthTotals";
import { flowForTransactionType } from "./transactionTypes";

export type ScheduledKindProgressRow = {
  kind: ScheduledItemKind;
  label: string;
  icon: string;
  /** Planned monthly total from scheduled items on file. */
  monthlyScheduled: number;
  /** Paid, earned, or posted in the focus month through the selected day. */
  monthActual: number;
};

function monthWindow(ref: Date): { startISO: string; throughISO: string } {
  const from = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59);
  const focusISO = dateToISOLocal(ref);
  const focusDate = new Date(`${focusISO}T12:00:00`);
  const through = end > focusDate ? focusDate : end;
  return { startISO: dateToISOLocal(from), throughISO: dateToISOLocal(through) };
}

function transactionKind(t: Transaction): ScheduledItemKind | null {
  if (t.scheduledItemKind) return t.scheduledItemKind;
  return parseScheduledTransactionId(t.id)?.kind ?? null;
}

function inMonthWindow(t: Transaction, startISO: string, throughISO: string, asOfISO: string): boolean {
  return t.dateISO >= asOfISO && t.dateISO >= startISO && t.dateISO <= throughISO;
}

function monthActualForKind(
  store: Pick<FetyStore, "transactions" | "profile" | "transactionTypes" | "typeIcons">,
  kind: ScheduledItemKind,
  ref: Date,
): number {
  const { startISO, throughISO } = monthWindow(ref);
  const asOf = balanceAsOfISO(store as FetyStore);
  let total = 0;
  for (const t of store.transactions) {
    if (!inMonthWindow(t, startISO, throughISO, asOf)) continue;
    if (transactionKind(t) !== kind) continue;
    const flow = flowForTransactionType(store as FetyStore, t.type);
    if (kind === "income") {
      if (flow === "income") total += Math.abs(t.amount);
    } else {
      if (flow === "expense") total += Math.abs(t.amount);
      else if (flow === "transfer") total += Math.abs(t.amount);
    }
  }
  return total;
}


export function computeScheduledKindProgress(
  store: Pick<
    FetyStore,
    "transactions" | "profile" | "transactionTypes" | "typeIcons" | "bills" | "incomeStreams" | "recurringTransactions"
  >,
  ref = new Date(),
): ScheduledKindProgressRow[] {
  const bills = store.bills ?? [];
  const incomeStreams = store.incomeStreams ?? [];
  const recurringTransactions = store.recurringTransactions ?? [];

  return [
    {
      kind: "bill",
      label: "Bills",
      icon: "📄",
      monthlyScheduled: billsScheduledTotalInMonth(bills, ref),
      monthActual: monthActualForKind(store, "bill", ref),
    },
    {
      kind: "income",
      label: "Income",
      icon: "💵",
      monthlyScheduled: incomeScheduledTotalInMonth(incomeStreams, ref),
      monthActual: monthActualForKind(store, "income", ref),
    },
    {
      kind: "recur",
      label: "Recurring",
      icon: "🔄",
      monthlyScheduled: recurringScheduledTotalInMonth(recurringTransactions, ref),
      monthActual: monthActualForKind(store, "recur", ref),
    },
  ];
}
