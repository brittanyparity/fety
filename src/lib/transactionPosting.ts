import { isScheduledTransaction } from "./billScheduling";
import { todayISO } from "./fetyCalculations";
import type { AddTransactionInput, Transaction } from "../types/fety";

/** Recorded but not yet paid or received — does not affect actual balances. */
export type TransactionPostingStatus = "planned" | "completed";

export function normalizePostingStatus(
  status: TransactionPostingStatus | undefined,
): TransactionPostingStatus {
  return status ?? "completed";
}

export function isManualStoredTransaction(t: Transaction): boolean {
  return !isScheduledTransaction(t.id);
}

/** Calendar / list date (when the user expects the activity). */
export function transactionDisplayDateISO(t: Transaction): string {
  return t.dateISO;
}

/** Date that counts toward balances once completed. */
export function transactionLedgerDateISO(t: Transaction): string {
  const status = normalizePostingStatus(t.postingStatus);
  if (status === "completed" && t.completedAtISO) return t.completedAtISO;
  return t.dateISO;
}

/** Included in real-time totals (net worth through today, category spend to date, etc.). */
export function transactionCountsInActualLedger(t: Transaction): boolean {
  if (!isManualStoredTransaction(t)) return true;
  return normalizePostingStatus(t.postingStatus) === "completed";
}

/**
 * Included in projected cash-flow / calendar balances on `throughISO`.
 * Planned manual txs count on their display date; completed txs use ledger date.
 */
export function transactionCountsInProjectedLedger(t: Transaction, throughISO: string): boolean {
  if (!isManualStoredTransaction(t)) return transactionLedgerDateISO(t) <= throughISO;
  const status = normalizePostingStatus(t.postingStatus);
  if (status === "completed") return transactionLedgerDateISO(t) <= throughISO;
  return t.dateISO <= throughISO;
}

export function filterTransactionsForLedger(
  transactions: Transaction[],
  throughISO: string,
  mode: "actual" | "projected",
): Transaction[] {
  return transactions.filter((t) => {
    if (mode === "actual") {
      if (!transactionCountsInActualLedger(t)) return false;
      return transactionLedgerDateISO(t) <= throughISO;
    }
    return transactionCountsInProjectedLedger(t, throughISO);
  });
}

export function defaultPostingStatusForNewTransaction(dateISO: string): TransactionPostingStatus {
  const today = todayISO();
  return dateISO > today ? "planned" : "completed";
}

export function applyPostingDefaults(input: AddTransactionInput): AddTransactionInput {
  if (input.postingStatus) return input;
  const dateISO = input.dateISO ?? todayISO();
  const status = defaultPostingStatusForNewTransaction(dateISO);
  return {
    ...input,
    postingStatus: status,
    completedAtISO: status === "completed" ? input.completedAtISO ?? dateISO : undefined,
  };
}

export function markTransactionCompleted(
  t: Transaction,
  completedAtISO: string = todayISO(),
): Transaction {
  if (!isManualStoredTransaction(t)) return t;
  if (normalizePostingStatus(t.postingStatus) === "completed") return t;
  return {
    ...t,
    postingStatus: "completed",
    completedAtISO,
  };
}

export function markTransactionPlannedAgain(t: Transaction): Transaction {
  if (!isManualStoredTransaction(t)) return t;
  return {
    ...t,
    postingStatus: "planned",
    completedAtISO: undefined,
  };
}

export function postingStatusLabel(status: TransactionPostingStatus | undefined): string {
  return normalizePostingStatus(status) === "planned" ? "Upcoming" : "Completed";
}
