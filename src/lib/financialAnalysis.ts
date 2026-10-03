import type {
  AnalysisTourStep,
  FinancialAnalysis,
  FinancialInsight,
  FinancialTip,
  FetyActionTarget,
} from "../types/analysis";
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

function categoryIdByName(store: FetyStore, name: string): string | undefined {
  const needle = name.trim().toLowerCase();
  return store.categories.find((c) => c.name.trim().toLowerCase() === needle)?.id;
}

function topInsights(insights: FinancialInsight[], limit = 5): FinancialInsight[] {
  return insights
    .slice()
    .sort((a, b) => a.priority - b.priority)
    .slice(0, limit);
}

function budgetAction(store: FetyStore, categoryName: string): FetyActionTarget {
  return { type: "budget", categoryId: categoryIdByName(store, categoryName), categoryName };
}

/** Deterministic insights and tips from the Fety store. Numbers come from schedules plus `computeSummary`. */
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

  const topFlex = [...flexibleByCategory.entries()].sort((a, b) => b[1] - a[1])[0];
  const largestBill = bills
    .map((b) => ({ bill: b, monthly: billMonthly(b) }))
    .sort((a, b) => b.monthly - a.monthly)[0];
  const obligationShare =
    expectedMonthlyIncome > 0 ? regularObligations / expectedMonthlyIncome : 0;

  const insights: FinancialInsight[] = [];
  const tips: FinancialTip[] = [];

  if (missing.income && missing.obligations && missing.flexible) {
    insights.push({
      id: "missing-all",
      type: "missing_data",
      priority: 1,
      title: "I need a little more information",
      explanation:
        "I need a little more information before I can tell you where your money is going. Add income or regular expenses whenever you're ready.",
      supportingData: { missing },
      dashboardTarget: "snapshot",
      actionLabel: "Open budget",
      action: { type: "budget" },
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
      dashboardTarget: "snapshot",
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
      dashboardTarget: "snapshot-income",
      actionLabel: "Review income",
      action: { type: "budget" },
    });
  }

  if (regularObligations > 0) {
    insights.push({
      id: "obligations-summary",
      type: "positive_pattern",
      priority: 3,
      title: "Your regular expenses are on the calendar",
      explanation: `You have about ${formatUsd(regularObligations)} in regular expenses each month.`,
      supportingData: { regularObligations, billCount: bills.length, obligationShare },
      dashboardTarget: "snapshot-obligations",
      actionLabel: "Review bills",
      action: { type: "bills" },
    });
  }

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
      dashboardTarget: "widget-next-paycheck",
      actionLabel: "View calendar",
      action: { type: "calendar" },
    });
  }

  if (flexibleSpending > 0 && topFlex) {
    insights.push({
      id: "flexible-spending",
      type: "spending_pattern",
      priority: 5,
      title: `${topFlex[0]} is one of your larger flexible expenses`,
      explanation: `You currently spend about ${formatUsd(topFlex[1])} a month on ${topFlex[0]}. If you'd like to create more room in your budget, this is one option — not a requirement.`,
      supportingData: { flexibleSpending, topCategory: topFlex[0], topMonthly: topFlex[1] },
      dashboardTarget: "widget-spending-breakdown",
      actionLabel: `Adjust ${topFlex[0]} budget`,
      action: budgetAction(store, topFlex[0]),
    });
  }

  const payDays = incomePayDays(streams);
  const billDays = uniqueDays(
    bills.filter((b) => b.frequency === "monthly" || b.frequency === "quarterly").map((b) => b.dueDay),
  );
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
      dashboardTarget: "widget-balance-chart",
      actionLabel: "Review monthly cash flow",
      action: { type: "calendar" },
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
      dashboardTarget: "widget-next-paycheck",
      actionLabel: "View calendar",
      action: { type: "calendar" },
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
      dashboardTarget: "snapshot",
      actionLabel: "Review recurring expenses",
      action: { type: "bills" },
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
      supportingData: { goalName: goal.name, goalId: goal.id, target: goal.target, estimatedAvailable },
      dashboardTarget: "widget-savings-goal",
      actionLabel: `Update ${goal.name} contribution`,
      action: { type: "goals", goalId: goal.id },
    });
  }

  if (topFlex && topFlex[1] >= 40) {
    const cut = Math.max(10, Math.round(topFlex[1] * 0.15));
    const yearly = cut * 12;
    const tip: FinancialTip = {
      id: "tip-flex-reduce",
      title: "Create more breathing room",
      explanation: `You're currently spending about ${formatUsd(topFlex[1])}/month on ${topFlex[0]}. Reducing that by ${formatUsd(cut)} would leave about ${formatUsd(cut)} more each month — roughly ${formatUsd(yearly)} over a year — for saving, bills, or other priorities.`,
      category: "spending",
      actionLabel: `Adjust ${topFlex[0]} budget`,
      action: budgetAction(store, topFlex[0]),
      relatedInsightId: "flexible-spending",
    };
    tips.push(tip);
    const flexInsight = insights.find((i) => i.id === "flexible-spending");
    if (flexInsight) flexInsight.tip = tip;
  }

  if (goal && estimatedAvailable > 0) {
    const tip: FinancialTip = {
      id: "tip-goal-room",
      title: "Point leftover cash at your goal",
      explanation: `You have about ${formatUsd(estimatedAvailable)} remaining after regular expenses and everyday spending. That room could potentially support ${goal.name}.`,
      category: "goals",
      actionLabel: `Update ${goal.name}`,
      action: { type: "goals", goalId: goal.id },
      relatedInsightId: "goal-opportunity",
    };
    tips.push(tip);
  }

  if (obligationShare >= 0.5 && expectedMonthlyIncome > 0) {
    tips.push({
      id: "tip-obligations-share",
      title: "Look at what has to go out first",
      explanation: `Regular expenses account for about ${Math.round(obligationShare * 100)}% of expected income. Reviewing those commitments in one place can make it easier to see where the month is tight.`,
      category: "organization",
      actionLabel: "Review recurring expenses",
      action: { type: "bills" },
      relatedInsightId: "obligations-summary",
    });
  }

  if (payDays.length > 0 && billDays.some((d) => d <= 7)) {
    tips.push({
      id: "tip-cash-flow-calendar",
      title: "Watch the first week of the month",
      explanation: `Income arrives around ${formatDayList(payDays)}, while several expenses land early in the month. The calendar is a practical way to see that timing.`,
      category: "cash_flow",
      actionLabel: "Review monthly cash flow",
      action: { type: "calendar" },
      relatedInsightId: "cash-flow-timing",
    });
  }

  const rankedInsights = topInsights(insights);
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
    insights: rankedInsights,
    tips: tips.slice(0, 4),
  };
}

