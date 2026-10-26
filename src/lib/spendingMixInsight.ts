import type { FinancialAnalysis } from "../types/analysis";
import type { FinanceSummary, FetyStore } from "../types/fety";
import { goalSavedTotal } from "./ledger";

export type SpendingMixPeriod = "daily" | "weekly" | "monthly";

export type SpendingMixInsight = {
  balance: number;
  /** Cash in balance beyond what we treat as reserved for regular monthly bills. */
  unallocatedBalance: number;
  /** Room left in category budgets this month (aggregate). */
  budgetHeadroom: number;
  /** Surplus cash you can use without pushing any category budget into the red. */
  safeSurplusSpend: number;
  period: SpendingMixPeriod;
  periodBudget: number;
  periodSpent: number;
  /** Typical amount you can spend per day/week/month before balance or budgets go negative. */
  periodPower: number;
  periodUsedPct: number;
  daysLeftInMonth: number;
  monthlyBudget: number;
  monthlySpent: number;
};

function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function daysLeftInMonthInclusive(d: Date): number {
  return daysInMonth(d) - d.getDate() + 1;
}

const DAYS_PER_MONTH = 30.437;

export function computeSpendingMixInsight(
  analysis: FinancialAnalysis,
  summary: FinanceSummary,
  ref: Date,
  period: SpendingMixPeriod,
): SpendingMixInsight {
  const cats = summary.categoriesWithSpent;
  const monthlyBudget = cats.reduce((s, c) => s + c.monthlyBudget, 0);
  const monthlySpent = cats.reduce((s, c) => s + c.spent, 0);
  const budgetHeadroom = Math.max(0, monthlyBudget - monthlySpent);

  const balance = summary.balanceThroughToday;
  const monthlyBills = Math.max(0, analysis.regularObligations);
  const reservedForBills = Math.min(balance, monthlyBills);
  const unallocatedBalance = Math.max(0, balance - reservedForBills);
  const safeSurplusSpend = Math.min(unallocatedBalance, budgetHeadroom);

  const daysLeft = Math.max(1, daysLeftInMonthInclusive(ref));
  const balanceRunwayPerDay = balance > 0 ? balance / daysLeft : 0;
  const budgetRunwayPerDay = budgetHeadroom / daysLeft;

  let periodBudget: number;
  let periodSpent: number;
  let periodPower: number;

  if (period === "weekly") {
    periodBudget = summary.weeklyBudget;
    periodSpent = summary.weeklySpent;
    periodPower = summary.weeklySpendingPower;
  } else if (period === "monthly") {
    periodBudget = monthlyBudget;
    periodSpent = monthlySpent;
    periodPower = budgetHeadroom;
  } else {
    periodBudget = monthlyBudget > 0 ? monthlyBudget / DAYS_PER_MONTH : 0;
    periodSpent = summary.moneyOutToday;
    const dailyFromBudget = budgetRunwayPerDay;
    const dailyFromBalance = balanceRunwayPerDay;
    periodPower = Math.max(0, Math.min(dailyFromBudget, dailyFromBalance));
  }

  const periodUsedPct =
    periodBudget > 0 ? Math.min(100, Math.round((periodSpent / periodBudget) * 100)) : 0;

  return {
    balance,
    unallocatedBalance,
    budgetHeadroom,
    safeSurplusSpend,
    period,
    periodBudget,
    periodSpent,
    periodPower,
    periodUsedPct,
    daysLeftInMonth: daysLeft,
    monthlyBudget,
    monthlySpent,
  };
}

export function spendingMixPeriodLabel(period: SpendingMixPeriod): string {
  if (period === "daily") return "day";
  if (period === "weekly") return "week";
  return "month";
}

export function spendingMixPeriodAdverb(period: SpendingMixPeriod): string {
  if (period === "daily") return "daily";
  if (period === "weekly") return "weekly";
  return "monthly";
}

export type GoalAllocationRow = {
  id: string;
  name: string;
  icon: string;
  saved: number;
  shareOfGoalsPct: number;
};

/** Goals exist and at least one transaction or recurring line is linked to a goal. */
export function hasConfiguredGoalActivity(store: FetyStore): boolean {
  const goals = store.goals ?? [];
  if (goals.length === 0) return false;
  const goalIds = new Set(goals.map((g) => g.id));
  const linkedTx = store.transactions.some((t) => t.goalId && goalIds.has(t.goalId));
  const linkedRecurring = (store.recurringTransactions ?? []).some(
    (r) => r.goalId && goalIds.has(r.goalId),
  );
  return linkedTx || linkedRecurring;
}

/** Planned goal contributions scaled to the spending-power period (not total saved). */
export function goalsContributionForPeriod(
  store: FetyStore,
  period: SpendingMixPeriod,
): number {
  const monthly = (store.goals ?? []).reduce(
    (s, g) => s + Math.max(0, g.monthlyContribution ?? 0),
    0,
  );
  if (monthly <= 0) return 0;
  if (period === "monthly") return monthly;
  if (period === "weekly") return monthly / 4.33;
  return monthly / DAYS_PER_MONTH;
}

export function goalsAllocationFromStore(store: FetyStore): {
  totalSaved: number;
  goals: GoalAllocationRow[];
} {
  const rows = (store.goals ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    icon: g.icon,
    saved: goalSavedTotal(store, g),
  }));
  const totalSaved = rows.reduce((s, r) => s + r.saved, 0);
  const goals: GoalAllocationRow[] = rows.map((r) => ({
    ...r,
    shareOfGoalsPct: totalSaved > 0 ? Math.round((r.saved / totalSaved) * 100) : 0,
  }));
  return { totalSaved, goals };
}

/** Stacked balance bar: full width = balance; slices = expenses, goals, spending power, remainder. */
export function spendingPowerBalanceBar(
  insight: SpendingMixInsight,
  regularObligationsMonthly: number,
  goalsSavedTotal: number,
): {
  balance: number;
  budgetedExpenses: number;
  goalsAmount: number;
  spendingPowerAmount: number;
  remainder: number;
  budgetedPct: number;
  goalsPct: number;
  powerPct: number;
  remainderPct: number;
} {
  const balance = Math.max(0, insight.balance);
  if (balance <= 0) {
    return {
      balance: 0,
      budgetedExpenses: 0,
      goalsAmount: 0,
      spendingPowerAmount: 0,
      remainder: 0,
      budgetedPct: 0,
      goalsPct: 0,
      powerPct: 0,
      remainderPct: 0,
    };
  }

  let remaining = balance;
  const budgetedExpenses = Math.min(remaining, Math.max(0, regularObligationsMonthly));
  remaining = Math.max(0, remaining - budgetedExpenses);
  const goalsAmount = Math.min(remaining, Math.max(0, goalsSavedTotal));
  remaining = Math.max(0, remaining - goalsAmount);
  const spendingPowerAmount = Math.min(remaining, Math.max(0, insight.periodPower));
  remaining = Math.max(0, remaining - spendingPowerAmount);
  const remainder = remaining;

  return {
    balance,
    budgetedExpenses,
    goalsAmount,
    spendingPowerAmount,
    remainder,
    budgetedPct: (budgetedExpenses / balance) * 100,
    goalsPct: (goalsAmount / balance) * 100,
    powerPct: (spendingPowerAmount / balance) * 100,
    remainderPct: (remainder / balance) * 100,
  };
}
