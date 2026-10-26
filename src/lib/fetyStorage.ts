import type {
  Bill,
  BudgetCategory,
  ChatMessage,
  FetyStore,
  Goal,
  RecurringTransaction,
  Transaction,
  Account,
  TransactionType,
  TypeIconMap,
} from "../types/fety";
import { normalizeCalendarNotes } from "./calendarNotes";
import { applyBillScheduleToStore, dedupeBills, isScheduledTransaction } from "./billScheduling";
import { normalizeAccountRecord } from "./ledger";
import { roundMoney } from "./scheduleAmounts";
import { defaultTransactionTypes, typeIconsFromTransactionTypes } from "./transactionTypes";

export const DEFAULT_TYPE_ICONS: TypeIconMap = {
  income: "💵",
  expense: "🛒",
  bill: "📋",
  transfer: "🏦",
};

const STORAGE_KEY = "fety-store-v1";

const SEED_MESSAGES: ChatMessage[] = [];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function seedGoalTransactions(): Transaction[] {
  return [
    {
      id: "tg1",
      dateISO: isoDaysAgo(2),
      desc: "Emergency fund deposit",
      category: "Savings",
      amount: -250,
      type: "transfer",
      icon: "🛡️",
      fromAccountId: "a1",
      toAccountId: "a2",
      goalId: "g1",
    },
    {
      id: "tg2",
      dateISO: isoDaysAgo(4),
      desc: "Vacation fund",
      category: "Savings",
      amount: -200,
      type: "transfer",
      icon: "✈️",
      fromAccountId: "a1",
      toAccountId: "a2",
      goalId: "g2",
    },
    {
      id: "tg3",
      dateISO: isoDaysAgo(8),
      desc: "Extra credit card payment",
      category: "Personal",
      amount: -400,
      type: "expense",
      icon: "💳",
      fromAccountId: "a1",
      goalId: "g3",
    },
    {
      id: "tg4",
      dateISO: isoDaysAgo(12),
      desc: "New car savings",
      category: "Savings",
      amount: -500,
      type: "transfer",
      icon: "🚗",
      fromAccountId: "a1",
      toAccountId: "a2",
      goalId: "g4",
    },
    {
      id: "tg5",
      dateISO: isoDaysAgo(16),
      desc: "Emergency fund — payday",
      category: "Savings",
      amount: -250,
      type: "transfer",
      icon: "🛡️",
      fromAccountId: "a1",
      toAccountId: "a2",
      goalId: "g1",
    },
    {
      id: "tg6",
      dateISO: isoDaysAgo(20),
      desc: "Vacation fund",
      category: "Savings",
      amount: -200,
      type: "transfer",
      icon: "✈️",
      fromAccountId: "a1",
      toAccountId: "a2",
      goalId: "g2",
    },
  ];
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
    ...seedGoalTransactions(),
  ];
}

const DEFAULT_GOAL_RECURRING: RecurringTransaction[] = [
  {
    id: "rec-goal-emergency",
    name: "Emergency fund auto-save",
    amount: 250,
    dueDay: 2,
    frequency: "monthly",
    category: "Savings",
    icon: "🛡️",
    transactionType: "transfer",
    fromAccountId: "a1",
    toAccountId: "a2",
    goalId: "g1",
  },
  {
    id: "rec-goal-vacation",
    name: "Vacation contribution",
    amount: 200,
    dueDay: 15,
    frequency: "monthly",
    category: "Savings",
    icon: "✈️",
    transactionType: "transfer",
    fromAccountId: "a1",
    toAccountId: "a2",
    goalId: "g2",
  },
];

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
  "weekly-power",
  "stat-balance",
  "stat-money-in",
  "stat-money-out",
  "stat-savings",
];

/** Widgets removed from the product; strip from saved pin lists. */
export const REMOVED_WIDGET_IDS = [
  "spending-power-hero",
  "today-balance",
  "money-in",
  "money-out",
  "monthly-net",
] as const;

/** Pre-curation defaults — used to detect stores still on the old starter set. */
export const LEGACY_DEFAULT_PINNED = [
  "balance-chart",
  "monthly-spend-chart",
  "budget-remaining",
  "spending-breakdown",
  "savings-goal",
  "next-paycheck",
  "biggest-bill",
];

