import type { Bill, BudgetCategory, ChatMessage, FetyStore, Goal, Transaction, Account, TransactionType, TypeIconMap } from "../types/fety";
import { applyBillScheduleToStore, dedupeBills, isScheduledTransaction } from "./billScheduling";
import { normalizeAccountRecord } from "./ledger";
import { defaultTransactionTypes, typeIconsFromTransactionTypes } from "./transactionTypes";

export const DEFAULT_TYPE_ICONS: TypeIconMap = {
  income: "💵",
  expense: "🛒",
  bill: "📋",
  transfer: "🏦",
};

const STORAGE_KEY = "fety-store-v1";

const SEED_MESSAGES: ChatMessage[] = [
  { id: 1, role: "system", text: "Morning. You've got $140 of spending power this week — after every bill I know about.", time: "8:00 AM" },
  { id: 2, role: "user", text: "Just paid the electric bill, $142.", time: "8:14 AM" },
  { id: 3, role: "system", text: "Logged to Bills. $10 left in that budget, and nothing else due this month.", time: "8:14 AM", tag: "Budget updated" },
  { id: 4, role: "user", text: "Groceries at Whole Foods, about $52.", time: "9:31 AM" },
  { id: 5, role: "system", text: "Added $52 to Groceries. $128 left in that budget for September.", time: "9:31 AM", tag: "Transaction added" },
  { id: 6, role: "user", text: "Freelance payment of $350 came in today.", time: "11:02 AM" },
  { id: 7, role: "system", text: "Recorded +$350 income. Spending power this week is now $140.", time: "11:02 AM", tag: "Income recorded" },
];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function seedTransactions(): Transaction[] {
  return [
    { id: "t1", dateISO: isoDaysAgo(0), desc: "Whole Foods Market", category: "Groceries", amount: -52.4, type: "expense", icon: "🛒" },
    { id: "t2", dateISO: isoDaysAgo(0), desc: "Freelance Invoice", category: "Income", amount: 350, type: "income", icon: "💼" },
    { id: "t3", dateISO: isoDaysAgo(1), desc: "Electric Bill", category: "Bills", amount: -142, type: "bill", icon: "⚡" },
    { id: "t4", dateISO: isoDaysAgo(1), desc: "Amazon", category: "Shopping", amount: -89.99, type: "expense", icon: "📦" },
    { id: "t5", dateISO: isoDaysAgo(17), desc: "Employer Paycheck", category: "Income", amount: 2800, type: "income", icon: "💵" },
    { id: "t6", dateISO: isoDaysAgo(17), desc: "Gas Station", category: "Transportation", amount: -48, type: "expense", icon: "⛽" },
    { id: "t7", dateISO: isoDaysAgo(19), desc: "Trader Joe's", category: "Groceries", amount: -87.32, type: "expense", icon: "🛒" },
    { id: "t8", dateISO: isoDaysAgo(19), desc: "Savings Transfer", category: "Savings", amount: -200, type: "transfer", icon: "🏦" },
  ];
}

const DEFAULT_CATEGORIES: BudgetCategory[] = [
  { id: "c1", name: "Housing", icon: "🏠", monthlyBudget: 2000 },
  { id: "c2", name: "Groceries", icon: "🛒", monthlyBudget: 500 },
  { id: "c3", name: "Dining Out", icon: "🍽️", monthlyBudget: 200 },
  { id: "c4", name: "Transportation", icon: "🚗", monthlyBudget: 250 },
  { id: "c5", name: "Shopping", icon: "🛍️", monthlyBudget: 400 },
  { id: "c6", name: "Entertainment", icon: "🎬", monthlyBudget: 150 },
  { id: "c7", name: "Bills", icon: "⚡", monthlyBudget: 900 },
  { id: "c8", name: "Personal", icon: "💆", monthlyBudget: 200 },
];

const DEFAULT_BILLS: Bill[] = [
  { id: "b1", name: "Rent", amount: 2000, dueDay: 2, frequency: "monthly", category: "Housing", icon: "🏠", autopay: true },
  { id: "b2", name: "Electric", amount: 142, dueDay: 5, frequency: "monthly", category: "Bills", icon: "⚡" },
  { id: "b3", name: "Internet", amount: 65, dueDay: 14, frequency: "monthly", category: "Bills", icon: "🌐" },
  { id: "b4", name: "Phone", amount: 85, dueDay: 5, frequency: "monthly", category: "Bills", icon: "📱" },
];

const DEFAULT_GOALS: Goal[] = [
  { id: "g1", name: "Emergency Fund", icon: "🛡️", target: 5000, saved: 3250, targetDate: "Dec 2026", monthlyContribution: 250 },
  { id: "g2", name: "Vacation", icon: "✈️", target: 2500, saved: 1200, targetDate: "Jun 2026", monthlyContribution: 200 },
  { id: "g3", name: "Debt Payoff", icon: "💳", target: 10000, saved: 6750, targetDate: "Mar 2027", monthlyContribution: 400 },
  { id: "g4", name: "New Car", icon: "🚗", target: 20000, saved: 4000, targetDate: "Jan 2028", monthlyContribution: 500 },
];

