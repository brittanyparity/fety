import type { FinanceSummary, FetyStore, TransactionType } from "../types/fety";

/** PRD allowlist — Phase 1 deterministic only */
export type AssistantIntent =
  | "create_transaction"
  | "update_transaction"
  | "delete_transaction"
  | "create_bill"
  | "update_bill"
  | "delete_bill"
  | "create_goal"
  | "update_goal"
  | "delete_goal"
  | "transfer_money"
  | "get_spending_power"
  | "get_cash_flow"
  | "get_upcoming_bills"
  | "get_transactions"
  | "search_transactions"
  | "get_spending_summary"
  | "get_category_breakdown"
  | "calculate_affordability"
  | "get_goals"
  | "get_goal_progress"
  | "general_financial_question"
  | "clarification_required"
  | "unsupported";

export type ToolAction =
  | {
      tool: "create_transaction";
      payload: {
        desc: string;
        amount: number;
        type: TransactionType;
        category: string;
        dateISO: string;
        icon: string;
      };
    }
  | {
      tool: "update_transaction";
      payload: { id: string; category?: string; desc?: string; type?: TransactionType };
    }
  | { tool: "delete_transaction"; payload: { id: string; label: string } }
  | { tool: "delete_transactions_bulk"; payload: { ids: string[]; label: string } }
  | {
      tool: "transfer_money";
      payload: { amount: number; desc: string; dateISO: string; fromLabel: string; toLabel: string };
    }
  | { tool: "create_goal"; payload: { name: string; target: number; icon: string } }
  | { tool: "update_starting_balance"; payload: { amount: number } };

export interface ParsedIntent {
  intent: AssistantIntent;
  confidence: number;
  arguments: Record<string, unknown>;
  requiresConfirmation: boolean;
  clarification?: string;
}

export interface AssistantContext {
  store: FetyStore;
  summary: FinanceSummary;
  /** Recent user messages for reference resolution */
  recentUserText: string[];
}

export interface AssistantReply {
  text: string;
  tag?: string;
  resultCard?: { title: string; lines: string[] };
  confirmation?: {
    id: string;
    title: string;
    body: string;
    action: ToolAction;
  };
}

export interface ToolDeps {
  addTransaction: (input: {
    desc: string;
    amount: number;
    type: TransactionType;
    category: string;
    dateISO?: string;
    icon?: string;
  }) => void;
  updateTransaction: (
    id: string,
    updates: Partial<{ desc: string; amount: number; type: TransactionType; category: string }>,
  ) => void;
  deleteTransaction: (id: string) => void;
  addGoal: (goal: Omit<import("../types/fety").Goal, "id">) => void;
  updateProfile: (u: Partial<{ startingBalance: number }>) => void;
}

export const CONFIDENCE_HIGH = 0.85;
export const CONFIDENCE_MED = 0.55;
