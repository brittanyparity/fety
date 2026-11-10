import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import AddTransactionModal, {
  type AddTransactionModalActions,
  type AddTransactionPayload,
} from "../components/AddTransactionModal";
import EditTransactionModal from "../components/EditTransactionModal";
import TransactionListFiltersForm from "../components/TransactionListFiltersForm";
import TransactionListTile from "../components/TransactionListTile";
import { endingBalanceOnDate, formatTransactionGroupDate, todayISO } from "../lib/fetyCalculations";
import {
  defaultTransactionListFilters,
  filterTransactionsList,
  transactionListFiltersActive,
  type TransactionListFilterState,
} from "../lib/transactionListFilters";
import type { FetyStore, Transaction } from "../types/fety";
import MobileFabAdd from "./MobileFabAdd";

export default function MobileTransactionsTab({
  store,
  onAdd,
  addTransactionActions,
  onUpdate,
  onDelete,
  accountFilter,
  filtersOpen,
  onFiltersOpenChange,
  onFiltersActiveChange,
}: {
  store: FetyStore;
  onAdd: (input: AddTransactionPayload) => void;
  addTransactionActions?: AddTransactionModalActions;
  onUpdate: (
    id: string,
    updates: Partial<
      Pick<Transaction, "desc" | "amount" | "type" | "category" | "dateISO" | "fromAccountId" | "toAccountId" | "goalId" | "postingStatus" | "completedAtISO">
    >,
  ) => void;
  onDelete: (id: string) => void;
  onCompleteTransaction?: (id: string, completedAtISO?: string) => void;
  onMarkTransactionUpcoming?: (id: string) => void;
  accountFilter?: string | null;
  filtersOpen: boolean;
  onFiltersOpenChange: (open: boolean) => void;
  onFiltersActiveChange?: (active: boolean) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editTxn, setEditTxn] = useState<Transaction | null>(null);
  const [filters, setFilters] = useState<TransactionListFilterState>(() =>
    defaultTransactionListFilters(accountFilter),
  );
  const filterBaseline = useMemo(() => defaultTransactionListFilters(accountFilter), [accountFilter]);
  const today = todayISO();

  useEffect(() => {
    if (accountFilter) setFilters((f) => ({ ...f, accountFilter: accountFilter }));
    else if (accountFilter === null) setFilters((f) => ({ ...f, accountFilter: "all" }));
  }, [accountFilter]);

  useEffect(() => {
    if (!filtersOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFiltersOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtersOpen]);

  const endingBalanceForDate = useMemo(
    () => (dateISO: string) => endingBalanceOnDate(store, dateISO),
    [store],
  );

  const filtersActive = transactionListFiltersActive(filters, filterBaseline);

  useEffect(() => {
    onFiltersActiveChange?.(filtersActive);
  }, [filtersActive, onFiltersActiveChange]);

  const shown = useMemo(
    () =>
      filterTransactionsList(store.transactions, filters, {
        transactionTypes: store.transactionTypes,
        earliestDateISO: store.profile.balanceAsOfISO,
      }),
    [store.transactions, store.transactionTypes, store.profile.balanceAsOfISO, filters],
  );

  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of shown) {
      if (!map.has(t.dateISO)) map.set(t.dateISO, []);
      map.get(t.dateISO)!.push(t);
    }
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [shown]);

  return (
    <div className="fety-mobile-transactions fety-mobile-transactions--split">
      <div className="fety-mobile-transactions-scroll">
        <div className="fety-mobile-txn-list">
          {groups.length === 0 ? (
            <p className="fety-mobile-empty">
              {store.transactions.length === 0
                ? "No transactions yet. Add one to get started."
                : "No transactions match these filters."}
            </p>
          ) : (
            groups.map(([dateISO, txns]) => (
              <section key={dateISO} className="fety-mobile-txn-group">
                <h3 className="fety-mobile-txn-group-date">
                  {formatTransactionGroupDate(dateISO)}
                  {dateISO > today ? <span className="fety-mobile-txn-upcoming">Upcoming</span> : null}
                </h3>
                <ul>
                  {txns.map((t) => (
                    <TransactionListTile
                      key={t.id}
                      transaction={t}
                      store={store}
                      onEdit={() => setEditTxn(t)}
                      onDelete={() => onDelete(t.id)}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </div>
      <MobileFabAdd onClick={() => setAddOpen(true)} />
      {filtersOpen
        ? createPortal(
            <div className="fety-modal fety-modal--mobile-sheet" role="dialog" aria-modal="true" aria-labelledby="fety-mobile-txn-filters-title">
              <button
                type="button"
                className="fety-modal-backdrop"
                aria-label="Close filters"
                onClick={() => onFiltersOpenChange(false)}
              />
              <div className="fety-modal-panel fety-modal-panel--mobile-filters">
                <header className="fety-modal-header">
                  <h2 id="fety-mobile-txn-filters-title" className="fety-modal-title">
                    Filters
                  </h2>
                  <button type="button" className="fety-modal-close" aria-label="Close" onClick={() => onFiltersOpenChange(false)}>
                    ×
                  </button>
                </header>
                <div className="fety-mobile-txn-filters-body">
                  <TransactionListFiltersForm
                    store={store}
                    transactions={store.transactions}
                    transactionTypes={store.transactionTypes}
                    accounts={store.accounts}
                    filters={filters}
                    onFiltersChange={setFilters}
                    endingBalanceForDate={endingBalanceForDate}
                    layout="stack"
                  />
                </div>
                <div className="fety-mobile-txn-filters-foot">
                  <button
                    type="button"
                    className="fety-modal-btn-secondary"
                    onClick={() => setFilters(filterBaseline)}
                  >
                    Reset
                  </button>
                  <button type="button" className="fety-modal-btn-primary" onClick={() => onFiltersOpenChange(false)}>
                    Done
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
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
