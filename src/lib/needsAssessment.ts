import type { FinancialAnalysis } from "../types/analysis";
import type { FetyStore } from "../types/fety";
import type {
  FinancialAssessment,
  FinancialNeed,
  FinancialNeedId,
  FinancialStory,
  FinancialStoryBeat,
  WidgetRecommendation,
} from "../types/widgets";
import { analyzeStore } from "./financialAnalysis";
import {
  NEED_LABELS,
  PLANNING_RULES,
  type DetectedPattern,
  type FinancialPatternId,
  type FinancialPlanningRule,
  type RuleCondition,
} from "./financialKnowledge";
import { DEFAULT_PINNED } from "./fetyStorage";
import { buildDashboardWidgetStates } from "./dashboardPreferences";
import { getWidgetDefinition } from "./widgetCatalog";

type AssessmentSignals = {
  income: number;
  obligations: number;
  flexible: number;
  available: number;
  incomeStreams: number;
  bills: number;
  goals: number;
  categories: number;
  hasBudgets: boolean;
  missing: FinancialAnalysis["missing"];
  topCategoryShare: number;
  patterns: Set<FinancialPatternId>;
};

function buildSignals(store: FetyStore, analysis: FinancialAnalysis): AssessmentSignals {
  const income = analysis.expectedMonthlyIncome;
  const obligations = analysis.regularObligations;
  const flexible = analysis.flexibleSpending;
  const available = analysis.estimatedAvailable;
  const topCategoryShare = analysis.categoryShares[0]?.value ?? 0;

  const patterns = new Set<FinancialPatternId>();
  if (analysis.missing.income && analysis.missing.obligations) patterns.add("missing_fundamentals");
  if (income > 0 && flexible / income > 0.2) patterns.add("high_flexible_spending");
  if (income > 0 && obligations / income > 0.5) patterns.add("high_recurring_obligations");
  if (available < 0) patterns.add("negative_cash_flow");
  if (income > 0 && available / income > 0.1) patterns.add("positive_cash_flow");
  if (income > 0 && available / income > 0.1) patterns.add("excess_unallocated_cash_flow");
  if ((store.bills?.length ?? 0) > 0) patterns.add("upcoming_expense_pressure");
  if (topCategoryShare >= 40) patterns.add("category_concentration");
  if ((store.incomeStreams?.length ?? 0) >= 2) patterns.add("irregular_income");
  if ((store.goals?.length ?? 0) > 0 && available > 0 && store.goals.some((g) => g.monthlyContribution > available)) {
    patterns.add("goal_underfunding");
  }

  return {
    income,
    obligations,
    flexible,
    available,
    incomeStreams: store.incomeStreams?.length ?? 0,
    bills: store.bills?.length ?? 0,
    goals: store.goals?.length ?? 0,
    categories: store.categories?.length ?? 0,
    hasBudgets: (store.categories ?? []).some((c) => c.monthlyBudget > 0),
    missing: analysis.missing,
    topCategoryShare,
    patterns,
  };
}

function metricValue(signals: AssessmentSignals, metric: "flexible_to_income" | "obligations_to_income" | "available_to_income"): number {
  if (signals.income <= 0) return metric === "available_to_income" ? (signals.available < 0 ? -1 : 0) : 0;
  if (metric === "flexible_to_income") return signals.flexible / signals.income;
  if (metric === "obligations_to_income") return signals.obligations / signals.income;
  return signals.available / signals.income;
}

function conditionMet(condition: RuleCondition, signals: AssessmentSignals): boolean {
  switch (condition.type) {
    case "missing":
      return signals.missing[condition.field];
    case "ratio": {
      const value = metricValue(signals, condition.metric);
      return condition.op === "gt" ? value > condition.value : value < condition.value;
    }
    case "count": {
      const count =
        condition.field === "income_streams"
          ? signals.incomeStreams
          : condition.field === "bills"
            ? signals.bills
            : condition.field === "goals"
              ? signals.goals
              : signals.categories;
      return condition.op === "gte" ? count >= condition.value : count <= condition.value;
    }
    case "flag":
      return signals.patterns.has(condition.pattern);
    case "has_budgets":
      return signals.hasBudgets;
    default:
      return false;
  }
}

