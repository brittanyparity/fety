export type PlannerNodeKind =
  | "anchor"
  | "purchase"
  | "investment"
  | "savings"
  | "strategy"
  | "outcome";

export type PlannerStrategyPreset =
  | "pay-yourself-first"
  | "fifty-thirty-twenty"
  | "emergency-fund-first";

export type PlannerStep = "weekly" | "monthly";

export type PlannerHorizonMonths = 6 | 12 | 24;

export interface PlannerNodeBase {
  id: string;
  kind: PlannerNodeKind;
  x: number;
  y: number;
  label: string;
}

export interface PlannerAnchorNode extends PlannerNodeBase {
  kind: "anchor";
}

export interface PlannerPurchaseNode extends PlannerNodeBase {
  kind: "purchase";
  amount: number;
  monthOffset: number;
}

export interface PlannerInvestmentNode extends PlannerNodeBase {
  kind: "investment";
  amount: number;
  monthOffset: number;
  annualReturnPct: number;
}

export interface PlannerSavingsNode extends PlannerNodeBase {
  kind: "savings";
  amountPerMonth: number;
  startMonth: number;
}

export interface PlannerStrategyNode extends PlannerNodeBase {
  kind: "strategy";
  preset: PlannerStrategyPreset;
}

export interface PlannerOutcomeNode extends PlannerNodeBase {
  kind: "outcome";
}

export type PlannerNode =
  | PlannerAnchorNode
  | PlannerPurchaseNode
  | PlannerInvestmentNode
  | PlannerSavingsNode
  | PlannerStrategyNode
  | PlannerOutcomeNode;

export interface PlannerEdge {
  id: string;
  fromId: string;
  toId: string;
}

export interface PlannerRunPoint {
  stepIndex: number;
  label: string;
  dateISO: string;
  balance: number;
  invested: number;
}

export interface PlannerRunResult {
  points: PlannerRunPoint[];
  endingBalance: number;
  totalInvested: number;
  lowestBalance: number;
  notes: string[];
}

export const PLANNER_NODE_CATALOG: {
  kind: PlannerNodeKind;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    kind: "anchor",
    label: "Your finances today",
    description: "Starting point from your current profile and balances.",
    icon: "◎",
  },
  {
    kind: "purchase",
    label: "Purchase",
    description: "One-time expense and when it hits your cash flow.",
    icon: "🛒",
  },
  {
    kind: "investment",
    label: "Investment",
    description: "Lump sum moved to investments with a simple growth rate.",
    icon: "📈",
  },
  {
    kind: "savings",
    label: "Savings / goal",
    description: "Monthly allocation toward savings or a goal.",
    icon: "🎯",
  },
  {
    kind: "strategy",
    label: "Planning tip",
    description: "Apply a financial strategy pattern to connected actions.",
    icon: "💡",
  },
  {
    kind: "outcome",
    label: "Outcome",
    description: "Where the scenario resolves—run ends here.",
    icon: "▶",
  },
];

export const PLANNER_STRATEGY_LABELS: Record<PlannerStrategyPreset, string> = {
  "pay-yourself-first": "Pay yourself first (+10% to savings)",
  "fifty-thirty-twenty": "50/30/20 (trim discretionary 5%)",
  "emergency-fund-first": "Emergency fund first (pause extras until buffer)",
};
