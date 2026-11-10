import {
  isManualStoredTransaction,
  resolveManualPostingStatus,
  transactionStatusDisplayKind,
  transactionStatusDisplayLabel,
} from "../lib/transactionPosting";
import type { Transaction } from "../types/fety";

export default function TransactionStatusBadge({ transaction }: { transaction: Transaction }) {
  if (!isManualStoredTransaction(transaction)) {
    return (
      <span className="fety-txn-status-badge fety-txn-status-badge--upcoming">
        <ClockIcon />
        <span>Upcoming</span>
      </span>
    );
  }

  const kind = transactionStatusDisplayKind(transaction);
  const label = transactionStatusDisplayLabel(transaction);
  if (!kind || !label) return null;

  return (
    <span className={`fety-txn-status-badge fety-txn-status-badge--${kind}`}>
      {kind === "completed" ? <CheckIcon /> : <ClockIcon />}
      <span>{label}</span>
    </span>
  );
}

/** For edit forms — whether the txn is treated as completed. */
export function transactionIsMarkedComplete(transaction: Pick<Transaction, "postingStatus" | "dateISO">): boolean {
  return resolveManualPostingStatus(transaction) === "completed";
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="fety-txn-status-badge-icon">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 12.5 10.5 15 16 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="fety-txn-status-badge-icon">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