export function pageForAction(action: FetyActionTarget): AnalysisTourStep["page"] {
  if (action.type === "calendar") return "calendar";
  if (action.type === "goals") return "goals";
  if (action.type === "spending" || action.type === "transactions") return "spending";
  if (action.type === "budget" || action.type === "bills") return "budget";
  return "dashboard";
}

/** Personalized first-use walkthrough: your results on real widgets, then how Fety works. */
export function buildPersonalizedTour(
  store: FetyStore,
  analysis: FinancialAnalysis,
  assessment?: {
    financialStory: { summary: string; beats: { id: string; title: string; explanation: string; widgetId?: string }[] };
    needs: { id: string; label: string }[];
    recommendedPinned: string[];
  },
): AnalysisTourStep[] {
  const steps: AnalysisTourStep[] = [];
  const firstName = store.profile.displayName.trim().split(/\s+/)[0] || "";
  const greeting = firstName ? `${firstName}, here's` : "Here's";
  const topTip = analysis.tips[0];
  const flexInsight = analysis.insights.find((i) => i.type === "spending_pattern");
  const goalInsight = analysis.insights.find((i) => i.type === "goal_opportunity");
  const goal = store.goals[0];
  const summary = computeSummary(store);
  const pinned = new Set(
    (assessment?.recommendedPinned?.length ? assessment.recommendedPinned : store.pinnedWidgets) ?? [],
  );
  const hasWidget = (id: string) => pinned.size === 0 || pinned.has(id);

  // ── Phase 1: Financial walkthrough — "Here's what I found about YOU" ──
  if ((!analysis.missing.income || !analysis.missing.obligations) && hasWidget("weekly-power")) {
    steps.push({
      id: "spending-power",
      title: "Your spending power",
      explanation: `${greeting} what I found. Based on what you told me, you currently have about ${formatUsd(summary.weeklySpendingPower)} of spending power this week after the bills on file — of a ${formatUsd(summary.weeklyBudget)} weekly budget. This widget answers: how much room do you have right now?`,
      page: "dashboard",
      target: "widget-weekly-power",
      phase: "financial",
      relatedInsightId: analysis.insights.find((i) => i.type === "cash_flow_pattern" || i.type === "positive_pattern" || i.type === "attention_needed")?.id,
    });
  } else {
    steps.push({
      id: "snapshot",
      title: "Here's what I found",
      explanation:
        "Let's start with your dashboard. As you add income and expenses, spending power and the rest of these widgets will fill in with your numbers.",
      page: "dashboard",
      target: "snapshot",
      phase: "financial",
    });
  }

  const topCategory =
    flexInsight
      ? String(flexInsight.supportingData.topCategory ?? "")
      : analysis.categoryShares[0]?.name ?? "";
  if (hasWidget("spending-breakdown") && (topCategory || analysis.categoryShares.length > 0 || !analysis.missing.flexible)) {
    const share = analysis.categoryShares.find((c) => c.name === topCategory) ?? analysis.categoryShares[0];
    steps.push({
      id: "spending-breakdown",
      title: "Where your money goes",
      explanation: share
        ? `This shows where your money is going. ${share.name} is currently one of your larger categories — about ${share.value}% of tracked spending. Understanding that distribution helps you decide what to protect, trim, or redirect toward goals.`
        : "This spending breakdown is where you'll see category shares as expenses land.",
      page: "dashboard",
      target: "widget-spending-breakdown",
      phase: "financial",
      relatedInsightId: "flexible-spending",
      action: topCategory ? { type: "spending", categoryName: topCategory } : { type: "spending" },
    });
  }

  if (goal && hasWidget("savings-goal")) {
    const pct = goal.target > 0 ? Math.round((goal.saved / goal.target) * 100) : 0;
    steps.push({
      id: "goal-progress",
      title: "Goal progress",
      explanation: `You also told me you're working toward ${goal.name}. You're at about ${pct}% of ${formatUsd(goal.target)}.${goalInsight ? " You currently have room in monthly cash flow that could support it." : ""} This is the same Goals widget on your dashboard.`,
      page: "dashboard",
      target: "widget-savings-goal",
      phase: "financial",
      relatedInsightId: "goal-opportunity",
      action: { type: "goals", goalId: goal.id },
    });
  }

  // ── Bridge: transition into product education ──
  steps.push({
    id: "bridge-product",
    title: "Now let me show you Fety",
    explanation: assessment?.financialStory.summary
      ? `${assessment.financialStory.summary} Now let me show you where you can manage all of this in Fety — Spending, Budget, Goals, Calendar, Bills, and Transactions.`
      : "Now let me show you where you can manage all of this in Fety — Spending, Budget, Goals, Calendar, Bills, and Transactions.",
    page: "dashboard",
    target: steps.some((s) => s.target === "widget-weekly-power") ? "widget-weekly-power" : "snapshot",
    phase: "bridge",
  });

  // ── Phase 2: Product tour — "Here's how Fety works" ──
  if (store.categories.some((c) => c.monthlyBudget > 0) || flexInsight) {
    const cat = topCategory;
    const catId = cat ? categoryIdByName(store, cat) : undefined;
    steps.push({
      id: "budget",
      title: "Budget",
      explanation: cat
        ? `If you want to create more room for your priorities, this is where you can organize how much you want to spend on ${cat} each month.`
        : "This is where you can decide how much you want to spend in each category.",
      page: "budget",
      target: catId ? `budget-category-${catId}` : "budget-summary",
      phase: "product",
      relatedTipId: topTip?.id,
      action: cat ? budgetAction(store, cat) : { type: "budget" },
    });
  }

  if (goal) {
    steps.push({
      id: "goals-tools",
      title: "Goals",
      explanation: `This Goals page is where you adjust targets and contributions for ${goal.name} — beyond the dashboard widget.`,
      page: "goals",
      target: `goal-${goal.id}`,
      phase: "product",
      relatedInsightId: "goal-opportunity",
      action: { type: "goals", goalId: goal.id },
    });
  }

  if (!analysis.missing.income || !analysis.missing.obligations) {
    steps.push({
      id: "calendar",
      title: "Calendar",
      explanation:
        "This gives you a time-based view of when money is coming in and going out — often easier than a spreadsheet.",
      page: "calendar",
      target: "calendar",
      phase: "product",
      relatedInsightId: "cash-flow-timing",
      action: { type: "calendar" },
    });
  }

  steps.push({
    id: "transactions",
    title: "Transactions",
    explanation: "This is where the individual money movements behind these numbers live.",
    page: "spending",
    target: "transactions",
    phase: "product",
    action: { type: "transactions" },
  });

  steps.push({
    id: "customize",
    title: "Customize your dashboard",
    explanation:
      "These are the widgets I thought would be most useful based on your financial situation. But you can add any Fety widget you want — open Customize anytime.",
    page: "dashboard",
    target: hasWidget("weekly-power") ? "widget-weekly-power" : "snapshot",
    phase: "product",
    action: { type: "dashboard" },
  });

  if (topTip) {
    steps.push({
      id: "tip",
      title: topTip.title,
      explanation: `${topTip.explanation} That's the basic Fety loop: understand what your money is doing, organize it, and make adjustments when you want to.`,
      page: topTip.action ? pageForAction(topTip.action) : "dashboard",
      target: "tip-card",
      phase: "product",
      relatedTipId: topTip.id,
      action: topTip.action,
    });
  }

  return steps;
}