function ruleMatches(rule: FinancialPlanningRule, signals: AssessmentSignals): boolean {
  // "getting started" requires both missing conditions; other rules require all conditions.
  if (rule.id === "need-getting-started") {
    return rule.conditions.every((c) => conditionMet(c, signals));
  }
  // For spending awareness with only flexible ratio, also fire when flexible exists without income ratio
  if (rule.conditions.length === 0) return false;
  return rule.conditions.every((c) => conditionMet(c, signals));
}

function detectedPatterns(signals: AssessmentSignals): DetectedPattern[] {
  const labels: Record<FinancialPatternId, string> = {
    high_flexible_spending: "High flexible spending",
    high_recurring_obligations: "High recurring obligations",
    irregular_income: "Multiple income streams",
    negative_cash_flow: "Negative cash flow",
    positive_cash_flow: "Positive cash flow",
    goal_underfunding: "Goal underfunding",
    excess_unallocated_cash_flow: "Excess unallocated cash flow",
    upcoming_expense_pressure: "Upcoming expense pressure",
    category_concentration: "Category concentration",
    income_timing_mismatch: "Income timing mismatch",
    missing_fundamentals: "Missing fundamentals",
  };
  return [...signals.patterns].map((id) => ({
    id,
    label: labels[id],
    explanation: labels[id],
    strength: 1,
  }));
}

function mergeNeeds(matched: FinancialPlanningRule[]): FinancialNeed[] {
  const byId = new Map<FinancialNeedId, FinancialNeed>();
  for (const rule of matched) {
    const id = rule.assessment.need;
    const existing = byId.get(id);
    if (!existing || rule.assessment.priority < existing.priority) {
      byId.set(id, {
        id,
        label: NEED_LABELS[id],
        priority: rule.assessment.priority,
        explanation: rule.description,
        relatedWidgets: [...rule.relevantWidgets],
        relatedTools: [...rule.actions],
      });
    } else {
      existing.relatedWidgets = [...new Set([...existing.relatedWidgets, ...rule.relevantWidgets])];
      existing.relatedTools = [...new Set([...existing.relatedTools, ...rule.actions])];
    }
  }
  return [...byId.values()].sort((a, b) => a.priority - b.priority);
}

function buildWidgetRecommendations(
  matched: FinancialPlanningRule[],
  signals: AssessmentSignals,
): WidgetRecommendation[] {
  const scores = new Map<string, { priority: number; reasons: string[] }>();

  const bump = (widgetId: string, priority: number, reason: string) => {
    if (!getWidgetDefinition(widgetId)) return;
    // Never recommend goal widgets without goals, or bill widgets without bills.
    if ((widgetId === "savings-goal" || widgetId === "stat-savings") && signals.goals === 0) return;
    if (widgetId === "biggest-bill" && signals.bills === 0) return;
    const cur = scores.get(widgetId);
    if (!cur) {
      scores.set(widgetId, { priority, reasons: [reason] });
      return;
    }
    cur.priority = Math.min(cur.priority, priority);
    if (!cur.reasons.includes(reason)) cur.reasons.push(reason);
  };

  for (const rule of matched) {
    const reason = NEED_LABELS[rule.assessment.need];
    for (const widgetId of rule.relevantWidgets) {
      bump(widgetId, rule.assessment.priority, reason);
    }
  }

  // Story-critical widgets when the data supports them.
  if (!signals.missing.income || !signals.missing.obligations) {
    bump("weekly-power", 1, NEED_LABELS.cash_flow_visibility);
  }
  if (!signals.missing.flexible || signals.topCategoryShare > 0) {
    bump("spending-breakdown", 2, NEED_LABELS.spending_awareness);
  }
  if (signals.goals > 0) bump("savings-goal", 2, NEED_LABELS.goal_planning);
  if (signals.bills > 0) bump("biggest-bill", 3, NEED_LABELS.expense_planning);
  if (signals.hasBudgets) bump("budget-remaining", 4, NEED_LABELS.budget_organization);
  if (signals.incomeStreams >= 1) bump("next-paycheck", 4, NEED_LABELS.income_organization);
  if (!signals.missing.income || signals.bills > 0) {
    bump("balance-chart", 5, NEED_LABELS.cash_flow_visibility);
  }

  // Getting started: keep a tiny orientation set, not the full curated default.
  if (signals.patterns.has("missing_fundamentals")) {
    bump("stat-balance", 1, NEED_LABELS.getting_started);
    bump("weekly-power", 2, NEED_LABELS.getting_started);
    bump("balance-chart", 3, NEED_LABELS.getting_started);
  }

  return [...scores.entries()]
    .map(([widgetId, v]) => ({
      widgetId,
      priority: v.priority,
      reasons: v.reasons,
      recommended: true,
    }))
    .sort((a, b) => a.priority - b.priority || a.widgetId.localeCompare(b.widgetId));
}

