import type { BudgetCategory, FetyStore, ScheduledItemKind, TransactionFlow } from "../types/fety";
import { scheduledItemStoredCategory } from "./scheduledItemCatalog";

/** Never shown as budget tiles; legacy labels are remapped on load. */
export const REMOVED_BUDGET_CATEGORY_NAMES = ["Income", "Bills"] as const;
export const REMOVED_BUDGET_CATEGORY_SET = new Set<string>(REMOVED_BUDGET_CATEGORY_NAMES);

/** Not offered in pickers or budget tiles; legacy data is remapped on load. */
export const HIDDEN_TRANSACTION_PICKER_NAMES = ["Housing", "Savings", "Other", "Utilities"] as const;
export const HIDDEN_TRANSACTION_PICKER_SET = new Set<string>(HIDDEN_TRANSACTION_PICKER_NAMES);

/** Default when retiring legacy category labels on transactions. */
export const LEGACY_CATEGORY_FALLBACK = "Shopping";

export function isRemovedBudgetCategoryName(name: string): boolean {
  return REMOVED_BUDGET_CATEGORY_SET.has(name.trim());
}

export function isHiddenTransactionPickerCategory(name: string): boolean {
  return HIDDEN_TRANSACTION_PICKER_SET.has(name.trim());
}

export function isRetiredCategoryName(name: string): boolean {
  const trimmed = name.trim();
  return isRemovedBudgetCategoryName(trimmed) || isHiddenTransactionPickerCategory(trimmed);
}

export function remapLegacyTransactionCategoryLabel(category: string): string {
  const trimmed = category.trim();
  if (isRetiredCategoryName(trimmed)) return LEGACY_CATEGORY_FALLBACK;
  return category;
}

export function filterBudgetCategories(categories: BudgetCategory[]): BudgetCategory[] {
  return categories.filter((c) => !isRemovedBudgetCategoryName(c.name) && !isHiddenTransactionPickerCategory(c.name));
}

/** Goal linked on the budget category tile, if any. */
export function goalIdForBudgetCategory(store: FetyStore, categoryName: string): string | undefined {
  const name = categoryName.trim();
  if (!name) return undefined;
  return filterBudgetCategories(store.categories).find((c) => c.name === name)?.goalId;
}

export type TransactionCategoryPickerGroups = {
  budget: string[];
  scheduledBills: string[];
  scheduledIncome: string[];
  scheduledRecurring: string[];
};

function uniqueSortedNames(names: string[]): string[] {
  return [...new Set(names.map((n) => n.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function scheduledItemCategoryNames(store: FetyStore): string[] {
  const names = new Set<string>();
  for (const b of store.bills ?? []) {
    names.add(scheduledItemStoredCategory(b.name));
  }
  for (const s of store.incomeStreams ?? []) {
    names.add(scheduledItemStoredCategory(s.name));
  }
  for (const r of store.recurringTransactions ?? []) {
    names.add(scheduledItemStoredCategory(r.name));
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

function filterPickerNames(names: string[]): string[] {
  return names.filter((n) => !isHiddenTransactionPickerCategory(n));
}

/** Budget categories and scheduled items by column for transaction pickers. */
export function transactionCategoryPickerGroups(
  store: FetyStore,
  includeValue?: string,
): TransactionCategoryPickerGroups {
  let budget = filterPickerNames(filterBudgetCategories(store.categories).map((c) => c.name));

  let scheduledBills = filterPickerNames(
    uniqueSortedNames((store.bills ?? []).map((b) => scheduledItemStoredCategory(b.name))),
  );
  let scheduledIncome = filterPickerNames(
    uniqueSortedNames((store.incomeStreams ?? []).map((s) => scheduledItemStoredCategory(s.name))),
  );
  let scheduledRecurring = filterPickerNames(
    uniqueSortedNames((store.recurringTransactions ?? []).map((r) => scheduledItemStoredCategory(r.name))),
  );

  const extra = includeValue?.trim();
  if (extra && !isRetiredCategoryName(extra)) {
    const known = new Set([...budget, ...scheduledBills, ...scheduledIncome, ...scheduledRecurring]);
    if (!known.has(extra)) {
      budget = uniqueSortedNames([...budget, extra]);
    }
  }

  return { budget, scheduledBills, scheduledIncome, scheduledRecurring };
}

export function allTransactionCategoryNames(groups: TransactionCategoryPickerGroups): string[] {
  return [...groups.budget, ...groups.scheduledBills, ...groups.scheduledIncome, ...groups.scheduledRecurring];
}

/** Deposit → income streams only; expense & transfer → budget, bills, recurring. */
export function filterPickerGroupsForFlow(
  groups: TransactionCategoryPickerGroups,
  flow: TransactionFlow,
): TransactionCategoryPickerGroups {
  if (flow === "income") {
    return {
      budget: [],
      scheduledBills: [],
      scheduledIncome: groups.scheduledIncome,
      scheduledRecurring: [],
    };
  }
  return {
    budget: groups.budget,
    scheduledBills: groups.scheduledBills,
    scheduledIncome: [],
    scheduledRecurring: groups.scheduledRecurring,
  };
}

export function resolveTransactionCategory(groups: TransactionCategoryPickerGroups, value: string): string {
  const trimmed = value.trim();
  if (!trimmed || isRetiredCategoryName(trimmed)) return "";
  const all = allTransactionCategoryNames(groups);
  return all.includes(trimmed) ? trimmed : "";
}

export function iconForTransactionCategory(store: FetyStore, categoryName: string): string | undefined {
  const name = categoryName.trim();
  if (!name) return undefined;
  const budget = filterBudgetCategories(store.categories).find((c) => c.name === name);
  if (budget?.icon) return budget.icon;
  for (const b of store.bills ?? []) {
    if (scheduledItemStoredCategory(b.name) === name) return b.icon;
  }
  for (const s of store.incomeStreams ?? []) {
    if (scheduledItemStoredCategory(s.name) === name) return s.icon;
  }
  for (const r of store.recurringTransactions ?? []) {
    if (scheduledItemStoredCategory(r.name) === name) return r.icon;
  }
  return undefined;
}

export function scheduledItemRefForCategory(
  store: FetyStore,
  categoryName: string,
): { kind: ScheduledItemKind; id: string } | null {
  const name = categoryName.trim();
  if (!name) return null;
  const matches: { kind: ScheduledItemKind; id: string }[] = [];
  for (const b of store.bills ?? []) {
    if (scheduledItemStoredCategory(b.name) === name) matches.push({ kind: "bill", id: b.id });
  }
  for (const s of store.incomeStreams ?? []) {
    if (scheduledItemStoredCategory(s.name) === name) matches.push({ kind: "income", id: s.id });
  }
  for (const r of store.recurringTransactions ?? []) {
    if (scheduledItemStoredCategory(r.name) === name) matches.push({ kind: "recur", id: r.id });
  }
  if (matches.length === 0) return null;
  return matches[0];
}
