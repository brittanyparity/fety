import { computeSummary, formatConversationalDate, todayISO } from "../lib/fetyCalculations";
import { goalSavedTotal } from "../lib/ledger";
import { nextBillOccurrenceOnOrAfter } from "../lib/billScheduling";
import type { Bill, FinanceSummary, FetyStore, Transaction } from "../types/fety";

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export function getSpendingPower(summary: FinanceSummary): { lines: string[] } {
  return {
    lines: [
      `Spending power this week: ${usd(summary.weeklySpendingPower)}`,
      `${usd(summary.weeklySpent)} spent of ${usd(summary.weeklyBudget)} weekly budget (${summary.weeklyUsedPct}%).`,
      `Current balance: ${usd(summary.balance)}.`,
    ],
  };
}

export function calculateAffordability(
  summary: FinanceSummary,
  amount: number,
): { lines: string[]; affordable: boolean; powerAfter: number } {
  const powerAfter = summary.weeklySpendingPower - amount;
  const affordable = powerAfter >= 0;
  const lines = affordable
    ? [
        `Yes. After ${usd(amount)}, you'd still have about ${usd(Math.max(0, powerAfter))} of spending power this week.`,
        `Current spending power: ${usd(summary.weeklySpendingPower)}.`,
      ]
    : [
        `That would put you about ${usd(Math.abs(powerAfter))} over your safe spending power for the week.`,
        `Current spending power: ${usd(summary.weeklySpendingPower)}.`,
      ];
  return { lines, affordable, powerAfter };
}

export function getUpcomingBills(store: FetyStore, ref = new Date()): { lines: string[] } {
  if (store.bills.length === 0) {
    return { lines: ["No bills on file yet. Add them in Budget or tell me: \"Add rent bill $2000 due on the 1st.\""] };
  }
  const todayIso = ref.toISOString().slice(0, 10);
  const sorted = [...store.bills]
    .map((b) => ({ bill: b, next: nextBillOccurrenceOnOrAfter(b, ref) }))
    .filter((x): x is { bill: Bill; next: string } => x.next != null)
    .sort((a, b) => a.next.localeCompare(b.next));
  const lines = sorted.slice(0, 6).map(({ bill: b, next }) => {
    const daysUntil = Math.round(
      (new Date(`${next}T12:00:00`).getTime() - new Date(`${todayIso}T12:00:00`).getTime()) / 86400000,
    );
    const freq = b.frequency ?? "monthly";
    const dueLabel = formatConversationalDate(next);
    const suffix = daysUntil === 0 ? "" : daysUntil <= 7 ? ` (~${daysUntil}d)` : "";
    return `${b.name}: ${usd(b.amount)} · next due ${dueLabel}${suffix} · ${freq}`;
  });
  return { lines };
}

export function getSpendingSummary(store: FetyStore, summary: FinanceSummary): { lines: string[] } {
  return {
    lines: [
      `This month: ${usd(summary.monthlyExpenses)} out · ${usd(summary.monthlyIncome)} in.`,
      `Net this month: ${usd(summary.monthlyIncome - summary.monthlyExpenses)}.`,
      `Balance: ${usd(summary.balance)}.`,
    ],
  };
}

function normalizeCat(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
}

export function resolveCategoryName(store: FetyStore, hint: string): string | null {
  const h = normalizeCat(hint);
  const aliases: Record<string, string[]> = {
    groceries: ["grocery", "groceries", "food shopping"],
    "dining out": ["restaurant", "restaurants", "dining", "takeout", "take out"],
    shopping: ["target", "amazon", "retail"],
    bills: ["bill", "utilities"],
    income: ["paycheck", "salary"],
  };
  for (const c of store.categories) {
    if (normalizeCat(c.name) === h || normalizeCat(c.name).includes(h) || h.includes(normalizeCat(c.name))) {
      return c.name;
    }
  }
  for (const [cat, keys] of Object.entries(aliases)) {
    if (keys.some((k) => h.includes(k) || k.includes(h))) {
      const match = store.categories.find((c) => normalizeCat(c.name) === normalizeCat(cat));
      return match?.name ?? cat.replace(/\b\w/g, (x) => x.toUpperCase());
    }
  }
  return null;
}