/** First curated set (included spending-power hero). */
export const CURATED_V2_DEFAULT_PINNED = [
  "spending-power-hero",
  "stat-balance",
  "stat-money-in",
  "stat-money-out",
  "balance-chart",
  "budget-remaining",
  "spending-breakdown",
  "monthly-spend-chart",
  "next-paycheck",
  "biggest-bill",
];

/**
 * Curated starter dashboard: spending power, cash snapshot, trends,
 * budget health, goals, and upcoming money. Other widgets stay in Customise.
 */
export const DEFAULT_PINNED = [
  "weekly-power",
  "stat-balance",
  "stat-money-in",
  "stat-money-out",
  "balance-chart",
  "spending-breakdown",
  "budget-remaining",
  "savings-goal",
  "next-paycheck",
  "biggest-bill",
];

function pinnedEquals(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

function stripRemovedWidgets(pinned: string[]): string[] {
  const removed = new Set<string>(REMOVED_WIDGET_IDS);
  return pinned.filter((id) => !removed.has(id));
}
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
        text: "Welcome to Fety. Use Insights, Budget, and Transactions to stay on top of your money.",
        time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      },
    ],
    pinnedWidgets: DEFAULT_PINNED,
    typeIcons: { ...DEFAULT_TYPE_ICONS },
    transactionTypes: defaultTransactionTypes(),
    heroBlocksOptional: true,
    widgetsCuratedV2: true,
    widgetsCuratedV3: true,
    widgetsPersonalizedV1: false,
    widgetsPersonalizedV2: true,
    dashboardCustomizedByUser: false,
    calendarNotes: {},
    insightTipProgress: { doneIds: [], archivedIds: [] },
  };
}

/** Demo data for “Explore the platform” (no setup wizard). */
export function createExploreStore(): FetyStore {
  return {
    ...createDefaultStore(),
    exploreMode: true,
    incomeStreams: [
      {
        id: "inc-explore-1",
        name: "Employer Paycheck",
        amount: 2800,
        dueDay: 1,
        frequency: "semimonthly",
        category: "Income",
        icon: "💵",
        semiMonthlyDays: [1, 15],
        startDateISO: isoDaysAgo(90),
      },
    ],
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
      balanceAsOfISO: isoDaysAgo(30),
    },
    categories: DEFAULT_CATEGORIES,
    transactions: seedTransactions(),
    bills: DEFAULT_BILLS,
    recurringTransactions: DEFAULT_GOAL_RECURRING,
    goals: DEFAULT_GOALS,
    accounts: DEFAULT_ACCOUNTS,
    messages: SEED_MESSAGES,
    pinnedWidgets: DEFAULT_PINNED,
    typeIcons: { ...DEFAULT_TYPE_ICONS },
    transactionTypes: defaultTransactionTypes(),
    heroBlocksOptional: true,
    widgetsCuratedV2: true,
    widgetsCuratedV3: true,
    // Demo seed: allow needs assessment to curate pins on first load.
    widgetsPersonalizedV1: false,
    widgetsPersonalizedV2: true,
    dashboardCustomizedByUser: false,
  };
}

