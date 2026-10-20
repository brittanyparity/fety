import type { FinancialNeedId, WidgetCategory } from "../types/widgets";

export type FinancialConceptId =
  | "income"
  | "fixed_expenses"
  | "flexible_spending"
  | "recurring_expenses"
  | "cash_flow"
  | "budgeting"
  | "savings"
  | "goals"
  | "emergency_savings"
  | "debt"
  | "irregular_expenses"
  | "sinking_funds"
  | "spending_patterns";

export type FinancialConcept = {
  id: FinancialConceptId;
  name: string;
  explanation: string;
  relatedNeeds: FinancialNeedId[];
  relatedWidgets: string[];
};

export type FinancialPatternId =
  | "high_flexible_spending"
  | "high_recurring_obligations"
  | "irregular_income"
  | "negative_cash_flow"
  | "positive_cash_flow"
  | "goal_underfunding"
  | "excess_unallocated_cash_flow"
  | "upcoming_expense_pressure"
  | "category_concentration"
  | "income_timing_mismatch"
  | "missing_fundamentals";

export type DetectedPattern = {
  id: FinancialPatternId;
  label: string;
  explanation: string;
  strength: number;
};

export type RuleCondition =
  | { type: "missing"; field: "income" | "obligations" | "flexible" | "goals" }
  | { type: "ratio"; metric: "flexible_to_income" | "obligations_to_income" | "available_to_income"; op: "gt" | "lt"; value: number }
  | { type: "count"; field: "income_streams" | "bills" | "goals" | "categories"; op: "gte" | "lte"; value: number }
  | { type: "flag"; pattern: FinancialPatternId }
  | { type: "has_budgets" };

export type FinancialPlanningRule = {
  id: string;
  name: string;
  description: string;
  category: WidgetCategory | "planning";
  conditions: RuleCondition[];
  assessment: {
    need: FinancialNeedId;
    priority: number;
  };
  relevantWidgets: string[];
  insights: string[];
  tips: string[];
  actions: string[];
  pattern?: FinancialPatternId;
};

export const FINANCIAL_CONCEPTS: FinancialConcept[] = [
  {
    id: "income",
    name: "Income",
    explanation: "Money coming in from paychecks, benefits, or other streams you have on file.",
    relatedNeeds: ["income_organization", "cash_flow_visibility"],
    relatedWidgets: ["next-paycheck", "stat-money-in", "balance-chart"],
  },
  {
    id: "fixed_expenses",
    name: "Fixed expenses",
    explanation: "Regular obligations such as rent, utilities, and other bills that tend to repeat on a schedule.",
    relatedNeeds: ["expense_planning", "recurring_expense_review", "cash_flow_visibility"],
    relatedWidgets: ["biggest-bill", "budget-remaining"],
  },
  {
    id: "flexible_spending",
    name: "Flexible spending",
    explanation: "Everyday spending that can change month to month — groceries, dining, shopping, and similar categories.",
    relatedNeeds: ["spending_awareness", "budget_organization"],
    relatedWidgets: ["spending-breakdown", "monthly-spend-chart", "weekly-power"],
  },
  {
    id: "recurring_expenses",
    name: "Recurring expenses",
    explanation: "Charges that repeat on a schedule, whether bills or other recurring transactions.",
    relatedNeeds: ["recurring_expense_review", "expense_planning"],
    relatedWidgets: ["biggest-bill", "next-paycheck"],
  },
  {
    id: "cash_flow",
    name: "Cash flow",
    explanation: "The timing of money in and money out — not just totals, but when balances rise and fall.",
    relatedNeeds: ["cash_flow_visibility"],
    relatedWidgets: ["balance-chart", "weekly-power", "next-paycheck"],
  },
  {
    id: "budgeting",
    name: "Budgeting",
    explanation: "Deciding how much you want to allow in each category, then tracking against that plan.",
    relatedNeeds: ["budget_organization"],
    relatedWidgets: ["budget-remaining", "stat-remaining", "spending-breakdown"],
  },
  {
    id: "savings",
    name: "Savings",
    explanation: "Money set aside for later — emergency funds, goals, or unallocated surplus.",
    relatedNeeds: ["goal_planning"],
    relatedWidgets: ["stat-savings", "savings-goal"],
  },
  {
    id: "goals",
    name: "Goals",
    explanation: "Named targets that give surplus cash a purpose and a timeline.",
    relatedNeeds: ["goal_planning"],
    relatedWidgets: ["savings-goal", "stat-savings"],
  },
  {
    id: "emergency_savings",
    name: "Emergency savings",
    explanation: "A reserve meant to cover surprises without disrupting everyday spending or goals.",
    relatedNeeds: ["goal_planning", "cash_flow_visibility"],
    relatedWidgets: ["savings-goal", "weekly-power"],
  },
  {
    id: "debt",
    name: "Debt",
    explanation: "Balances you owe that may have a payoff goal or account attached.",
    relatedNeeds: ["goal_planning", "expense_planning"],
    relatedWidgets: ["savings-goal", "stat-balance"],
  },
  {
    id: "irregular_expenses",
    name: "Irregular expenses",
    explanation: "Larger or uneven costs that do not fit neatly into a weekly rhythm.",
    relatedNeeds: ["expense_planning", "cash_flow_visibility"],
    relatedWidgets: ["biggest-bill", "balance-chart"],
  },
  {
    id: "sinking_funds",
    name: "Sinking funds",
    explanation: "Saving gradually for known future expenses so they do not become emergencies.",
    relatedNeeds: ["goal_planning", "expense_planning"],
    relatedWidgets: ["savings-goal"],
  },
  {
    id: "spending_patterns",
    name: "Spending patterns",
    explanation: "Repeated category or timing habits that show where money tends to go.",
    relatedNeeds: ["spending_awareness", "budget_organization"],
    relatedWidgets: ["spending-breakdown", "monthly-spend-chart"],
  },
];

