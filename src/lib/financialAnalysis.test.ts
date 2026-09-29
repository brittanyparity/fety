import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createEmptyStore } from "./fetyStorage";
import { analyzeStore, buildPersonalizedTour, pageForAction } from "./financialAnalysis";
import { monthlyFromFrequency } from "./scheduleAmounts";
import type { FetyStore } from "../types/fety";

function withMoney(partial: Partial<FetyStore>): FetyStore {
  return {
    ...createEmptyStore(),
    ...partial,
    profile: { ...createEmptyStore().profile, ...(partial.profile ?? {}) },
  };
}

describe("monthlyFromFrequency", () => {
  it("converts weekly, biweekly, semimonthly, and weekday amounts", () => {
    assert.equal(monthlyFromFrequency(100, "monthly"), 100);
    assert.equal(monthlyFromFrequency(100, "weekly"), (100 * 52) / 12);
    assert.equal(monthlyFromFrequency(200, "biweekly"), (200 * 26) / 12);
    assert.equal(monthlyFromFrequency(2000, "semimonthly"), 4000);
    assert.equal(monthlyFromFrequency(6, "weekday"), (6 * 5 * 52) / 12);
  });
});

describe("analyzeStore", () => {
  it("asks for more information when the store is empty", () => {
    const analysis = analyzeStore(createEmptyStore());
    assert.equal(analysis.missing.income, true);
    assert.equal(analysis.insights.some((i) => i.type === "missing_data"), true);
  });

  it("summarizes Social Security and a housing bill", () => {
    const store = withMoney({
      incomeStreams: [
        {
          id: "i1",
          name: "Social Security",
          amount: 1800,
          dueDay: 3,
          frequency: "monthly",
          category: "Income",
          icon: "🏛️",
        },
      ],
      bills: [
        {
          id: "b1",
          name: "Rent",
          amount: 1200,
          dueDay: 1,
          frequency: "monthly",
          category: "Housing",
          icon: "🏠",
        },
      ],
    });
    const analysis = analyzeStore(store);
    assert.equal(analysis.expectedMonthlyIncome, 1800);
    assert.equal(analysis.regularObligations, 1200);
    assert.equal(analysis.estimatedAvailable, 600);
    assert.equal(analysis.insights.some((i) => i.type === "largest_expense"), true);
    assert.equal(analysis.insights.some((i) => i.type === "income_summary"), true);
  });

  it("handles multiple income streams and retirement", () => {
    const store = withMoney({
      incomeStreams: [
        { id: "i1", name: "Paycheck", amount: 2000, dueDay: 1, frequency: "semimonthly", category: "Income", icon: "💵", semiMonthlyDays: [1, 15] },
        { id: "i2", name: "Retirement", amount: 400, dueDay: 5, frequency: "monthly", category: "Income", icon: "🏖️" },
      ],
    });
    const analysis = analyzeStore(store);
    assert.equal(analysis.expectedMonthlyIncome, 4400);
    assert.equal(analysis.incomeStreamCount, 2);
  });

  it("treats weekly income as a monthly equivalent", () => {
    const store = withMoney({
      incomeStreams: [
        { id: "i1", name: "Freelance", amount: 500, dueDay: 1, frequency: "weekly", category: "Income", icon: "💻" },
      ],
    });
    assert.equal(analyzeStore(store).expectedMonthlyIncome, monthlyFromFrequency(500, "weekly"));
  });

  it("separates obligations from flexible spending", () => {
    const store = withMoney({
      incomeStreams: [
        { id: "i1", name: "Paycheck", amount: 4000, dueDay: 1, frequency: "monthly", category: "Income", icon: "💵" },
      ],
      bills: [
        { id: "b1", name: "Rent", amount: 1500, dueDay: 1, frequency: "monthly", category: "Housing", icon: "🏠" },
      ],
      recurringTransactions: [
        { id: "r1", name: "Coffee", amount: 30, dueDay: 1, frequency: "weekly", category: "Coffee", icon: "☕", transactionType: "expense" },
        { id: "r2", name: "Dining", amount: 100, dueDay: 1, frequency: "weekly", category: "Dining", icon: "🍽️", transactionType: "expense" },
      ],
    });
    const analysis = analyzeStore(store);
    assert.equal(analysis.regularObligations, 1500);
    assert.ok(analysis.flexibleSpending > 500);
    assert.equal(analysis.insights.some((i) => i.type === "spending_pattern"), true);
  });

  it("surfaces a goal opportunity when cash is left over", () => {
    const store = withMoney({
      incomeStreams: [
        { id: "i1", name: "Paycheck", amount: 4000, dueDay: 1, frequency: "monthly", category: "Income", icon: "💵" },
      ],
      bills: [
        { id: "b1", name: "Rent", amount: 1500, dueDay: 1, frequency: "monthly", category: "Housing", icon: "🏠" },
      ],
      goals: [
        { id: "g1", name: "Emergency fund", icon: "🛟", target: 5000, saved: 0, targetDate: "2027-12-31", monthlyContribution: 0 },
      ],
    });
    const analysis = analyzeStore(store);
    assert.equal(analysis.insights.some((i) => i.type === "goal_opportunity"), true);
  });

  it("flags when obligations exceed income", () => {
    const store = withMoney({
      incomeStreams: [
        { id: "i1", name: "Disability", amount: 900, dueDay: 1, frequency: "monthly", category: "Income", icon: "♿" },
      ],
      bills: [
        { id: "b1", name: "Rent", amount: 1400, dueDay: 1, frequency: "monthly", category: "Housing", icon: "🏠" },
      ],
    });
    const analysis = analyzeStore(store);
    assert.equal(analysis.insights.some((i) => i.type === "attention_needed"), true);
  });

  it("notes incomplete everyday spending without blocking analysis", () => {
    const store = withMoney({
      incomeStreams: [
        { id: "i1", name: "Paycheck", amount: 3000, dueDay: 15, frequency: "monthly", category: "Income", icon: "💵" },
      ],
      bills: [
        { id: "b1", name: "Utilities", amount: 180, dueDay: 10, frequency: "monthly", category: "Utilities", icon: "⚡" },
      ],
    });
    const analysis = analyzeStore(store);
    assert.equal(analysis.missing.flexible, true);
    assert.equal(analysis.insights.some((i) => i.id === "missing-flexible"), true);
  });

  it("attaches quantitative tips mapped to Fety tools", () => {
    const store = withMoney({
      incomeStreams: [
        { id: "i1", name: "Paycheck", amount: 4000, dueDay: 1, frequency: "monthly", category: "Income", icon: "💵" },
      ],
      bills: [
        { id: "b1", name: "Rent", amount: 1500, dueDay: 1, frequency: "monthly", category: "Housing", icon: "🏠" },
      ],
      recurringTransactions: [
        { id: "r1", name: "Coffee", amount: 40, dueDay: 1, frequency: "weekly", category: "Coffee", icon: "☕", transactionType: "expense" },
      ],
      goals: [
        { id: "g1", name: "Emergency fund", icon: "🛟", target: 5000, saved: 0, targetDate: "2027-12-31", monthlyContribution: 0 },
      ],
      categories: [{ id: "c-coffee", name: "Coffee", icon: "☕", monthlyBudget: 200 }],
    });
    const analysis = analyzeStore(store);
    assert.ok(analysis.tips.length > 0);
    const flex = analysis.tips.find((t) => t.id === "tip-flex-reduce");
    assert.ok(flex, "expected a flexible-spending tip");
    assert.match(flex!.explanation, /\$/);
    assert.equal(flex!.action?.type, "budget");
    if (flex!.action?.type === "budget") {
      assert.equal(flex!.action.categoryId, "c-coffee");
    }
    const goalTip = analysis.tips.find((t) => t.id === "tip-goal-room");
    assert.equal(goalTip?.action?.type, "goals");
    const flexInsight = analysis.insights.find((i) => i.id === "flexible-spending");
    assert.equal(flexInsight?.action?.type, "budget");
    assert.equal(flexInsight?.dashboardTarget, "widget-spending-breakdown");
  });
});

