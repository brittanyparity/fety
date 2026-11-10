import type { FetyTransactionType, Transaction } from "../types/fety";

function typeFiltersDiffer(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return true;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.some((v, i) => v !== sb[i]);
}

export function transactionMatchesTypeFilters(
  t: Transaction,
  typeFilters: string[],
  transactionTypes: FetyTransactionType[],
): boolean {
  if (typeFilters.length === 0) return true;
  const tt = transactionTypes.find((x) => x.id === t.type);
  return typeFilters.some((f) => f === tt?.name || f === t.type);
}
import { todayISO } from "./fetyCalculations";
import { isManualStoredTransaction, transactionStatusDisplayKind } from "./transactionPosting";

/** Empty = all transaction types. Values are type display names from `FetyTransactionType.name`. */
export type TransactionListFilterState = {
  typeFilters: string[];
  accountFilter: string;
  dateRangeStartISO: string;
  dateRangeEndISO: string;
  categoryFilter: string;
  statusFilter: "all" | "upcoming" | "pending" | "completed";
  includeFutureDates: boolean;
};

export function defaultTransactionListFilters(initialAccountId?: string | null): TransactionListFilterState {
  return {
    typeFilters: [],
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
    typeFiltersDiffer(filters.typeFilters, base.typeFilters) ||
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
    if (!transactionMatchesTypeFilters(t, filters.typeFilters, options.transactionTypes)) return false;
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
        if (filters.statusFilter !== "upcoming") return false;
      } else {
        const kind = transactionStatusDisplayKind(t);
        if (filters.statusFilter === "upcoming" && kind !== "upcoming") return false;
        if (filters.statusFilter === "pending" && kind !== "pending") return false;
        if (filters.statusFilter === "completed" && kind !== "completed") return false;
      }
    }
    return true;
  });
}