function migrateStore(store: FetyStore): FetyStore {
  const emptyProfile = createEmptyStore().profile;
  let next: FetyStore = {
    ...store,
    profile: {
      ...emptyProfile,
      ...(store.profile ?? {}),
      displayName: typeof store.profile?.displayName === "string" ? store.profile.displayName : "",
      email: typeof store.profile?.email === "string" ? store.profile.email : "",
      currency: store.profile?.currency ?? "USD",
      startingBalance: Number.isFinite(store.profile?.startingBalance) ? store.profile!.startingBalance : 0,
    },
    pinnedWidgets: Array.isArray(store.pinnedWidgets) ? store.pinnedWidgets : DEFAULT_PINNED,
    categories: Array.isArray(store.categories) ? store.categories : [],
    transactions: Array.isArray(store.transactions) ? store.transactions : [],
    bills: Array.isArray(store.bills) ? store.bills : [],
    goals: Array.isArray(store.goals) ? store.goals : [],
    accounts: Array.isArray(store.accounts) ? store.accounts : [],
    messages: Array.isArray(store.messages) ? store.messages : createEmptyStore().messages,
  };
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
  if (!next.widgetsCuratedV2) {
    const stillOnLegacyDefaults = pinnedEquals(next.pinnedWidgets, LEGACY_DEFAULT_PINNED);
    next = {
      ...next,
      pinnedWidgets: stillOnLegacyDefaults || !next.onboardingCompleted ? DEFAULT_PINNED : next.pinnedWidgets,
      widgetsCuratedV2: true,
    };
  }
  if (!next.widgetsCuratedV3) {
    const onPriorStarter =
      pinnedEquals(next.pinnedWidgets, LEGACY_DEFAULT_PINNED) ||
      pinnedEquals(next.pinnedWidgets, CURATED_V2_DEFAULT_PINNED);
    next = {
      ...next,
      pinnedWidgets: onPriorStarter || !next.onboardingCompleted
        ? DEFAULT_PINNED
        : stripRemovedWidgets(next.pinnedWidgets),
      widgetsCuratedV3: true,
    };
  } else {
    next = { ...next, pinnedWidgets: stripRemovedWidgets(next.pinnedWidgets) };
  }
  if (!next.incomeStreams) next = { ...next, incomeStreams: [] };
  if (!next.recurringTransactions) next = { ...next, recurringTransactions: [] };
  next = {
    ...next,
    calendarNotes: normalizeCalendarNotes(next.calendarNotes as Record<string, string | import("../types/fety").CalendarDayNote> | undefined),
  };
  if (!next.insightTipProgress) {
    next = { ...next, insightTipProgress: { doneIds: [], archivedIds: [] } };
  }
  if (next.onboardingCompleted && !next.profile.balanceAsOfISO) {
    next = {
      ...next,
      profile: { ...next.profile, balanceAsOfISO: isoDaysAgo(0) },
    };
  }
  if (next.dashboardCustomizedByUser === undefined) {
    next = { ...next, dashboardCustomizedByUser: false };
  }
  // One-time upgrade: re-apply need-driven pins for users who have not customized.
  if (!next.widgetsPersonalizedV2) {
    next = {
      ...next,
      widgetsPersonalizedV2: true,
      widgetsPersonalizedV1: next.dashboardCustomizedByUser ? true : false,
    };
  } else if (next.widgetsPersonalizedV1 === undefined) {
    next = {
      ...next,
      widgetsPersonalizedV1: next.dashboardCustomizedByUser === true,
    };
  }
  next = {
    ...next,
    categories: (next.categories ?? []).map((c) => ({
      ...c,
      monthlyBudget: roundMoney(c.monthlyBudget),
    })),
  };
  next = {
    ...next,
    accounts: (next.accounts ?? []).map((a) => normalizeAccountRecord(a, next)),
    transactions: next.transactions.filter((t) => !isScheduledTransaction(t.id)),
  };
  next = applyBillScheduleToStore(next);
  return ensureDemoGoalLinkedActivity(next);
}

/** Sample / demo stores get goal-linked txs so Goals surfaces (Insights bar, Goals page, etc.). */
function ensureDemoGoalLinkedActivity(store: FetyStore): FetyStore {
  const hasDefaultDemoGoals = store.goals.some((g) => g.id === "g1" && g.name === "Emergency Fund");
  if (!hasDefaultDemoGoals) return store;

  const hasGoalTx = store.transactions.some((t) => t.goalId);
  const hasGoalRecurring = (store.recurringTransactions ?? []).some((r) => r.goalId);
  if (hasGoalTx && hasGoalRecurring) return store;

  const existingIds = new Set(store.transactions.map((t) => t.id));
  const extraTx = seedGoalTransactions().filter((t) => !existingIds.has(t.id));
  const existingRecurIds = new Set((store.recurringTransactions ?? []).map((r) => r.id));
  const extraRecur = DEFAULT_GOAL_RECURRING.filter((r) => !existingRecurIds.has(r.id));

  if (extraTx.length === 0 && extraRecur.length === 0) return store;

  return {
    ...store,
    transactions: extraTx.length ? [...store.transactions, ...extraTx] : store.transactions,
    recurringTransactions: extraRecur.length
      ? [...(store.recurringTransactions ?? []), ...extraRecur]
      : store.recurringTransactions,
  };
}

export function loadStore(): FetyStore {
  if (typeof window === "undefined") return createEmptyStore();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyStore();
    const parsed = JSON.parse(raw) as FetyStore;
    if (parsed?.version !== 1) return createEmptyStore();
    const migrated = migrateStore(parsed);
    const goalTxAdded =
      migrated.transactions.length !== parsed.transactions.length ||
      (migrated.recurringTransactions?.length ?? 0) !== (parsed.recurringTransactions?.length ?? 0);
    if (goalTxAdded) saveStore(migrated);
    return migrated;
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