/**
 * Deterministic planning rules. Conditions are evaluated against analysis signals —
 * no LLM, no duplicate financial math.
 */
export const PLANNING_RULES: FinancialPlanningRule[] = [
  {
    id: "need-getting-started",
    name: "Getting started",
    description: "When fundamentals are missing, prioritize orientation over optimization.",
    category: "planning",
    conditions: [{ type: "missing", field: "income" }, { type: "missing", field: "obligations" }],
    assessment: { need: "getting_started", priority: 1 },
    relevantWidgets: ["stat-balance", "weekly-power", "balance-chart"],
    insights: ["missing-all"],
    tips: ["Add income and regular expenses so Fety can show what matters first."],
    actions: ["budget", "transactions"],
    pattern: "missing_fundamentals",
  },
  {
    id: "need-spending-awareness",
    name: "Spending awareness",
    description: "Flexible spending is material relative to income, or category concentration is high.",
    category: "spending",
    conditions: [{ type: "ratio", metric: "flexible_to_income", op: "gt", value: 0.2 }],
    assessment: { need: "spending_awareness", priority: 2 },
    relevantWidgets: ["spending-breakdown", "monthly-spend-chart", "weekly-power"],
    insights: ["flexible-spending"],
    tips: ["Review your largest flexible categories and decide what still fits your plan."],
    actions: ["spending", "budget"],
    pattern: "high_flexible_spending",
  },
  {
    id: "need-category-concentration",
    name: "Category concentration",
    description: "One category dominates flexible spending.",
    category: "spending",
    conditions: [{ type: "flag", pattern: "category_concentration" }],
    assessment: { need: "spending_awareness", priority: 3 },
    relevantWidgets: ["spending-breakdown", "budget-remaining"],
    insights: ["flexible-spending"],
    tips: ["A single category is carrying a large share of everyday spending — that is a useful place to look first."],
    actions: ["budget", "spending"],
    pattern: "category_concentration",
  },
  {
    id: "need-budget-organization",
    name: "Budget organization",
    description: "Budgets exist and spending awareness suggests organizing limits.",
    category: "budgeting",
    conditions: [{ type: "has_budgets" }],
    assessment: { need: "budget_organization", priority: 4 },
    relevantWidgets: ["budget-remaining", "spending-breakdown", "stat-remaining"],
    insights: [],
    tips: ["Use Budget Health to see which categories are closest to their limits."],
    actions: ["budget"],
  },
  {
    id: "need-cash-flow-visibility",
    name: "Cash flow visibility",
    description: "Income and obligations exist — timing and available room matter.",
    category: "cash_flow",
    conditions: [{ type: "count", field: "income_streams", op: "gte", value: 1 }],
    assessment: { need: "cash_flow_visibility", priority: 2 },
    relevantWidgets: ["weekly-power", "balance-chart", "next-paycheck"],
    insights: ["cash-flow-timing"],
    tips: ["Watch spending power and the balance chart between paydays."],
    actions: ["calendar", "dashboard"],
  },
  {
    id: "need-negative-cash-flow",
    name: "Negative cash flow pressure",
    description: "Obligations and flexible spending exceed expected income.",
    category: "cash_flow",
    conditions: [{ type: "ratio", metric: "available_to_income", op: "lt", value: 0 }],
    assessment: { need: "cash_flow_visibility", priority: 1 },
    relevantWidgets: ["weekly-power", "biggest-bill", "spending-breakdown", "balance-chart"],
    insights: ["attention_needed"],
    tips: ["Start with obligations and the largest flexible categories — those drive the shortfall."],
    actions: ["budget", "bills", "spending"],
    pattern: "negative_cash_flow",
  },
  {
    id: "need-positive-cash-flow",
    name: "Unallocated surplus",
    description: "Available cash flow after obligations and flexible spending.",
    category: "goals",
    conditions: [{ type: "ratio", metric: "available_to_income", op: "gt", value: 0.1 }],
    assessment: { need: "goal_planning", priority: 5 },
    relevantWidgets: ["savings-goal", "weekly-power", "stat-savings"],
    insights: ["goal-opportunity"],
    tips: ["You may have room to direct surplus toward a goal."],
    actions: ["goals"],
    pattern: "excess_unallocated_cash_flow",
  },
  {
    id: "need-goal-planning",
    name: "Goal planning",
    description: "Goals exist and should stay visible on the dashboard.",
    category: "goals",
    conditions: [{ type: "count", field: "goals", op: "gte", value: 1 }],
    assessment: { need: "goal_planning", priority: 3 },
    relevantWidgets: ["savings-goal", "stat-savings"],
    insights: ["goal-opportunity"],
    tips: ["Keep goal progress visible so contributions stay intentional."],
    actions: ["goals"],
  },
  {
    id: "need-expense-planning",
    name: "Expense planning",
    description: "Bills create upcoming pressure that should stay on the dashboard.",
    category: "expenses",
    conditions: [{ type: "count", field: "bills", op: "gte", value: 1 }],
    assessment: { need: "expense_planning", priority: 3 },
    relevantWidgets: ["biggest-bill", "next-paycheck", "balance-chart"],
    insights: ["upcoming_obligation"],
    tips: ["Review the next bills so spending power stays realistic."],
    actions: ["bills", "calendar"],
    pattern: "upcoming_expense_pressure",
  },
  {
    id: "need-high-obligations",
    name: "High recurring obligations",
    description: "Regular bills take a large share of income.",
    category: "expenses",
    conditions: [{ type: "ratio", metric: "obligations_to_income", op: "gt", value: 0.5 }],
    assessment: { need: "recurring_expense_review", priority: 2 },
    relevantWidgets: ["biggest-bill", "budget-remaining", "weekly-power"],
    insights: ["largest_expense"],
    tips: ["Recurring obligations are a large share of income — reviewing them can free room elsewhere."],
    actions: ["bills", "budget"],
    pattern: "high_recurring_obligations",
  },
  {
    id: "need-income-organization",
    name: "Income organization",
    description: "Multiple income streams benefit from clear paycheck visibility.",
    category: "income",
    conditions: [{ type: "count", field: "income_streams", op: "gte", value: 2 }],
    assessment: { need: "income_organization", priority: 4 },
    relevantWidgets: ["next-paycheck", "balance-chart", "stat-money-in"],
    insights: ["income_summary"],
    tips: ["With more than one income stream, next-paycheck timing helps you plan between deposits."],
    actions: ["calendar", "transactions"],
    pattern: "irregular_income",
  },
];

export const NEED_LABELS: Record<FinancialNeedId, string> = {
  spending_awareness: "Spending awareness",
  budget_organization: "Budget organization",
  cash_flow_visibility: "Cash-flow visibility",
  goal_planning: "Goal planning",
  expense_planning: "Expense planning",
  income_organization: "Income organization",
  recurring_expense_review: "Recurring expense review",
  getting_started: "Getting started",
};
