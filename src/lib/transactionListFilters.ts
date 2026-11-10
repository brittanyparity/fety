import type { FetyTransactionType, Transaction } from "../types/fety";
import { todayISO } from "./fetyCalculations";
import { isManualStoredTransaction, transactionStatusDisplayKind } from "./transactionPosting";

export type TransactionListFilterState = {
  typeFilter: string;
  accountFilter: string;
  dateRangeStartISO: string;
  dateRangeEndISO: string;
  categoryFilter: string;
  statusFilter: "all" | "upcoming" | "completed";
  includeFutureDates: boolean;
};

export function defaultTransactionListFilters(initialAccountId?: string | null): TransactionListFilterState {
  return {
    typeFilter: "All",
    accountFilter: initialAccountId && initialAccountId !== "all" ? initialAccountId : "all",
    dateRangeStartISO: "",
    dateRangeEndISO: "",
    categoryFilter: "all",
    statusFilter: "all",
    includeFutureDates: false,
  };
}

export function transactionListFiltersActive(
  filters: TransactionListFilterState,
  baseline?: TransactionListFilterState,
): boolean {
  const base = baseline ?? defaultTransactionListFilters();
  return (
    filters.typeFilter !== base.typeFilter ||
    filters.accountFilter !== base.accountFilter ||
    filters.dateRangeStartISO !== base.dateRangeStartISO ||
    filters.dateRangeEndISO !== base.dateRangeEndISO ||
    filters.categoryFilter !== base.categoryFilter ||
    filters.statusFilter !== base.statusFilter ||
    filters.includeFutureDates !== base.includeFutureDates
  );
}

export function filterTransactionsList(
  transactions: Transaction[],
  filters: TransactionListFilterState,
  options: {
    transactionTypes: FetyTransactionType[];
    earliestDateISO?: string;
    today?: string;
  },
): Transaction[] {
  const today = options.today ?? todayISO();
  return transactions.filter((t) => {
    if (options.earliestDateISO && t.dateISO < options.earliestDateISO) return false;
    if (filters.accountFilter !== "all" && t.fromAccountId !== filters.accountFilter && t.toAccountId !== filters.accountFilter) {
      return false;
    }
    if (filters.typeFilter !== "All") {
      const tt = options.transactionTypes.find((x) => x.id === t.type);
      if (tt?.name !== filters.typeFilter && t.type !== filters.typeFilter) return false;
    }
    if (filters.dateRangeStartISO && filters.dateRangeEndISO) {
      if (t.dateISO < filters.dateRangeStartISO || t.dateISO > filters.dateRangeEndISO) return false;
    } else if (
      !filters.dateRangeStartISO &&
      !filters.dateRangeEndISO &&
      !filters.includeFutureDates &&
      t.dateISO > today
    ) {
      return false;
    }
    if (filters.categoryFilter !== "all" && t.category !== filters.categoryFilter) return false;
    if (filters.statusFilter !== "all") {
      if (!isManualStoredTransaction(t)) {
        if (filters.statusFilter === "upcoming") return false;
      } else {
        const kind = transactionStatusDisplayKind(t);
        if (filters.statusFilter === "upcoming" && kind !== "upcoming" && kind !== "pending") return false;
        if (filters.statusFilter === "completed" && kind !== "completed") return false;
      }
    }
    return true;
  });
}
