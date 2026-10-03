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

export type TipCategory =
  | "spending"
  | "budgeting"
  | "cash_flow"
  | "income"
  | "goals"
  | "organization";

export type FetyActionTarget =
  | { type: "budget"; categoryId?: string; categoryName?: string }
  | { type: "spending"; categoryName?: string }
  | { type: "goals"; goalId?: string }
  | { type: "calendar" }
  | { type: "transactions" }
  | { type: "bills"; billId?: string }
  | { type: "dashboard" };

export type TourPage = "dashboard" | "budget" | "spending" | "goals" | "calendar";

export type FinancialTip = {
  id: string;
  title: string;
  explanation: string;
  category: TipCategory;
  actionLabel?: string;
  action?: FetyActionTarget;
  relatedInsightId?: string;
};

export type FinancialInsight = {
  id: string;
  type: InsightType;
  priority: number;
  title: string;
  explanation: string;
  supportingData: Record<string, unknown>;
  dashboardTarget?: string;
  actionLabel?: string;
  action?: FetyActionTarget;
  tip?: FinancialTip;
};

export type TourPhase = "financial" | "bridge" | "product";

export type AnalysisTourStep = {
  id: string;
  title: string;
  explanation: string;
  page: TourPage;
  target: string;
  /** financial = your results on real widgets; product = how Fety works; bridge = transition */
  phase?: TourPhase;
  relatedInsightId?: string;
  relatedTipId?: string;
  action?: FetyActionTarget;
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
  tips: FinancialTip[];
};