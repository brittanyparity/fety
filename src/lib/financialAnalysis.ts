import type { FinancialAnalysis, FinancialInsight } from "../types/analysis";
import type { Bill, FetyStore, IncomeStream, RecurringTransaction } from "../types/fety";
import { computeSummary } from "./fetyCalculations";
import { formatUsd, monthlyFromFrequency } from "./scheduleAmounts";

function streamMonthly(stream: IncomeStream): number {
  return monthlyFromFrequency(stream.amount, stream.frequency);
}

function billMonthly(bill: Bill): number {
  return monthlyFromFrequency(bill.amount, bill.frequency);
}

function recurMonthly(item: RecurringTransaction): number {
  return monthlyFromFrequency(item.amount, item.frequency);
}

function ordinal(day: number): string {
  const n = Math.max(1, Math.min(31, Math.round(day)));
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}

function uniqueDays(days: number[]): number[] {
  return [...new Set(days.filter((d) => d >= 1 && d <= 31))].sort((a, b) => a - b);
}

function incomePayDays(streams: IncomeStream[]): number[] {
  const days: number[] = [];
  for (const s of streams) {
    if (s.frequency === "semimonthly") {
      const pair = s.semiMonthlyDays ?? [s.dueDay, 15];
      days.push(pair[0], pair[1]);
    } else if (s.frequency !== "weekly" && s.frequency !== "biweekly") {
      days.push(s.dueDay);
    }
  }
  return uniqueDays(days);
}

function formatDayList(days: number[]): string {
  if (days.length === 0) return "";
  if (days.length === 1) return `the ${ordinal(days[0])}`;
  if (days.length === 2) return `the ${ordinal(days[0])} and ${ordinal(days[1])}`;
  const head = days.slice(0, -1).map(ordinal).join(", ");
  return `the ${head}, and ${ordinal(days[days.length - 1])}`;
}

function topInsights(insights: FinancialInsight[], limit = 5): FinancialInsight[] {
  return insights
    .slice()
    .sort((a, b) => a.priority - b.priority)
    .slice(0, limit);
}

