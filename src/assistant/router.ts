import type { FinanceSummary } from "../types/fety";
import {
  calculateAffordability,
  getCashFlowSnapshot,
  getCategoryBreakdown,
  getGoalProgress,
  getGoalsProgress,
  getSpendingPower,
  getSpendingSummary,
  getUpcomingBills,
  monthComparison,
  searchTransactions,
  usd,
} from "./financialTools";
import { parseDeterministicIntent } from "./deterministicParser";
import type { AssistantContext, AssistantReply, ParsedIntent, ToolAction, ToolDeps } from "./types";
import { CONFIDENCE_MED } from "./types";

function newConfirmationId() {
  return `cfm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildCreateTransactionAction(args: Record<string, unknown>): ToolAction {
  const amount = args.amount as number;
  const type = args.type as import("../types/fety").TransactionType;
  const desc = String(args.desc ?? "Transaction");
  const category = String(args.category ?? "Other");
  const dateISO = String(args.dateISO ?? new Date().toISOString().slice(0, 10));
  const icon = type === "income" ? "💼" : type === "bill" ? "📄" : type === "transfer" ? "🏦" : "💬";
  return {
    tool: "create_transaction",
    payload: { desc, amount, type, category, dateISO, icon },
  };
}

export function executeToolAction(action: ToolAction, deps: ToolDeps, summary: FinanceSummary): AssistantReply {
  switch (action.tool) {
    case "create_transaction": {
      const p = action.payload;
      deps.addTransaction({
        desc: p.desc,
        amount: p.amount,
        type: p.type,
        category: p.category,
        dateISO: p.dateISO,
        icon: p.icon,
      });
      const signed = p.type === "income" ? `+${usd(p.amount)}` : `-${usd(Math.abs(p.amount))}`;
      return {
        text: `Done. I added ${signed} for ${p.desc}. Check the dashboard for updated spending power.`,
        tag: p.type === "income" ? "Income recorded" : "Transaction added",
      };
    }
    case "update_transaction": {
      deps.updateTransaction(action.payload.id, {
        category: action.payload.category,
        desc: action.payload.desc,
        type: action.payload.type,
      });
      return { text: "Updated that transaction.", tag: "Transaction updated" };
    }
    case "delete_transaction": {
      deps.deleteTransaction(action.payload.id);
      return { text: `Removed "${action.payload.label}".`, tag: "Transaction deleted" };
    }
    case "delete_transactions_bulk": {
      for (const id of action.payload.ids) deps.deleteTransaction(id);
      return {
        text: `Removed ${action.payload.ids.length} transactions (${action.payload.label}).`,
        tag: "Transactions deleted",
      };
    }
    case "transfer_money": {
      const p = action.payload;
      deps.addTransaction({
        desc: p.desc,
        amount: p.amount,
        type: "transfer",
        category: "Savings",
        dateISO: p.dateISO,
        icon: "🏦",
      });
      return {
        text: `Recorded ${usd(p.amount)} transfer (${p.fromLabel} → ${p.toLabel}).`,
        tag: "Transfer logged",
      };
    }
    case "create_goal": {
      deps.addGoal({
        name: action.payload.name,
        target: action.payload.target,
        saved: 0,
        icon: action.payload.icon,
        targetDate: "TBD",
        monthlyContribution: 0,
      });
      return {
        text: `Created goal "${action.payload.name}" with target ${usd(action.payload.target)}.`,
        tag: "Goal created",
      };
    }
    case "update_starting_balance": {
      deps.updateProfile({ startingBalance: action.payload.amount });
      return { text: `Starting balance set to ${usd(action.payload.amount)}.`, tag: "Baseline updated" };
    }
    default:
      return { text: "That action is not available yet." };
  }
}

function replyFromReadIntent(parsed: ParsedIntent, ctx: AssistantContext): AssistantReply {
  const { store, summary } = ctx;
  switch (parsed.intent) {
    case "get_spending_power": {
      const { lines } = getSpendingPower(summary);
      const caution = parsed.arguments.caution
        ? ["If spending power is low, consider pausing discretionary purchases until your next income."]
        : [];
      return {
        text: lines[0],
        resultCard: { title: "Spending power", lines: [...lines, ...caution] },
      };
    }
    case "calculate_affordability": {
      const amount = parsed.arguments.amount as number;
      const { lines, affordable } = calculateAffordability(summary, amount);
      return {
        text: lines[0],
        tag: affordable ? "Affordable" : "Over budget",
        resultCard: { title: "Affordability", lines },
      };
    }
    case "get_upcoming_bills": {
      const { lines } = getUpcomingBills(store);
      return { text: lines[0], resultCard: { title: "Upcoming bills", lines } };
    }
    case "get_cash_flow": {
      const { lines } = getCashFlowSnapshot(store, summary);
      return { text: lines[0], resultCard: { title: "Cash flow", lines } };
    }
    case "get_spending_summary": {
      if (parsed.arguments.compare) {
        const { lines } = monthComparison(store);
        return { text: lines[0], resultCard: { title: "Month comparison", lines } };
      }
      const { lines } = getSpendingSummary(store, summary);
      if (parsed.arguments.focus === "income") {
        return {
          text: `About ${usd(summary.monthlyIncome)} in income this month so far.`,
          resultCard: { title: "Income", lines: [`In this month: ${usd(summary.monthlyIncome)}`, ...lines.slice(1)] },
        };
      }
      return { text: lines[0], resultCard: { title: "Spending summary", lines } };
    }
    case "get_category_breakdown": {
      const hint = String(parsed.arguments.category ?? "other");
      const { lines, category } = getCategoryBreakdown(store, hint);
      return { text: lines[0], resultCard: { title: category, lines } };
    }
    case "get_goals": {
      const { lines } = getGoalsProgress(store);
      return { text: lines[0], resultCard: { title: "Goals", lines } };
    }
    case "get_goal_progress": {
      const { lines } = getGoalProgress(store, String(parsed.arguments.name ?? ""));
      return { text: lines[0], resultCard: { title: "Goal progress", lines } };
    }
    case "get_transactions": {
      const recent = store.transactions.slice(0, 6);
      if (recent.length === 0) return { text: "No transactions yet." };
      const lines = recent.map((t) => `${t.dateISO} · ${t.desc} · ${t.amount >= 0 ? "+" : ""}${usd(t.amount)}`);
      return { text: `Latest: ${lines[0]}`, resultCard: { title: "Recent transactions", lines } };
    }
    case "search_transactions": {
      const q = String(parsed.arguments.query ?? "");
      const found = searchTransactions(store, q);
      if (found.length === 0) return { text: `No transactions matching "${q}".` };
      const lines = found.map((t) => `${t.desc} · ${usd(Math.abs(t.amount))} · ${t.dateISO}`);
      return { text: `Found ${found.length} match(es).`, resultCard: { title: "Search", lines } };
    }
    case "general_financial_question": {
      if (parsed.arguments.greeting) {
        return {
          text: `Hi${store.profile.displayName ? `, ${store.profile.displayName}` : ""}. Ask about spending power, bills, or tell me what you spent.`,
        };
      }
      return {
        text: 'I work offline with your Fety data. Try: "What\'s my spending power?", "Can I afford $150?", or "I spent $85 at Whole Foods."',
        tag: "Tips",
      };
    }
    case "unsupported": {
      return { text: String(parsed.clarification ?? "I can't answer that yet without cloud reasoning.") };
    }
    case "clarification_required": {
      return { text: String(parsed.clarification ?? "Can you rephrase that?") };
    }
    default:
      return { text: "I'm not sure how to help with that yet." };
  }
}

function writeIntentToAction(parsed: ParsedIntent, ctx: AssistantContext): ToolAction | null {
  const args = parsed.arguments;
  switch (parsed.intent) {
    case "create_transaction": {
      if (args.special === "starting_balance") {
        return { tool: "update_starting_balance", payload: { amount: args.amount as number } };
      }
      return buildCreateTransactionAction(args);
    }
    case "update_transaction":
      return {
        tool: "update_transaction",
        payload: {
          id: String(args.transactionId),
          category: args.category as string | undefined,
        },
      };
    case "delete_transaction": {
      if (args.bulk) {
        const ids = ctx.store.transactions.map((t) => t.id);
        return { tool: "delete_transactions_bulk", payload: { ids, label: String(args.scope ?? "all") } };
      }
      return {
        tool: "delete_transaction",
        payload: { id: String(args.transactionId), label: String(args.label ?? "transaction") },
      };
    }
    case "transfer_money": {
      const amount = args.amount as number;
      return {
        tool: "transfer_money",
        payload: {
          amount,
          dateISO: String(args.dateISO),
          desc: "Transfer: Checking → Savings",
          fromLabel: "Checking",
          toLabel: "Savings",
        },
      };
    }
    case "create_goal":
      return {
        tool: "create_goal",
        payload: {
          name: String(args.name),
          target: args.target as number,
          icon: "🎯",
        },
      };
    default:
      return null;
  }
}

const READ_INTENTS = new Set([
  "get_spending_power",
  "calculate_affordability",
  "get_upcoming_bills",
  "get_cash_flow",
  "get_spending_summary",
  "get_category_breakdown",
  "get_goals",
  "get_goal_progress",
  "get_transactions",
  "search_transactions",
  "general_financial_question",
  "unsupported",
  "clarification_required",
]);

export function handleAssistantMessageWithDeps(
  message: string,
  ctx: AssistantContext,
  deps: ToolDeps,
): AssistantReply {
  const parsed = parseDeterministicIntent(message, ctx);

  if (parsed.intent === "clarification_required" && parsed.clarification) {
    return { text: parsed.clarification };
  }

  if (READ_INTENTS.has(parsed.intent) && parsed.confidence >= CONFIDENCE_MED) {
    return replyFromReadIntent(parsed, ctx);
  }

  if (parsed.confidence < CONFIDENCE_MED) {
    return {
      text:
        parsed.clarification ??
        "I can help with that, but I need a little more information. Include amounts for purchases or name a category.",
    };
  }

  const action = writeIntentToAction(parsed, ctx);
  if (!action) {
    return replyFromReadIntent(parsed, ctx);
  }

  if (parsed.requiresConfirmation) {
    const title =
      action.tool === "transfer_money"
        ? `Move ${usd(action.payload.amount)}?`
        : action.tool === "delete_transactions_bulk"
          ? `Delete ${action.payload.ids.length} transactions?`
          : "Confirm action";

    const body =
      action.tool === "delete_transaction"
        ? `Remove "${action.payload.label}"? This cannot be undone.`
        : action.tool === "delete_transactions_bulk"
          ? `Remove ${action.payload.ids.length} transactions? This cannot be undone.`
          : action.tool === "transfer_money"
            ? `${action.payload.fromLabel} → ${action.payload.toLabel}: ${usd(action.payload.amount)}`
            : "Confirm to proceed.";

    return {
      text: body,
      confirmation: { id: newConfirmationId(), title, body, action },
    };
  }

  return executeToolAction(action, deps, ctx.summary);
}

export function confirmAssistantAction(action: ToolAction, deps: ToolDeps, summary: FinanceSummary): AssistantReply {
  return executeToolAction(action, deps, summary);
}