/**
 * Need-driven pin list — divergent by profile, not a clone of DEFAULT_PINNED.
 * Story widgets lead; Customize still exposes the full library.
 */
export function buildRecommendedPinned(
  recommendations: WidgetRecommendation[],
  story: { beats: { widgetId?: string }[] },
  signals: AssessmentSignals,
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  const canInclude = (id: string) => {
    if (!getWidgetDefinition(id)) return false;
    if ((id === "savings-goal" || id === "stat-savings") && signals.goals === 0) return false;
    if (id === "biggest-bill" && signals.bills === 0) return false;
    return true;
  };

  const add = (id: string | undefined) => {
    if (!id || seen.has(id) || !canInclude(id)) return;
    seen.add(id);
    result.push(id);
  };

  // 1. Financial story widgets first — physical representation of the narrative.
  for (const beat of story.beats) {
    add(beat.widgetId);
    if (result.length >= 5) break;
  }

  // 2. High-priority recommendations (priority 1–3).
  for (const r of recommendations.filter((x) => x.recommended && x.priority <= 3)) {
    add(r.widgetId);
    if (result.length >= 6) break;
  }

  // 3. One medium-priority supplement if room.
  for (const r of recommendations.filter((x) => x.recommended && x.priority > 3 && x.priority <= 5)) {
    add(r.widgetId);
    if (result.length >= 7) break;
  }

  // 4. Minimal orientation fallback.
  if (result.length === 0) {
    add("weekly-power");
    add("stat-balance");
    add("balance-chart");
  }

  return result.slice(0, 7);
}

function buildFinancialStory(
  analysis: FinancialAnalysis,
  needs: FinancialNeed[],
  patterns: DetectedPattern[],
): FinancialStory {
  const beats: FinancialStoryBeat[] = [];
  let order = 1;
  const hasPosition = !analysis.missing.income || !analysis.missing.obligations;

  if (hasPosition) {
    beats.push({
      id: "position",
      order: order++,
      title: "Overall position",
      explanation:
        `Based on what you've entered, about ${formatRough(analysis.expectedMonthlyIncome)} comes in each month with about ${formatRough(analysis.regularObligations)} in regular expenses. That leaves about ${formatRough(Math.max(0, analysis.expectedMonthlyIncome - analysis.regularObligations))} before everyday spending and other priorities.`,
      widgetId: "weekly-power",
      needId: needs.find((n) => n.id === "cash_flow_visibility")?.id ?? needs[0]?.id,
    });
  } else {
    beats.push({
      id: "position",
      order: order++,
      title: "Overall position",
      explanation: "Once income and regular expenses are on file, Fety can show what matters first.",
      widgetId: "weekly-power",
      needId: "getting_started",
    });
  }

  if (!analysis.missing.flexible || analysis.categoryShares.length > 0) {
    const top = analysis.categoryShares[0];
    beats.push({
      id: "flexible",
      order: order++,
      title: "Flexible spending",
      explanation: top
        ? `${top.name} is one of the larger everyday categories (${top.value}% of tracked spending).`
        : "Flexible spending is where everyday choices show up.",
      widgetId: "spending-breakdown",
      needId: "spending_awareness",
    });
  }

  if (!analysis.missing.goals) {
    beats.push({
      id: "goals",
      order: order++,
      title: "Goals",
      explanation: "Goals give surplus cash a purpose — progress stays visible on the dashboard.",
      widgetId: "savings-goal",
      needId: "goal_planning",
    });
  }

  if (!analysis.missing.obligations) {
    beats.push({
      id: "obligations",
      order: order++,
      title: "Regular obligations",
      explanation: `Regular bills come to about ${formatRough(analysis.regularObligations)} a month.`,
      widgetId: "biggest-bill",
      needId: "expense_planning",
    });
  }

  const pattern = patterns.find((p) => p.id !== "missing_fundamentals") ?? patterns[0];
  if (pattern) {
    beats.push({
      id: "pattern",
      order: order++,
      title: pattern.label,
      explanation: pattern.explanation,
      needId: needs[0]?.id,
    });
  }

  const primaryNeed = needs[0];
  if (primaryNeed) {
    beats.push({
      id: "opportunity",
      order: order++,
      title: primaryNeed.label,
      explanation: primaryNeed.explanation,
      widgetId: primaryNeed.relatedWidgets.find((id) => getWidgetDefinition(id)) ?? primaryNeed.relatedWidgets[0],
      needId: primaryNeed.id,
    });
    beats.push({
      id: "next-action",
      order: order++,
      title: "Recommended next step",
      explanation: `Start with ${primaryNeed.relatedTools[0] ?? "your dashboard"} — Fety curated widgets for ${primaryNeed.label.toLowerCase()}, and you can change that anytime in Customize.`,
      widgetId: primaryNeed.relatedWidgets[0],
      needId: primaryNeed.id,
    });
  }

  const summary = primaryNeed
    ? `Based on what you've told me, ${primaryNeed.label.toLowerCase()} may be most useful for you right now.`
    : "Fety is ready to show your financial picture as you add information.";

  return { summary, beats };
}

