export type TransactionType = "income" | "expense" | "transfer" | "bill";

export interface Transaction {
  id: string;
  dateISO: string;
  desc: string;
  category: string;
  amount: number;
  type: TransactionType;
  icon: string;
}

export interface BudgetCategory {
  id: string;
  name: string;
  icon: string;
  monthlyBudget: number;
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDay: number;
  category: string;
  icon: string;
  autopay?: boolean;
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
}

export interface FetyStore {
  version: 1;
  onboardingCompleted: boolean;
  profile: UserProfile;
  categories: BudgetCategory[];
  transactions: Transaction[];
  bills: Bill[];
  goals: Goal[];
  accounts: Account[];
  messages: ChatMessage[];
  pinnedWidgets: string[];
}

export interface CategoryWithSpent extends BudgetCategory {
  spent: number;
}

export interface FinanceSummary {
  balance: number;
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
