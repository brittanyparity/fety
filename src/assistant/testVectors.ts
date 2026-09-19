/**
 * PRD §23 spot-check vectors for deterministic parser (manual / future automated tests).
 * Run: import { runParserSpotCheck } from "./testVectors" in dev console.
 */
import { parseDeterministicIntent } from "./deterministicParser";
import { computeSummary } from "../lib/fetyCalculations";
import { createEmptyStore } from "../lib/fetyStorage";
import type { AssistantContext } from "./types";

const VECTORS: { input: string; expectIntent: string }[] = [
  { input: "What's my Spending Power?", expectIntent: "get_spending_power" },
  { input: "How much can I spend today?", expectIntent: "get_spending_power" },
  { input: "Can I afford $150?", expectIntent: "calculate_affordability" },
  { input: "What bills are coming up?", expectIntent: "get_upcoming_bills" },
  { input: "I spent $43 at Target yesterday.", expectIntent: "create_transaction" },
  { input: "I got paid $2,400 today.", expectIntent: "create_transaction" },
  { input: "Add $200 to groceries.", expectIntent: "create_transaction" },
  { input: "Delete the Netflix transaction.", expectIntent: "delete_transaction" },
  { input: "Move $100 from checking to savings.", expectIntent: "transfer_money" },
  { input: "How much did I spend on restaurants this month?", expectIntent: "get_category_breakdown" },
];

export function runParserSpotCheck(): { pass: number; fail: number } {
  const store = createEmptyStore();
  store.profile.displayName = "Test";
  const ctx: AssistantContext = {
    store,
    summary: computeSummary(store),
    recentUserText: [],
  };
  let pass = 0;
  let fail = 0;
  for (const v of VECTORS) {
    const parsed = parseDeterministicIntent(v.input, ctx);
    if (parsed.intent === v.expectIntent) pass++;
    else {
      fail++;
      console.warn("FAIL", v.input, "expected", v.expectIntent, "got", parsed.intent);
    }
  }
  return { pass, fail };
}
