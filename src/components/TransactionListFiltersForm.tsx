import { useMemo } from "react";
import TransactionDateRangeFilter from "./TransactionDateRangeFilter";
import {
  allTransactionCategoryNames,
  isRetiredCategoryName,
  transactionCategoryPickerGroups,
} from "../lib/transactionCategories";
import type { Account, FetyStore, FetyTransactionType, Transaction } from "../types/fety";
import type { TransactionListFilterState } from "../lib/transactionListFilters";

type TransactionListFiltersFormProps = {
  store: FetyStore;
  transactions: Transaction[];
  transactionTypes: FetyTransactionType[];
  accounts: Account[];
  filters: TransactionListFilterState;
  onFiltersChange: (next: TransactionListFilterState) => void;
  endingBalanceForDate?: (dateISO: string) => number;
  layout?: "toolbar" | "stack";
};

export default function TransactionListFiltersForm({
  store,
  transactions,
  transactionTypes,
  accounts,
  filters,
  onFiltersChange,
  endingBalanceForDate,
  layout = "toolbar",
}: TransactionListFiltersFormProps) {
  const filterLabels = ["All", ...transactionTypes.map((t) => t.name)];

  const categoryFilterGroups = useMemo(() => {
    const include = filters.categoryFilter !== "all" && filters.categoryFilter.trim() ? filters.categoryFilter : undefined;
    const groups = transactionCategoryPickerGroups(store, include);
    const known = new Set(allTransactionCategoryNames(groups));
    const orphans: string[] = [];
    for (const t of transactions) {
      const name = t.category?.trim();
      if (!name || isRetiredCategoryName(name) || known.has(name)) continue;
      known.add(name);
      orphans.push(name);
    }
    orphans.sort((a, b) => a.localeCompare(b));
    return { ...groups, orphans };
  }, [store, filters.categoryFilter, transactions]);

  const patch = (partial: Partial<TransactionListFilterState>) => onFiltersChange({ ...filters, ...partial });

  const wrapperClass =
    layout === "toolbar" ? "fety-txn-toolbar-filters" : "fety-mobile-txn-filters-form fety-txn-toolbar-filters";

  return (
    <div className={wrapperClass}>
      <div className="fety-txn-toolbar-field">
        <span className="fety-label" id="fety-txn-filter-date-label">
          Date
        </span>
        <div className="fety-txn-toolbar-control-row">
          <TransactionDateRangeFilter
            rangeStartISO={filters.dateRangeStartISO}
            rangeEndISO={filters.dateRangeEndISO}
            endingBalanceForDate={endingBalanceForDate}
            onRangeChange={(start, end) => patch({ dateRangeStartISO: start, dateRangeEndISO: end })}
          />
        </div>
      </div>
      <div className="fety-txn-toolbar-field">
        <label className="fety-label" htmlFor="fety-txn-filter-category">
          Category
        </label>
        <select
          id="fety-txn-filter-category"
          className="fety-txn-toolbar-select"
          value={filters.categoryFilter}
          onChange={(e) => patch({ categoryFilter: e.target.value })}
        >
          <option value="all">All categories</option>
          {categoryFilterGroups.budget.length > 0 ? (
            <optgroup label="Budget categories">
              {categoryFilterGroups.budget.map((name) => (
                <option key={`budget-${name}`} value={name}>
                  {name}
                </option>
              ))}
            </optgroup>
          ) : null}
          {categoryFilterGroups.scheduledBills.length > 0 ? (
            <optgroup label="Bills">
              {categoryFilterGroups.scheduledBills.map((name) => (
                <option key={`bill-${name}`} value={name}>
                  {name}
                </option>
              ))}
            </optgroup>
          ) : null}
          {categoryFilterGroups.scheduledIncome.length > 0 ? (
            <optgroup label="Income">
              {categoryFilterGroups.scheduledIncome.map((name) => (
                <option key={`income-${name}`} value={name}>
                  {name}
                </option>
              ))}
            </optgroup>
          ) : null}
          {categoryFilterGroups.scheduledRecurring.length > 0 ? (
            <optgroup label="Recurring transactions">
              {categoryFilterGroups.scheduledRecurring.map((name) => (
                <option key={`recur-${name}`} value={name}>
                  {name}
                </option>
              ))}
            </optgroup>
          ) : null}
          {categoryFilterGroups.orphans.length > 0 ? (
            <optgroup label="Other">
              {categoryFilterGroups.orphans.map((name) => (
                <option key={`orphan-${name}`} value={name}>
                  {name}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
      </div>
      <div className="fety-txn-toolbar-field">
        <label className="fety-label" htmlFor="fety-txn-filter-status">
          Status
        </label>
        <select
          id="fety-txn-filter-status"
          className="fety-txn-toolbar-select"
          value={filters.statusFilter}
          onChange={(e) => patch({ statusFilter: e.target.value as TransactionListFilterState["statusFilter"] })}
        >
          <option value="all">All statuses</option>
          <option value="upcoming">Upcoming</option>
          <option value="completed">Completed</option>
        </select>
      </div>
      {accounts.length > 0 ? (
        <div className="fety-txn-toolbar-field">
          <label className="fety-label" htmlFor="fety-txn-filter-account">
            Account
          </label>
          <select
            id="fety-txn-filter-account"
            className="fety-txn-toolbar-select"
            value={filters.accountFilter}
            onChange={(e) => patch({ accountFilter: e.target.value })}
          >
            <option value="all">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.icon} {a.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="fety-txn-toolbar-field fety-txn-toolbar-field--types">
        <span className="fety-label">Type</span>
        <div className="fety-txn-toolbar-type-row" role="group" aria-label="Transaction type">
          {filterLabels.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => patch({ typeFilter: f })}
              className={`fety-txn-type-pill${filters.typeFilter === f ? " fety-txn-type-pill--active" : ""}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="fety-txn-toolbar-field fety-txn-toolbar-field--future">
        <label className="fety-txn-include-future">
          <input
            type="checkbox"
            checked={filters.includeFutureDates}
            onChange={(e) => patch({ includeFutureDates: e.target.checked })}
            disabled={Boolean(filters.dateRangeStartISO || filters.dateRangeEndISO)}
          />
          Include future dates
        </label>
        {!filters.dateRangeStartISO && !filters.dateRangeEndISO && !filters.includeFutureDates ? (
          <p className="fety-txn-date-hint">Showing all dates through today unless you set a range.</p>
        ) : null}
      </div>
    </div>
  );
}
