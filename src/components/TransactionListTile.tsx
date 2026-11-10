import TransactionStatusBadge from "./TransactionStatusBadge";
import { flowForTransactionType } from "../lib/transactionTypes";
import { formatTransactionCategoryTypeLines, transactionListPrimaryTitle } from "../lib/ledger";
import type { FetyStore, Transaction } from "../types/fety";

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export default function TransactionListTile({
  transaction,
  store,
  onEdit,
  onDelete,
}: {
  transaction: Transaction;
  store: FetyStore;
  onEdit: () => void;
  onDelete?: () => void;
}) {
  const meta = formatTransactionCategoryTypeLines(transaction, store);
  const title = transactionListPrimaryTitle(transaction, store);
  const flow = flowForTransactionType(store, transaction.type);
  const amountColor =
    flow === "transfer" ? "var(--ink-2)" : transaction.amount >= 0 ? "var(--clear-dk)" : "var(--trouble-dk)";

  return (
    <li className="fety-mobile-txn-row">
      <div className="fety-mobile-txn-row-main">
        <span className="fety-mobile-txn-icon" aria-hidden>
          {transaction.icon}
        </span>
        <div className="fety-mobile-txn-text">
          <p className="fety-mobile-txn-title">{title}</p>
          <p className="fety-mobile-txn-meta">{meta.subtitle}</p>
        </div>
        <span className="fety-mobile-txn-amt" style={{ color: amountColor }}>
          {flow === "transfer"
            ? usd(Math.abs(transaction.amount))
            : `${transaction.amount >= 0 ? "+" : ""}${usd(transaction.amount)}`}
        </span>
      </div>
      <div className="fety-mobile-txn-row-actions">
        <div className="fety-mobile-txn-row-actions-primary">
          <button type="button" className="fety-mobile-link-btn" onClick={onEdit}>
            Edit
          </button>
          {onDelete ? (
            <button type="button" className="fety-mobile-link-btn fety-mobile-link-btn--danger" onClick={onDelete}>
              Delete
            </button>
          ) : null}
        </div>
        <TransactionStatusBadge transaction={transaction} />
      </div>
    </li>
  );
}
