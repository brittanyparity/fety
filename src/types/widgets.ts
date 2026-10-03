/** Canonical widget category from the standardized widget system. */
export type WidgetCategory =
  | "overview"
  | "income"
  | "spending"
  | "budgeting"
  | "cash_flow"
  | "expenses"
  | "goals"
  | "planning";

/** Stable educational metadata for every Fety dashboard widget. */
export type FinancialWidgetDefinition = {
  id: string;
  name: string;
  category: WidgetCategory;
  shortDescription: string;
  whatItShows: string;
  whyItMatters: string;
  financialPlanningUses: string[];
  dataRequirements: string[];
  supportedInsights: string[];
  supportedActions: string[];
  assessmentSignals: string[];
  defaultVisibility: "core" | "optional";
  customizable: boolean;
  tourEligible: boolean;
  /** Primary financial question this widget answers. */
  primaryQuestion: string;
};

export type WidgetRecommendation = {
  widgetId: string;
  priority: number;
  reasons: string[];
  recommended: boolean;
};

export type DashboardWidgetSource = "core" | "recommended" | "user-added";

export type DashboardWidgetState = {
  widgetId: string;
  enabled: boolean;
  position: number;
  source: DashboardWidgetSource;
  userModified: boolean;
};

export type FinancialNeedId =
  | "spending_awareness"
  | "budget_organization"
  | "cash_flow_visibility"
  | "goal_planning"
  | "expense_planning"
  | "income_organization"
  | "recurring_expense_review"
  | "getting_started";

export type FinancialNeed = {
  id: FinancialNeedId;
  label: string;
  priority: number;
  explanation: string;
  relatedWidgets: string[];
  relatedTools: string[];
};

export type FinancialStoryBeat = {
  id: string;
  order: number;
  title: string;
  explanation: string;
  widgetId?: string;
  needId?: FinancialNeedId;
};

export type FinancialStory = {
  summary: string;
  beats: FinancialStoryBeat[];
};

export type FinancialAssessment = {
  needs: FinancialNeed[];
  prioritizedWidgets: WidgetRecommendation[];
  insights: import("./analysis").FinancialInsight[];
  tips: import("./analysis").FinancialTip[];
  financialStory: FinancialStory;
  /** Suggested pin order when the user has not customized the dashboard. */
  recommendedPinned: string[];
};