describe("pageForAction", () => {
  it("routes each action to the matching page", () => {
    assert.equal(pageForAction({ type: "calendar" }), "calendar");
    assert.equal(pageForAction({ type: "goals", goalId: "g1" }), "goals");
    assert.equal(pageForAction({ type: "budget" }), "budget");
    assert.equal(pageForAction({ type: "bills" }), "budget");
    assert.equal(pageForAction({ type: "spending" }), "spending");
    assert.equal(pageForAction({ type: "transactions" }), "spending");
    assert.equal(pageForAction({ type: "dashboard" }), "dashboard");
  });
});

describe("buildPersonalizedTour", () => {
  it("always starts on the dashboard snapshot", () => {
    const store = createEmptyStore();
    const steps = buildPersonalizedTour(store, analyzeStore(store));
    assert.equal(steps[0]?.id, "snapshot");
    assert.equal(steps[0]?.page, "dashboard");
    assert.equal(steps.some((s) => s.id === "income"), false);
    assert.equal(steps.some((s) => s.id === "goals"), false);
  });

  it("walks income, budget, goals, and calendar when the store has them", () => {
    const store = withMoney({
      profile: { ...createEmptyStore().profile, displayName: "Alex" },
      incomeStreams: [
        { id: "i1", name: "Paycheck", amount: 4000, dueDay: 1, frequency: "monthly", category: "Income", icon: "💵" },
      ],
      bills: [
        { id: "b1", name: "Rent", amount: 1500, dueDay: 1, frequency: "monthly", category: "Housing", icon: "🏠" },
      ],
      recurringTransactions: [
        { id: "r1", name: "Dining", amount: 80, dueDay: 1, frequency: "weekly", category: "Dining", icon: "🍽️", transactionType: "expense" },
      ],
      goals: [
        { id: "g1", name: "Emergency fund", icon: "🛟", target: 5000, saved: 0, targetDate: "2027-12-31", monthlyContribution: 0 },
      ],
      categories: [{ id: "c-dining", name: "Dining", icon: "🍽️", monthlyBudget: 400 }],
    });
    const analysis = analyzeStore(store);
    const steps = buildPersonalizedTour(store, analysis);
    assert.ok(steps.some((s) => s.id === "income"));
    assert.ok(steps.some((s) => s.id === "budget" && s.target === "budget-category-c-dining"));
    assert.ok(steps.some((s) => s.id === "goals" && s.target === "goal-g1"));
    assert.ok(steps.some((s) => s.id === "calendar" && s.page === "calendar"));
    assert.ok(steps.some((s) => s.id === "tip" && s.action));
    assert.match(steps[0].explanation, /Alex/);
  });
});
