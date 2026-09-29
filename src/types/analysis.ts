export type InsightType =
  | "income_summary"
  | "largest_expense"
  | "spending_pattern"
  | "cash_flow_pattern"
  | "upcoming_obligation"
  | "goal_opportunity"
  | "positive_pattern"
  | "attention_needed"
  | "missing_data";

export type InsightActionTarget = "spending" | "calendar" | "goals" | "budget";

export type FinancialInsight = {
  id: string;
  type: InsightType;
  priority: number;
  title: string;
  explanation: string;
  supportingData: Record<string, unknown>;
  actionLabel?: string;
  actionTarget?: InsightActionTarget;
};

export type CategoryShare = {
  name: string;
  monthly: number;
  value: number;
};

export type FinancialAnalysis = {
  expectedMonthlyIncome: number;
  regularObligations: number;
  flexibleSpending: number;
  estimatedAvailable: number;
  currentBalance: number;
  incomeStreamCount: number;
  qualifier: string;
  missing: {
    income: boolean;
    obligations: boolean;
    flexible: boolean;
    goals: boolean;
  };
  categoryShares: CategoryShare[];
  insights: FinancialInsight[];
};