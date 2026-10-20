import type { FinancialAnalysis, FinancialTip } from "../types/analysis";
import type { FetyStore } from "../types/fety";

export type InsightTipProgress = {
  doneIds: string[];
  archivedIds: string[];
};

export type InsightTipSlot = {
  tip: FinancialTip;
  done: boolean;
};

const STATIC_TIPS: FinancialTip[] = [
  {
    id: "static-calendar",
    title: "Open the calendar",
    explanation: "See ending balances and scheduled money on the days they matter.",
    category: "organization",
    actionLabel: "Go to calendar",
    action: { type: "calendar" },
  },
  {
    id: "static-budget",
    title: "Tune a category budget",
    explanation: "Adjust caps so spending power matches how you actually live.",
    category: "budgeting",
    actionLabel: "Open budget",
    action: { type: "budget" },
  },
  {
    id: "static-transactions",
    title: "Review recent transactions",
    explanation: "Make sure what you spent is captured — Insights and Budget use the same ledger.",
    category: "spending",
    actionLabel: "View transactions",
    action: { type: "transactions" },
  },
  {
    id: "static-goals",
    title: "Check a savings goal",
    explanation: "Goals give leftover cash a purpose and track progress over time.",
    category: "goals",
    actionLabel: "Open goals",
    action: { type: "goals" },
  },
  {
    id: "static-transactions",
    title: "Log a transaction",
    explanation: "Add spending or income on the Transactions page so Insights and budgets stay current.",
    category: "spending",
    actionLabel: "Open transactions",
    action: { type: "transactions" },
  },
  {
    id: "static-insights-widgets",
    title: "Pin a chart you use often",
    explanation: "From Your picture or Your spending mix, pin a chart to Your Charts below.",
    category: "organization",
    actionLabel: "Stay on Insights",
    action: { type: "dashboard" },
  },
  {
    id: "static-bills",
    title: "Add a regular bill",
    explanation: "Bills drive calendar projections and how much is already spoken for each month.",
    category: "budgeting",
    actionLabel: "Open budget",
    action: { type: "bills" },
  },
  {
    id: "static-income",
    title: "Add an income source",
    explanation: "Paychecks and other inflows make income allocation and calendar timing accurate.",
    category: "income",
    actionLabel: "Open budget",
    action: { type: "budget" },
  },
  {
    id: "static-networth",
    title: "Update account balances",
    explanation: "Net worth and per-account views stay trustworthy when balances match reality.",
    category: "organization",
    actionLabel: "Open profile",
    action: { type: "dashboard" },
  },
];

function progressOf(store: FetyStore): InsightTipProgress {
  return {
    doneIds: store.insightTipProgress?.doneIds ?? [],
    archivedIds: store.insightTipProgress?.archivedIds ?? [],
  };
}

/** Ordered pool: analysis tips first, then contextual fallbacks, then static library. */
export function buildTipPool(store: FetyStore, analysis: FinancialAnalysis): FinancialTip[] {
  const goal = store.goals[0];
  const contextual: FinancialTip[] = [
    {
      id: "ctx-calendar",
      title: "See your month as a calendar",
      explanation:
        analysis.missing.income && analysis.missing.obligations
          ? "Calendar is the easiest place to watch money in and out once you add a paycheck or bill."
          : "Calendar shows when money arrives and when it has to go out.",
      category: "organization",
      actionLabel: "Go to calendar",
      action: { type: "calendar" },
    },
    {
      id: "ctx-budget",
      title: analysis.missing.obligations ? "Put regular expenses in one place" : "Give flexible spending a cap",
      explanation: analysis.missing.obligations
        ? "Budget is where bills and category caps live. Adding one regular expense makes leftover cash real."
        : "Budget is where you decide how much each category gets each month.",
      category: "budgeting",
      actionLabel: "Open budget",
      action: { type: "budget" },
    },
    {
      id: "ctx-goals",
      title: goal ? `Keep ${goal.name} in view` : "Name something you're working toward",
      explanation: goal
        ? `Goals is where ${goal.name} lives — target, saved so far, and progress.`
        : "Goals tell Fety what leftover cash is for.",
      category: "goals",
      actionLabel: "Open goals",
      action: { type: "goals", goalId: goal?.id },
    },
  ];

  const seen = new Set<string>();
  const out: FinancialTip[] = [];
  const push = (tip: FinancialTip) => {
    if (seen.has(tip.id)) return;
    seen.add(tip.id);
    out.push(tip);
  };

  for (const tip of analysis.tips) push(tip);
  for (const tip of contextual) push(tip);
  for (const tip of STATIC_TIPS) push(tip);

  return out;
}

/** Always three tips; archived tips are replaced from the pool. */
export function resolveInsightTipSlots(store: FetyStore, analysis: FinancialAnalysis): InsightTipSlot[] {
  const { doneIds, archivedIds } = progressOf(store);
  const archived = new Set(archivedIds);
  const done = new Set(doneIds);
  const pool = buildTipPool(store, analysis).filter((t) => !archived.has(t.id));

  const prioritized = [...pool].sort((a, b) => {
    const aDone = done.has(a.id) ? 1 : 0;
    const bDone = done.has(b.id) ? 1 : 0;
    return aDone - bDone;
  });

  const slots: InsightTipSlot[] = [];
  const used = new Set<string>();

  for (const tip of prioritized) {
    if (slots.length >= 3) break;
    if (done.has(tip.id)) continue;
    used.add(tip.id);
    slots.push({ tip, done: false });
  }
  for (const tip of prioritized) {
    if (slots.length >= 3) break;
    if (used.has(tip.id)) continue;
    used.add(tip.id);
    slots.push({ tip, done: done.has(tip.id) });
  }
  let staticIdx = 0;
  while (slots.length < 3 && staticIdx < STATIC_TIPS.length * 2) {
    const tip = STATIC_TIPS[staticIdx % STATIC_TIPS.length];
    staticIdx++;
    if (archived.has(tip.id) || used.has(tip.id)) continue;
    used.add(tip.id);
    slots.push({ tip, done: done.has(tip.id) });
  }

  return slots.slice(0, 3);
}

export function markInsightTipDone(prev: FetyStore, tipId: string): InsightTipProgress {
  const p = progressOf(prev);
  const doneIds = p.doneIds.includes(tipId) ? p.doneIds : [...p.doneIds, tipId];
  return { ...p, doneIds };
}

export function archiveInsightTip(prev: FetyStore, tipId: string): InsightTipProgress {
  const p = progressOf(prev);
  const archivedIds = p.archivedIds.includes(tipId) ? p.archivedIds : [...p.archivedIds, tipId];
  const doneIds = p.doneIds.filter((id) => id !== tipId);
  return { ...p, archivedIds, doneIds };
}