const DEFAULT_ACCOUNTS: Account[] = [
  { id: "a1", name: "Chase Checking", type: "Checking", balance: 3278, icon: "🏦", balanceAsOfISO: isoDaysAgo(30) },
  { id: "a2", name: "Marcus Savings", type: "Savings", balance: 8420, icon: "💰", balanceAsOfISO: isoDaysAgo(30) },
  { id: "a3", name: "Visa Platinum", type: "Credit Card", balance: -614, icon: "💳", kind: "debt", balanceAsOfISO: isoDaysAgo(30) },
];

/** Former dashboard hero blocks — available in picker, not pinned by default. */
export const OPTIONAL_HERO_WIDGET_IDS = [
  "spending-power-hero",
  "weekly-power",
  "stat-balance",
  "stat-money-in",
  "stat-money-out",
  "stat-savings",
];

export const DEFAULT_PINNED = [
  "balance-chart",
  "monthly-spend-chart",
  "budget-remaining",
  "spending-breakdown",
  "savings-goal",
  "next-paycheck",
  "biggest-bill",
];

export function createEmptyStore(): FetyStore {
  return {
    version: 1,
    onboardingCompleted: false,
    profile: {
      displayName: "",
      email: "",
      currency: "USD",
      startingBalance: 0,
    },
    categories: [],
    transactions: [],
    bills: [],
    incomeStreams: [],
    recurringTransactions: [],
    goals: [],
    accounts: [],
    messages: [
      {
        id: 1,
        role: "system",
        text: "Welcome to Fety. Tell me about money in or out — include amounts — and I will update your books.",
        time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      },
    ],
    pinnedWidgets: DEFAULT_PINNED,
    typeIcons: { ...DEFAULT_TYPE_ICONS },
    transactionTypes: defaultTransactionTypes(),
    heroBlocksOptional: true,
  };
}

export function createDefaultStore(): FetyStore {
  return {
    version: 1,
    onboardingCompleted: true,
    profile: {
      displayName: "Alex",
      email: "alex@example.com",
      currency: "USD",
      startingBalance: 1820,
    },
    categories: DEFAULT_CATEGORIES,
    transactions: seedTransactions(),
    bills: DEFAULT_BILLS,
    goals: DEFAULT_GOALS,
    accounts: DEFAULT_ACCOUNTS,
    messages: SEED_MESSAGES,
    pinnedWidgets: DEFAULT_PINNED,
    typeIcons: { ...DEFAULT_TYPE_ICONS },
    transactionTypes: defaultTransactionTypes(),
    heroBlocksOptional: true,
  };
}

function migrateStore(store: FetyStore): FetyStore {
  let next = store;
  if (store.onboardingCompleted === undefined) {
    next = { ...next, onboardingCompleted: true };
  }
  if (!next.typeIcons) {
    next = { ...next, typeIcons: { ...DEFAULT_TYPE_ICONS } };
  }
  if (!next.heroBlocksOptional) {
    const filtered = next.pinnedWidgets.filter((id) => !OPTIONAL_HERO_WIDGET_IDS.includes(id));
    next = {
      ...next,
      pinnedWidgets: filtered.length > 0 ? filtered : DEFAULT_PINNED,
      heroBlocksOptional: true,
    };
  }
  next = {
    ...next,
    bills: dedupeBills(next.bills.map((b) => ({ ...b, frequency: b.frequency ?? "monthly" }))),
  };
  if (!next.transactionTypes?.length) {
    const types = defaultTransactionTypes(next.typeIcons);
    next = { ...next, transactionTypes: types, typeIcons: typeIconsFromTransactionTypes(types) };
  }
  if (!next.lockedDashboardWidgets) {
    next = { ...next, lockedDashboardWidgets: [] };
  }
  if (!next.incomeStreams) next = { ...next, incomeStreams: [] };
  if (!next.recurringTransactions) next = { ...next, recurringTransactions: [] };
  next = {
    ...next,
    accounts: (next.accounts ?? []).map((a) => normalizeAccountRecord(a, next)),
    transactions: next.transactions.filter((t) => !isScheduledTransaction(t.id)),
  };
  return applyBillScheduleToStore(next);
}

export function loadStore(): FetyStore {
  if (typeof window === "undefined") return createEmptyStore();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyStore();
    const parsed = JSON.parse(raw) as FetyStore;
    if (parsed?.version !== 1) return createEmptyStore();
    return migrateStore(parsed);
  } catch {
    return createEmptyStore();
  }
}

export function saveStore(store: FetyStore): void {
  if (typeof window === "undefined") return;
  const toSave: FetyStore = {
    ...store,
    transactions: store.transactions.filter((t) => !isScheduledTransaction(t.id)),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

export function resetStore(): FetyStore {
  const fresh = createDefaultStore();
  saveStore(fresh);
  return fresh;
}

export function resetToEmptyStore(): FetyStore {
  const fresh = createEmptyStore();
  saveStore(fresh);
  return fresh;
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
