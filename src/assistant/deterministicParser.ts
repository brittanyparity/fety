import { todayISO } from "../lib/fetyCalculations";
import type { TransactionType } from "../types/fety";
import {
  findBestTransactionMatch,
  resolveCategoryName,
  searchTransactions,
} from "./financialTools";
import type { AssistantContext, ParsedIntent } from "./types";
import { CONFIDENCE_HIGH, CONFIDENCE_MED } from "./types";

const CATEGORY_HINTS: [RegExp, string][] = [
  [/grocery|groceries/i, "Groceries"],
  [/whole foods|trader/i, "Groceries"],
  [/target|amazon|shopping/i, "Shopping"],
  [/restaurant|dining|takeout|take out/i, "Dining Out"],
  [/netflix|spotify/i, "Entertainment"],
  [/gas|fuel|uber|lyft/i, "Transportation"],
  [/rent|mortgage|housing/i, "Housing"],
  [/electric|internet|phone|utility/i, "Bills"],
];

function parseAmount(text: string): number | null {
  const m = text.match(/\$\s*([\d,]+(?:\.\d{1,2})?)|(?:^|\s)([\d,]+(?:\.\d{1,2})?)\s*(?:dollars|bucks)?/i);
  if (!m) return null;
  const raw = (m[1] ?? m[2]).replace(/,/g, "");
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

function parseDateISO(text: string): string {
  const lower = text.toLowerCase();
  const explicit = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (explicit) return explicit[1];
  const base = new Date();
  if (/yesterday/.test(lower)) {
    base.setDate(base.getDate() - 1);
    return base.toISOString().slice(0, 10);
  }
  if (/last week/.test(lower)) {
    base.setDate(base.getDate() - 7);
    return base.toISOString().slice(0, 10);
  }
  return todayISO();
}

function extractMerchant(text: string): string | null {
  const at = text.match(/\bat\s+([A-Za-z0-9][A-Za-z0-9\s&'.-]{1,40})/i);
  if (at) return at[1].trim().replace(/\s+(today|yesterday).*$/i, "");
  const forMerchant = text.match(/(?:spent|paid|bought).{0,20}?\$[\d,.]+\s+(?:at\s+)?([A-Za-z][A-Za-z0-9\s&'.-]{1,35})/i);
  if (forMerchant) return forMerchant[1].trim();
  return null;
}

function guessCategory(text: string, txnType: TransactionType, store: AssistantContext["store"]): string {
  if (txnType === "income") return "Income";
  const merchant = extractMerchant(text) ?? text;
  for (const [re, cat] of CATEGORY_HINTS) {
    if (re.test(merchant) || re.test(text)) {
      const resolved = resolveCategoryName(store, cat);
      return resolved ?? cat;
    }
  }
  const addTo = text.match(/add\s+\$?[\d,.]+\s+to\s+([a-z\s]+)/i);
  if (addTo) {
    const resolved = resolveCategoryName(store, addTo[1].trim());
    if (resolved) return resolved;
  }
  if (/bill|rent|electric/.test(text)) return "Bills";
  return "Other";
}

function guessTxnType(text: string): TransactionType {
  const lower = text.toLowerCase();
  if (/paycheck|salary|freelance|deposit|got paid|paid me|income|received/.test(lower)) return "income";
  if (/transfer|move\s+\$|moved\s+\$|from checking to savings|to savings/.test(lower)) return "transfer";
  if (/bill|rent due|paid rent|electric bill/.test(lower)) return "bill";
  return "expense";
}

function extractCategoryHint(text: string): string | null {
  const on = text.match(/(?:on|for)\s+([a-z\s]+?)(?:\s+this month|\?|$)/i);
  if (on) return on[1].trim();
  const spend = text.match(/spent on\s+([a-z\s]+)/i);
  if (spend) return spend[1].trim();
  return null;
}

function extractAffordAmount(text: string): number | null {
  const m = text.match(/afford\s+\$?([\d,]+(?:\.\d{1,2})?)/i) ?? text.match(/\$([\d,]+(?:\.\d{1,2})?)\s*(?:shoes|purchase|item)?/i);
  if (!m) return parseAmount(text);
  return parseFloat(m[1].replace(/,/g, ""));
}

function extractSearchQuery(text: string): string {
  return text
    .replace(/delete|remove|change|update|transaction|purchase|the|my|that/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Deterministic intent parser — Phase 1 (no LLM). */
export function parseDeterministicIntent(message: string, ctx: AssistantContext): ParsedIntent {
  const text = message.trim();
  const lower = text.toLowerCase();

  if (!text) {
    return { intent: "clarification_required", confidence: 1, arguments: {}, requiresConfirmation: false, clarification: "Say what you'd like to know or do with your money." };
  }

  // ——— Reads ———
  if (/spending power|how much can i spend|safe to spend|what can i spend/i.test(lower)) {
    return { intent: "get_spending_power", confidence: 0.95, arguments: {}, requiresConfirmation: false };
  }

  if (/can i afford|afford to spend|afford \$|afford a/i.test(lower)) {
    const amount = extractAffordAmount(text);
    if (amount === null || amount <= 0) {
      return {
        intent: "clarification_required",
        confidence: 0.7,
        arguments: {},
        requiresConfirmation: false,
        clarification: "How much are you thinking of spending? For example: \"Can I afford $150?\"",
      };
    }
    return { intent: "calculate_affordability", confidence: 0.92, arguments: { amount }, requiresConfirmation: false };
  }

  if (/bills coming up|upcoming bills|what bills|due soon/i.test(lower)) {
    return { intent: "get_upcoming_bills", confidence: 0.93, arguments: {}, requiresConfirmation: false };
  }

  if (/cash flow|balance today|financial snapshot/i.test(lower)) {
    return { intent: "get_cash_flow", confidence: 0.88, arguments: {}, requiresConfirmation: false };
  }

  if (/where did my money go|spending summary|how much did i spend this month|money out this month/i.test(lower)) {
    return { intent: "get_spending_summary", confidence: 0.9, arguments: {}, requiresConfirmation: false };
  }

  if (/how much.*(coming in|income|money in)|money coming in/i.test(lower)) {
    return { intent: "get_spending_summary", confidence: 0.85, arguments: { focus: "income" }, requiresConfirmation: false };
  }

  if (/run short|before payday|going to run out/i.test(lower)) {
    return { intent: "get_spending_power", confidence: 0.8, arguments: { caution: true }, requiresConfirmation: false };
  }

  if (/spending more|higher this month|why.*spending/i.test(lower)) {
    return { intent: "get_spending_summary", confidence: 0.82, arguments: { compare: true }, requiresConfirmation: false };
  }

  const catHint = extractCategoryHint(text);
  if (catHint && /how much|spent on|spending on/i.test(lower)) {
    return {
      intent: "get_category_breakdown",
      confidence: 0.9,
      arguments: { category: catHint },
      requiresConfirmation: false,
    };
  }

  if (/restaurants|groceries|dining|takeout/i.test(lower) && /how much|spent/i.test(lower)) {
    return {
      intent: "get_category_breakdown",
      confidence: 0.88,
      arguments: { category: catHint ?? lower.match(/restaurants|groceries|dining|takeout/i)?.[0] ?? "food" },
      requiresConfirmation: false,
    };
  }

  if (/my goals|show goals|list goals/i.test(lower)) {
    return { intent: "get_goals", confidence: 0.92, arguments: {}, requiresConfirmation: false };
  }

  if (/saved toward|goal progress|how much have i saved/i.test(lower)) {
    const name = text.replace(/how much have i saved toward|saved toward|goal progress for|my/gi, "").trim();
    return {
      intent: "get_goal_progress",
      confidence: name.length > 2 ? 0.88 : 0.6,
      arguments: { name: name || "vacation" },
      requiresConfirmation: false,
      clarification: name.length <= 2 ? "Which goal? For example: vacation or emergency fund." : undefined,
    };
  }

  if (/show transactions|recent transactions|list transactions/i.test(lower)) {
    return { intent: "get_transactions", confidence: 0.85, arguments: {}, requiresConfirmation: false };
  }

  if (/search transactions|find transaction/i.test(lower)) {
    return { intent: "search_transactions", confidence: 0.8, arguments: { query: extractSearchQuery(text) }, requiresConfirmation: false };
  }

  // ——— Transfer (confirm) ———
  if (/move\s+\$|transfer\s+\$|from checking to savings|to savings/i.test(lower)) {
    const amount = parseAmount(text);
    if (amount === null) {
      return {
        intent: "clarification_required",
        confidence: 0.65,
        arguments: {},
        requiresConfirmation: false,
        clarification: "How much should I move? Example: \"Move $100 from checking to savings.\"",
      };
    }
    return {
      intent: "transfer_money",
      confidence: 0.9,
      arguments: { amount, dateISO: parseDateISO(text) },
      requiresConfirmation: true,
    };
  }

  // ——— Delete (confirm) ———
  if (/delete all|remove all|clear all/i.test(lower) && /transaction/i.test(lower)) {
    const monthMatch = lower.match(/from\s+(january|february|march|april|may|june|july|august|september|october|november|december|\d{4}-\d{2})/i);
    return {
      intent: "delete_transaction",
      confidence: 0.85,
      arguments: { bulk: true, scope: monthMatch?.[0] ?? "all" },
      requiresConfirmation: true,
    };
  }

  if (/delete|remove/.test(lower) && /transaction|netflix|purchase|charge/i.test(lower)) {
    const q = extractSearchQuery(text);
    const match = findBestTransactionMatch(ctx.store, q || text);
    if (!match) {
      const candidates = searchTransactions(ctx.store, q, 3);
      if (candidates.length === 0) {
        return {
          intent: "clarification_required",
          confidence: 0.7,
          arguments: {},
          requiresConfirmation: false,
          clarification: `I couldn't find a transaction matching "${q || text}". Try the merchant name from Transactions.`,
        };
      }
      return {
        intent: "clarification_required",
        confidence: 0.65,
        arguments: {},
        requiresConfirmation: false,
        clarification: `Which one? ${candidates.map((c) => `"${c.desc}" (${c.dateISO})`).join(" · ")}`,
      };
    }
    return {
      intent: "delete_transaction",
      confidence: 0.9,
      arguments: { transactionId: match.id, label: match.desc },
      requiresConfirmation: true,
    };
  }

  // ——— Update transaction ———
  if (/change|update|move.*to groceries|recategorize/i.test(lower) && /transaction|purchase|target|groceries|category/i.test(lower)) {
    const q = extractSearchQuery(text.replace(/to groceries|to category/gi, ""));
    const match = findBestTransactionMatch(ctx.store, q || "target");
    const newCat = text.match(/to\s+(groceries|dining|shopping|bills|housing)/i)?.[1];
    if (!match) {
      return {
        intent: "clarification_required",
        confidence: 0.6,
        arguments: {},
        requiresConfirmation: false,
        clarification: "Which transaction should I update? Mention the store or describe it.",
      };
    }
    const category = newCat ? resolveCategoryName(ctx.store, newCat) ?? newCat : undefined;
    if (!category) {
      return {
        intent: "clarification_required",
        confidence: 0.65,
        arguments: { transactionId: match.id },
        requiresConfirmation: false,
        clarification: `Found "${match.desc}". What category should it be?`,
      };
    }
    return {
      intent: "update_transaction",
      confidence: 0.88,
      arguments: { transactionId: match.id, category },
      requiresConfirmation: false,
    };
  }

  // ——— Create goal ———
  const goalMatch = text.match(/create\s+(?:a\s+)?\$?([\d,]+)\s+([a-z\s]+?)\s+goal/i) ?? text.match(/\$?([\d,]+)\s+([a-z\s]+?)\s+goal/i);
  if (goalMatch) {
    const target = parseFloat(goalMatch[1].replace(/,/g, ""));
    const name = goalMatch[2].trim();
    if (Number.isFinite(target) && name) {
      return {
        intent: "create_goal",
        confidence: 0.9,
        arguments: { name, target },
        requiresConfirmation: false,
      };
    }
  }

  // ——— Starting balance ———
  if (/starting balance|opening balance/i.test(lower)) {
    const amount = parseAmount(text);
    if (amount !== null) {
      return {
        intent: "create_transaction",
        confidence: 0.85,
        arguments: { special: "starting_balance", amount },
        requiresConfirmation: false,
      };
    }
  }

  // ——— Create transaction ———
  const amount = parseAmount(text);
  const looksWrite =
    amount !== null &&
    (/spent|paid|bought|purchase|charged|cost|add \$|got paid|paycheck|freelance|deposit|received|income/i.test(lower) ||
      /add\s+\$?[\d,.]+\s+to/i.test(lower) ||
      /\$/.test(text));

  if (looksWrite && amount !== null) {
    const txnType = guessTxnType(text);
    const merchant = extractMerchant(text);
    const desc = merchant
      ? `${merchant}${txnType === "income" ? " income" : ""}`
      : text.length > 64
        ? `${text.slice(0, 61)}…`
        : text;
    const category =
      txnType === "income" && /paycheck|salary|pay roll/.test(lower)
        ? "Income"
        : guessCategory(text, txnType, ctx.store);
    return {
      intent: "create_transaction",
      confidence: merchant || /spent|paid|got paid|add \$/.test(lower) ? CONFIDENCE_HIGH : CONFIDENCE_MED,
      arguments: {
        amount,
        type: txnType,
        desc,
        category,
        dateISO: parseDateISO(text),
      },
      requiresConfirmation: false,
    };
  }

  if (/hello|hi |hey |good morning/i.test(lower)) {
    return {
      intent: "general_financial_question",
      confidence: 0.9,
      arguments: { greeting: true },
      requiresConfirmation: false,
    };
  }

  if (/help|what can you/i.test(lower)) {
    return {
      intent: "general_financial_question",
      confidence: 0.95,
      arguments: { help: true },
      requiresConfirmation: false,
    };
  }

  if (parsedComplexUnsupported(lower)) {
    return {
      intent: "unsupported",
      confidence: 0.75,
      arguments: {},
      requiresConfirmation: false,
      clarification:
        "That needs deeper analysis than I can do offline yet. I can still answer spending power, affordability, bills, categories, and log transactions.",
    };
  }

  return {
    intent: "clarification_required",
    confidence: 0.4,
    arguments: {},
    requiresConfirmation: false,
    clarification:
      "I can help with that, but I need a little more information. Try spending power, \"Can I afford $150?\", or \"I spent $43 at Target yesterday.\"",
  };
}

function parsedComplexUnsupported(lower: string): boolean {
  return /last three months|affecting my vacation|way more on food lately|what's changed over/i.test(lower);
}

export function shouldUseCloud(_message: string): boolean {
  return false;
}
