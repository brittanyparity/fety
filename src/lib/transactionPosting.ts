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

/** Effective status for a manual transaction (uses date when postingStatus is unset). */
export function resolveManualPostingStatus(t: Pick<Transaction, "postingStatus" | "dateISO">): TransactionPostingStatus {
  if (t.postingStatus === "completed" || t.postingStatus === "planned") return t.postingStatus;
  return defaultPostingStatusForNewTransaction(t.dateISO);
}

export type TransactionStatusDisplayKind = "completed" | "upcoming" | "pending";

export function transactionStatusDisplayKind(t: Transaction): TransactionStatusDisplayKind | null {
  if (!isManualStoredTransaction(t)) return "upcoming";
  if (t.postingStatus === "completed") return "completed";
  const today = todayISO();
  if (t.postingStatus === "planned") {
    return t.dateISO > today ? "upcoming" : "pending";
  }
  return t.dateISO > today ? "upcoming" : "pending";
}

export function transactionStatusDisplayLabel(t: Transaction): string | null {
  if (!isManualStoredTransaction(t)) return "Upcoming";
  const kind = transactionStatusDisplayKind(t);
  if (kind === "completed") return "Complete";
  if (kind === "upcoming") return "Upcoming";
  if (kind === "pending") return "Pending Status";
  return null;
}

export function postingStatusLabelForTransaction(t: Transaction): string {
  return transactionStatusDisplayLabel(t) ?? "Complete";
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
  const status = isManualStoredTransaction(t) ? resolveManualPostingStatus(t) : normalizePostingStatus(t.postingStatus);
  if (status === "completed" && t.completedAtISO) return t.completedAtISO;
  return t.dateISO;
}

/** Included in real-time totals (net worth through today, category spend to date, etc.). */
export function transactionCountsInActualLedger(t: Transaction): boolean {
  if (!isManualStoredTransaction(t)) return true;
  return resolveManualPostingStatus(t) === "completed";
}

/**
 * Included in projected cash-flow / calendar balances on `throughISO`.
 * Planned manual txs count on their display date; completed txs use ledger date.
 */
export function transactionCountsInProjectedLedger(t: Transaction, throughISO: string): boolean {
  if (!isManualStoredTransaction(t)) return transactionLedgerDateISO(t) <= throughISO;
  const status = resolveManualPostingStatus(t);
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

export function postingStatusLabel(status: TransactionPostingStatus | undefined, dateISO?: string): string {
  if (status === "completed") return "Complete";
  if (status === "planned") {
    if (dateISO && dateISO > todayISO()) return "Upcoming";
    return "Pending Status";
  }
  if (dateISO && dateISO > todayISO()) return "Upcoming";
  return "Pending Status";
}