export function getCategoryBreakdown(
  store: FetyStore,
  categoryHint: string,
  ref = new Date(),
): { lines: string[]; category: string; spent: number } {
  const name = resolveCategoryName(store, categoryHint) ?? categoryHint;
  const summary = computeSummary(store, ref);
  const row = summary.categoriesWithSpent.find((c) => normalizeCat(c.name) === normalizeCat(name));
  if (!row) {
    return {
      lines: [`I don't see a category matching "${categoryHint}". Check Budget for your category names.`],
      category: name,
      spent: 0,
    };
  }
  const left = row.monthlyBudget - row.spent;
  return {
    category: row.name,
    spent: row.spent,
    lines: [
      `${row.name} this month: ${usd(row.spent)} spent of ${usd(row.monthlyBudget)} budget.`,
      left >= 0 ? `${usd(left)} left in that category.` : `${usd(Math.abs(left))} over budget.`,
    ],
  };
}

export function searchTransactions(store: FetyStore, query: string, limit = 8): Transaction[] {
  const q = query.toLowerCase();
  return store.transactions
    .filter((t) => t.desc.toLowerCase().includes(q) || t.category.toLowerCase().includes(q))
    .slice(0, limit);
}

export function findBestTransactionMatch(store: FetyStore, query: string): Transaction | null {
  const q = query.toLowerCase().replace(/transaction|purchase|the|my/g, "").trim();
  if (!q) return null;
  const matches = searchTransactions(store, q, 20);
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    const exact = matches.find((t) => t.desc.toLowerCase().includes(q));
    return exact ?? null;
  }
  return null;
}

export function getGoalsProgress(store: FetyStore): { lines: string[] } {
  if (store.goals.length === 0) return { lines: ["No goals yet. Try: \"Create a $2,500 vacation goal.\""] };
  const lines = store.goals.map((g) => {
    const saved = goalSavedTotal(store, g);
    const pct = g.target > 0 ? Math.round((saved / g.target) * 100) : 0;
    return `${g.name}: ${usd(saved)} of ${usd(g.target)} (${pct}%)`;
  });
  return { lines };
}

export function getGoalProgress(store: FetyStore, nameHint: string): { lines: string[] } {
  const h = nameHint.toLowerCase();
  const g = store.goals.find((x) => x.name.toLowerCase().includes(h) || h.includes(x.name.toLowerCase()));
  if (!g) return { lines: [`I couldn't find a goal matching "${nameHint}".`] };
  const saved = goalSavedTotal(store, g);
  const pct = g.target > 0 ? Math.round((saved / g.target) * 100) : 0;
  return {
    lines: [
      `${g.name}: ${usd(saved)} saved toward ${usd(g.target)} (${pct}%).`,
      `Target date: ${g.targetDate}. Monthly contribution: ${usd(g.monthlyContribution)}.`,
    ],
  };
}

export function getCashFlowSnapshot(store: FetyStore, summary: FinanceSummary): { lines: string[] } {
  return {
    lines: [
      `Balance today: ${usd(summary.balance)}.`,
      `In today: ${usd(summary.moneyInToday)} · Out today: ${usd(summary.moneyOutToday)}.`,
      `Spending power this week: ${usd(summary.weeklySpendingPower)}.`,
      `Upcoming bills: ${store.bills.length} on file — ask "What bills are coming up?" for details.`,
    ],
  };
}

export function monthComparison(store: FetyStore): { lines: string[] } {
  const now = new Date();
  const thisSum = computeSummary(store, now);
  const last = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  const lastSum = computeSummary(store, last);
  const diff = thisSum.monthlyExpenses - lastSum.monthlyExpenses;
  const dir = diff > 0 ? "higher" : diff < 0 ? "lower" : "about the same as";
  return {
    lines: [
      `Spending this month: ${usd(thisSum.monthlyExpenses)} vs ${usd(lastSum.monthlyExpenses)} last month.`,
      diff === 0 ? "Spending is flat month over month." : `That's ${usd(Math.abs(diff))} ${dir} last month.`,
    ],
  };
}

export { usd, todayISO };