function formatRough(n: number): string {
  const abs = Math.abs(n);
  const formatted = abs >= 100 ? `$${Math.round(abs).toLocaleString("en-US")}` : `$${abs.toFixed(0)}`;
  return n < 0 ? `-${formatted}` : formatted;
}

/**
 * Deterministic financial needs assessment.
 * Numbers come from `analyzeStore` / the financial engine — this layer only prioritizes meaning.
 */
export function assessFinancialNeeds(store: FetyStore, ref = new Date()): FinancialAssessment {
  const analysis = analyzeStore(store, ref);
  const signals = buildSignals(store, analysis);
  const matched = PLANNING_RULES.filter((rule) => ruleMatches(rule, signals));
  // If almost nothing matches but we have some data, still surface cash-flow visibility.
  if (matched.length === 0 && (!analysis.missing.income || !analysis.missing.obligations)) {
    matched.push(PLANNING_RULES.find((r) => r.id === "need-cash-flow-visibility")!);
  }
  if (matched.length === 0) {
    matched.push(PLANNING_RULES.find((r) => r.id === "need-getting-started")!);
  }

  const needs = mergeNeeds(matched);
  const prioritizedWidgets = buildWidgetRecommendations(matched, signals);
  const patterns = detectedPatterns(signals);
  const financialStory = buildFinancialStory(analysis, needs, patterns);
  const recommendedPinned = buildRecommendedPinned(prioritizedWidgets, financialStory, signals);

  return {
    needs,
    prioritizedWidgets,
    insights: analysis.insights,
    tips: analysis.tips,
    financialStory,
    recommendedPinned,
  };
}

/** Reasons a widget was recommended, for Customize educational cards. */
export function recommendationForWidget(
  assessment: FinancialAssessment,
  widgetId: string,
): WidgetRecommendation | undefined {
  return assessment.prioritizedWidgets.find((r) => r.widgetId === widgetId);
}

export function isWidgetRecommended(assessment: FinancialAssessment, widgetId: string): boolean {
  return assessment.prioritizedWidgets.some((r) => r.widgetId === widgetId && r.recommended);
}

/**
 * Apply assessment pins only when the user has not customized and personalization has not run.
 * Never removes or reorders an already-customized dashboard.
 */
export function shouldApplyPersonalizedPins(store: FetyStore): boolean {
  if (store.dashboardCustomizedByUser) return false;
  if (store.widgetsPersonalizedV1) return false;
  return true;
}

export function withPersonalizedPins(store: FetyStore, assessment?: FinancialAssessment): FetyStore {
  if (!shouldApplyPersonalizedPins(store)) return store;
  const result = assessment ?? assessFinancialNeeds(store);
  const pinned = result.recommendedPinned.length > 0 ? result.recommendedPinned : [...DEFAULT_PINNED];
  return {
    ...store,
    pinnedWidgets: pinned,
    dashboardWidgetStates: buildDashboardWidgetStates(pinned, result, store.dashboardWidgetStates),
    widgetsPersonalizedV1: true,
  };
}