/** Deterministic insights from the Fety store. Values come from scheduled items plus `computeSummary`. */
export function analyzeStore(store: FetyStore, ref = new Date()): FinancialAnalysis {
  const summary = computeSummary(store, ref);
  const streams = store.incomeStreams ?? [];
  const bills = store.bills ?? [];
  const recurring = store.recurringTransactions ?? [];
  const goals = store.goals ?? [];

  const expectedMonthlyIncome =
    streams.length > 0 ? streams.reduce((s, x) => s + streamMonthly(x), 0) : summary.monthlyIncome;
  const regularObligations = bills.reduce((s, x) => s + billMonthly(x), 0);
  const flexibleSpending = recurring.reduce((s, x) => s + recurMonthly(x), 0);
  const estimatedAvailable = expectedMonthlyIncome - regularObligations - flexibleSpending;

  const missing = {
    income: streams.length === 0 && summary.monthlyIncome <= 0,
    obligations: bills.length === 0,
    flexible: recurring.length === 0,
    goals: goals.length === 0,
  };

  const qualifier = "Based on the information you've entered";

  const obligationByCategory = new Map<string, number>();
  for (const bill of bills) {
    const key = bill.category.trim() || bill.name.trim() || "Other";
    obligationByCategory.set(key, (obligationByCategory.get(key) ?? 0) + billMonthly(bill));
  }
  const flexibleByCategory = new Map<string, number>();
  for (const item of recurring) {
    const key = item.category.trim() || item.name.trim() || "Other";
    flexibleByCategory.set(key, (flexibleByCategory.get(key) ?? 0) + recurMonthly(item));
  }

  const spendTotal = regularObligations + flexibleSpending;
  const merged = new Map<string, number>();
  for (const [name, monthly] of obligationByCategory) merged.set(name, (merged.get(name) ?? 0) + monthly);
  for (const [name, monthly] of flexibleByCategory) merged.set(name, (merged.get(name) ?? 0) + monthly);
  const categoryShares = [...merged.entries()]
    .filter(([, monthly]) => monthly > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, monthly]) => ({
      name,
      monthly,
      value: spendTotal > 0 ? Math.round((monthly / spendTotal) * 100) : 0,
    }));

  const insights: FinancialInsight[] = [];

  if (missing.income && missing.obligations && missing.flexible) {
    insights.push({
      id: "missing-all",
      type: "missing_data",
      priority: 1,
      title: "I need a little more information",
      explanation:
        "I need a little more information before I can tell you where your money is going. Add income or regular expenses whenever you're ready.",
      supportingData: { missing },
      actionLabel: "Add income",
      actionTarget: "budget",
    });
  } else if (missing.flexible && !missing.income && !missing.obligations) {
    insights.push({
      id: "missing-flexible",
      type: "missing_data",
      priority: 8,
      title: "Everyday spending can wait",
      explanation:
        "I have enough information to show your regular cash flow. You can add everyday spending later to make this analysis more complete.",
      supportingData: { missing },
    });
  }

  if (expectedMonthlyIncome > 0) {
    insights.push({
      id: "income-summary",
      type: "income_summary",
      priority: 2,
      title:
        streams.length > 1
          ? `Money comes in from ${streams.length} places`
          : "Here's how money comes in",
      explanation: `${qualifier}, you bring in about ${formatUsd(expectedMonthlyIncome)} a month.`,
      supportingData: { expectedMonthlyIncome, incomeStreamCount: streams.length },
    });
  }

  if (regularObligations > 0) {
    insights.push({
      id: "obligations-summary",
      type: "positive_pattern",
      priority: 3,
      title: "Your regular expenses are on the calendar",
      explanation: `You have about ${formatUsd(regularObligations)} in regular expenses each month.`,
      supportingData: { regularObligations, billCount: bills.length },
      actionLabel: "View calendar",
      actionTarget: "calendar",
    });
  }

  const largestBill = bills
    .map((b) => ({ bill: b, monthly: billMonthly(b) }))
    .sort((a, b) => b.monthly - a.monthly)[0];
  if (largestBill && largestBill.monthly > 0) {
    const share =
      regularObligations > 0 ? Math.round((largestBill.monthly / regularObligations) * 100) : 0;
    const label = largestBill.bill.category || largestBill.bill.name;
    insights.push({
      id: "largest-expense",
      type: "largest_expense",
      priority: 4,
      title: `${label} is your largest regular expense`,
      explanation:
        share > 0
          ? `${label} is about ${share}% of your recurring spending.`
          : `${label} is the biggest regular payment you entered.`,
      supportingData: { name: largestBill.bill.name, category: label, monthly: largestBill.monthly, share },
      actionLabel: "View spending",
      actionTarget: "spending",
    });
  }

  if (flexibleSpending > 0) {
    const topFlex = [...flexibleByCategory.entries()].sort((a, b) => b[1] - a[1])[0];
    const names = topFlex
      ? topFlex[0]
      : recurring
          .slice(0, 2)
          .map((r) => r.name)
          .join(" and ");
    insights.push({
      id: "flexible-spending",
      type: "spending_pattern",
      priority: 5,
      title: `${names} add up`,
      explanation: `You spend about ${formatUsd(flexibleSpending)} a month on everyday purchases. Dining, coffee, and similar habits are one area where you may have room to adjust spending.`,
      supportingData: { flexibleSpending, topCategory: topFlex?.[0], topMonthly: topFlex?.[1] },
      actionLabel: "Explore spending",
      actionTarget: "spending",
    });
  }

  const payDays = incomePayDays(streams);
  const billDays = uniqueDays(bills.filter((b) => b.frequency === "monthly" || b.frequency === "quarterly").map((b) => b.dueDay));
  if (payDays.length > 0) {
    const earlyBills = billDays.filter((d) => d <= 7).length;
    insights.push({
      id: "cash-flow-timing",
      type: "cash_flow_pattern",
      priority: 6,
      title: `Your income arrives around ${formatDayList(payDays)}`,
      explanation:
        earlyBills > 0
          ? `Your cash flow may be easier to understand using the calendar. Most of your large bills arrive during the first week.`
          : `Your cash flow may be easier to understand using the calendar — it shows when money comes in and when expenses happen.`,
      supportingData: { payDays, billDays },
      actionLabel: "View calendar",
      actionTarget: "calendar",
    });
  }

  const nextBill = bills.slice().sort((a, b) => a.dueDay - b.dueDay)[0];
  if (nextBill) {
    insights.push({
      id: "upcoming-obligation",
      type: "upcoming_obligation",
      priority: 9,
      title: `${nextBill.name} is on your regular schedule`,
      explanation: `${nextBill.name} is due around the ${ordinal(nextBill.dueDay)} each cycle.`,
      supportingData: { name: nextBill.name, dueDay: nextBill.dueDay },
      actionLabel: "View calendar",
      actionTarget: "calendar",
    });
  }

  if (regularObligations > expectedMonthlyIncome && expectedMonthlyIncome > 0) {
    insights.push({
      id: "obligations-over-income",
      type: "attention_needed",
      priority: 1,
      title: "Regular expenses are higher than income right now",
      explanation: `${qualifier}, regular expenses are about ${formatUsd(regularObligations)} versus about ${formatUsd(expectedMonthlyIncome)} coming in. This is a place to look first — not a judgment, just the picture so far.`,
      supportingData: { regularObligations, expectedMonthlyIncome },
      actionLabel: "Review budget",
      actionTarget: "budget",
    });
  }

  const goal = goals[0];
  if (goal && estimatedAvailable > 0) {
    insights.push({
      id: "goal-opportunity",
      type: "goal_opportunity",
      priority: 7,
      title: `You could put leftover cash toward ${goal.name}`,
      explanation: `You could potentially direct part of your remaining cash toward your ${formatUsd(goal.target)} ${goal.name.toLowerCase()} goal.`,
      supportingData: { goalName: goal.name, target: goal.target, estimatedAvailable },
      actionLabel: "See goals",
      actionTarget: "goals",
    });
  }

  return {
    expectedMonthlyIncome,
    regularObligations,
    flexibleSpending,
    estimatedAvailable,
    currentBalance: summary.balanceThroughToday,
    incomeStreamCount: streams.length,
    qualifier,
    missing,
    categoryShares,
    insights: topInsights(insights),
  };
}