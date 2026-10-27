/** Transaction type id (built-in or user-defined). */
export type TransactionType = string;

export type TransactionFlow = "income" | "expense" | "bill" | "transfer";

export interface FetyTransactionType {
  id: string;
  name: string;
  icon: string;
  flow: TransactionFlow;
  /** Core types cannot be removed. */
  locked?: boolean;
}

export type ScheduledItemKind = "bill" | "income" | "recur";

export interface Transaction {
  id: string;
  dateISO: string;
  desc: string;
  category: string;
  amount: number;
  type: TransactionType;
  icon: string;
  /** Money leaving this account (expense, bill, or transfer source). */
  fromAccountId?: string;
  /** Money entering this account (income or transfer destination). */
  toAccountId?: string;
  /** Counts this transaction toward the goal's saved total. */
  goalId?: string;
  /** Budget scheduled item this transaction is tied to (when recurring). */
  scheduledItemKind?: ScheduledItemKind;
  scheduledItemId?: string;
}

export type AddTransactionInput = {
  desc: string;
  amount: number;
  type: TransactionType;
  category: string;
  dateISO?: string;
  icon?: string;
  fromAccountId?: string;
  toAccountId?: string;
  goalId?: string;
  scheduledItemKind?: ScheduledItemKind;
  scheduledItemId?: string;
  /** When true, update the linked scheduled item amount / due day to match this transaction. */
  updateScheduledItem?: boolean;
};

export interface BudgetCategory {
  id: string;
  name: string;
  icon: string;
  monthlyBudget: number;
  /** Transactions in this category default to this goal when none is chosen. */
  goalId?: string;
}

export type BillFrequency = "monthly" | "weekly" | "biweekly" | "quarterly";

/** Income streams only — twice per month on chosen calendar days. */
export type IncomeFrequency = BillFrequency | "semimonthly";

/** Shared schedule fields for bills, income streams, and recurring transactions. */
export interface RecurringScheduleBase {
  id: string;
  name: string;
  amount: number;
  dueDay: number;
  frequency: BillFrequency;
  category: string;
  icon: string;
}

export interface Bill extends RecurringScheduleBase {
  autopay?: boolean;
  /** Account debited when this bill posts as a transaction. */
  fromAccountId?: string;
}

/** Recurring money in (paycheck, freelance, etc.) — projects as income transactions. */
export interface IncomeStream extends Omit<RecurringScheduleBase, "frequency"> {
  frequency: IncomeFrequency;
  /** First date this stream projects (inclusive). */
  startDateISO?: string;
  /** Last date this stream projects (inclusive). */
  endDateISO?: string;
  /** When frequency is semimonthly: two pay days per month (1–31). */
  semiMonthlyDays?: [number, number];
  /** Account credited when this income posts as a transaction. */
  toAccountId?: string;
}

/** Recurring expense/transfer/custom type — not bills or core income. */
export interface RecurringTransaction extends RecurringScheduleBase {
  transactionType: TransactionType;
  fromAccountId?: string;
  toAccountId?: string;
  goalId?: string;
}

export interface Goal {
  id: string;
  name: string;
  icon: string;
  target: number;
  saved: number;
  targetDate: string;
  monthlyContribution: number;
  /** Debt or savings account this goal tracks (e.g. credit card payoff). */
  accountId?: string;
}

export type AccountKind = "asset" | "debt";

export interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  icon: string;
  kind?: AccountKind;
  /** Opening balance applies from this date (inclusive). Transactions before this date do not affect this account. */
  balanceAsOfISO?: string;
}

export interface ChatMessage {
  id: number;
  role: "system" | "user";
  text: string;
  time: string;
  tag?: string;
  /** Shown with Confirm / Cancel when set; action stored in session memory only */
  confirmationId?: string;
  confirmationTitle?: string;
  resultCard?: { title: string; lines: string[] };
  tipCards?: import("./analysis").ChatTipCard[];
  workflow?: import("./analysis").ChatWorkflow;
}

