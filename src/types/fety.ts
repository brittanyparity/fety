/** Transaction type id (built-in or user-defined). */
export type TransactionType = string;

export type TransactionFlow = "income" | "expense" | "bill" | "transfer";

export interface FetyTransactionType {
  id: string;
  name: string;
  icon: string;
  flow: TransactionFlow;
  /** Core types cannot be removed (bill scheduling uses "bill"). */
  locked?: boolean;
}

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
}

export interface BudgetCategory {
  id: string;
  name: string;
  icon: string;
  monthlyBudget: number;
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
}

export interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  icon: string;
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
}

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
