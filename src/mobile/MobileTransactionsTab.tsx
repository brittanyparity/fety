import { useMemo, useState } from "react";
import AddTransactionModal, {
  type AddTransactionModalActions,
  type AddTransactionPayload,
} from "../components/AddTransactionModal";
import EditTransactionModal from "../components/EditTransactionModal";
import { formatTransactionGroupDate, todayISO } from "../lib/fetyCalculations";
import { flowForTransactionType } from "../lib/transactionTypes";
import { formatTransactionCategoryTypeLines, transactionListPrimaryTitle } from "../lib/ledger";
import { isManualStoredTransaction, normalizePostingStatus, postingStatusLabel } from "../lib/transactionPosting";
import type { FetyStore, Transaction } from "../types/fety";

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export default function MobileTransactionsTab({
  store,
  onAdd,
  addTransactionActions,
  onUpdate,
  onDelete,
  onCompleteTransaction,
  onMarkTransactionUpcoming,
}: {
  store: FetyStore;
  onAdd: (input: AddTransactionPayload) => void;
  addTransactionActions?: AddTransactionModalActions;
  onUpdate: (
    id: string,
    updates: Partial<
      Pick<Transaction, "desc" | "amount" | "type" | "category" | "dateISO" | "fromAccountId" | "toAccountId" | "goalId">
    >,
  ) => void;
  onDelete: (id: string) => void;
  onCompleteTransaction?: (id: string, completedAtISO?: string) => void;
  onMarkTransactionUpcoming?: (id: string) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editTxn, setEditTxn] = useState<Transaction | null>(null);
  const [includeFuture, setIncludeFuture] = useState(false);
  const today = todayISO();

  const shown = useMemo(() => {
    return store.transactions
      .filter((t) => {
        if (!includeFuture && t.dateISO > today) return false;
        return true;
      })
      .sort((a, b) => b.dateISO.localeCompare(a.dateISO) || b.id.localeCompare(a.id));
  }, [store.transactions, includeFuture, today]);

  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of shown) {
      if (!map.has(t.dateISO)) map.set(t.dateISO, []);
      map.get(t.dateISO)!.push(t);
    }
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [shown]);

  return (
    <div className="fety-mobile-transactions">
      <div className="fety-mobile-section-head">
        <h2 className="fety-mobile-section-title">All transactions</h2>
        <label className="fety-mobile-check">
          <input type="checkbox" checked={includeFuture} onChange={(e) => setIncludeFuture(e.target.checked)} />
          Include future
        </label>
      </div>
      <button type="button" className="fety-mobile-primary-btn fety-mobile-primary-btn--block" onClick={() => setAddOpen(true)}>
        Add transaction
      </button>
      <div className="fety-mobile-txn-list">
        {groups.length === 0 ? (
          <p className="fety-mobile-empty">No transactions yet. Add one to get started.</p>
        ) : (
          groups.map(([dateISO, txns]) => (
            <section key={dateISO} className="fety-mobile-txn-group">
              <h3 className="fety-mobile-txn-group-date">
                {formatTransactionGroupDate(dateISO)}
                {dateISO > today ? <span className="fety-mobile-txn-upcoming">Upcoming</span> : null}
              </h3>
              <ul>
                {txns.map((t) => (
                  <MobileTxnRow
                    key={t.id}
                    t={t}
                    store={store}
                    onEdit={() => setEditTxn(t)}
                    onDelete={() => onDelete(t.id)}
                    onComplete={onCompleteTransaction}
                    onMarkUpcoming={onMarkTransactionUpcoming}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
      <AddTransactionModal
        open={addOpen}
        dateISO={todayISO()}
        store={store}
        onClose={() => setAddOpen(false)}
        onSubmit={onAdd}
        actions={addTransactionActions}
      />
      <EditTransactionModal
        open={editTxn != null}
        transaction={editTxn}
        store={store}
        onClose={() => setEditTxn(null)}
        onSave={onUpdate}
        onDelete={(id) => {
          onDelete(id);
          setEditTxn(null);
        }}
      />
    </div>
  );
}

function MobileTxnRow({
  t,
  store,
  onEdit,
  onDelete,
  onComplete,
  onMarkUpcoming,
}: {
  t: Transaction;
  store: FetyStore;
  onEdit: () => void;
  onDelete: () => void;
  onComplete?: (id: string, completedAtISO?: string) => void;
  onMarkUpcoming?: (id: string) => void;
}) {
  const manual = isManualStoredTransaction(t);
  const status = manual ? normalizePostingStatus(t.postingStatus) : "completed";
  const meta = formatTransactionCategoryTypeLines(t, store);
  const title = transactionListPrimaryTitle(t, store);
  const flow = flowForTransactionType(store, t.type);
  const amountColor =
    flow === "transfer" ? "var(--ink-2)" : t.amount >= 0 ? "var(--clear-dk)" : "var(--trouble-dk)";

  return (
    <li className="fety-mobile-txn-row">
      <div className="fety-mobile-txn-row-main">
        <span className="fety-mobile-txn-icon" aria-hidden>
          {t.icon}
        </span>
        <div className="fety-mobile-txn-text">
          <p className="fety-mobile-txn-title">{title}</p>
          <p className="fety-mobile-txn-meta">{meta.subtitle}</p>
          {manual ? (
            <span className={`fety-mobile-txn-status fety-mobile-txn-status--${status}`}>
              {postingStatusLabel(t.postingStatus)}
            </span>
          ) : null}
        </div>
        <span className="fety-mobile-txn-amt" style={{ color: amountColor }}>
          {flow === "transfer" ? usd(Math.abs(t.amount)) : `${t.amount >= 0 ? "+" : ""}${usd(t.amount)}`}
        </span>
      </div>
      <div className="fety-mobile-txn-row-actions">
        <button type="button" className="fety-mobile-link-btn" onClick={onEdit}>
          Edit
        </button>
        {manual && status === "planned" && onComplete ? (
          <button type="button" className="fety-mobile-link-btn" onClick={() => onComplete(t.id, todayISO())}>
            Complete
          </button>
        ) : null}
        {manual && status === "completed" && onMarkUpcoming ? (
          <button type="button" className="fety-mobile-link-btn" onClick={() => onMarkUpcoming(t.id)}>
            Mark upcoming
          </button>
        ) : null}
        <button type="button" className="fety-mobile-link-btn fety-mobile-link-btn--danger" onClick={onDelete}>
          Delete
        </button>
      </div>
    </li>
  );
}