export type CalendarDayNote = {
  id: string;
  text: string;
  /** Calendar date this note belongs to (usually matches the storage key). */
  createdISO: string;
};

export interface UserProfile {
  displayName: string;
  email: string;
  currency: string;
  startingBalance: number;
  /** Starting balance applies to this date and later (ISO). */
  balanceAsOfISO?: string;
}

export type TypeIconMap = Record<TransactionType, string>;

export interface FetyStore {
  version: 1;
  onboardingCompleted: boolean;
  profile: UserProfile;
  categories: BudgetCategory[];
  transactions: Transaction[];
  bills: Bill[];
  incomeStreams?: IncomeStream[];
  recurringTransactions?: RecurringTransaction[];
  goals: Goal[];
  accounts: Account[];
  messages: ChatMessage[];
  pinnedWidgets: string[];
  /** Default emoji when adding a transaction of each type (synced from transactionTypes). */
  typeIcons: TypeIconMap;
  /** Types available when adding or editing transactions. */
  transactionTypes?: FetyTransactionType[];
  /** One-time: former fixed hero blocks are optional widgets, not auto-pinned. */
  heroBlocksOptional?: boolean;
  /** bill|sourceId|dateISO — skipped scheduled occurrence (legacy billId|dateISO migrated on load) */
  skippedBillOccurrences?: string[];
  skippedScheduledOccurrences?: string[];
  /** Widget ids locked in place (only valid while in the top dashboard row). */
  lockedDashboardWidgets?: string[];
  /** One-time: apply curated default dashboard widgets (cash-flow focused). */
  widgetsCuratedV2?: boolean;
  /** Strip removed widgets + apply latest curated defaults when still on a prior starter set. */
  widgetsCuratedV3?: boolean;
  /** Freeform notes keyed by calendar date (YYYY-MM-DD), multiple per day. */
  calendarNotes?: Record<string, CalendarDayNote[]>;
  /** Things to try — done and archived tip ids. */
  insightTipProgress?: {
    doneIds: string[];
    archivedIds: string[];
  };
  /**
   * One-time: apply needs-assessment recommended pins.
   * Once set, reassessment must not change the dashboard unless the user asks to restore recommendations.
   */
  widgetsPersonalizedV1?: boolean;
  /** One-time: re-run need-driven personalization for the PRD v3 pin model when user has not customized. */
  widgetsPersonalizedV2?: boolean;
  /** Explicit user customization of pins/order — takes precedence over assessment recommendations. */
  dashboardCustomizedByUser?: boolean;
  /** Sample-data tour — user skipped onboarding via Explore on splash. */
  exploreMode?: boolean;
  /** One-time: Deposit / Expense / Transfer types and legacy id migration. */
  transactionTypesStandardV1?: boolean;
  /** Per-widget source/preference metadata (core | recommended | user-added). */
  dashboardWidgetStates?: import("./widgets").DashboardWidgetState[];
}

export interface CategoryWithSpent extends BudgetCategory {
  spent: number;
}

export interface FinanceSummary {
  balance: number;
  /** Starting balance plus transactions through today only (excludes future scheduled items). */
  balanceThroughToday: number;
  moneyInToday: number;
  moneyOutToday: number;
  savingsTotal: number;
  weeklyBudget: number;
  weeklySpent: number;
  weeklySpendingPower: number;
  weeklyUsedPct: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  categoriesWithSpent: CategoryWithSpent[];
}

export type CalDayItemType = "income" | "expense" | "bill" | "paycheck";

export interface CalDayItem {
  id: string;
  icon: string;
  desc: string;
  amount: number;
  type: CalDayItemType;
  category: string;
  txnType: TransactionType;
}

export interface CalDay {
  date: Date;
  startBal: number;
  endBal: number;
  income: number;
  expenses: number;
  items: CalDayItem[];
}

export type CalendarMap = Map<string, CalDay>;
