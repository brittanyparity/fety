import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createEmptyStore } from "./fetyStorage";
import { applyBillScheduleToStore } from "./billScheduling";
import { analyzeStore, buildChatBriefingTips, buildPersonalizedTour, pageForAction } from "./financialAnalysis";
import { buildCalendarMap, computeSummary, endingBalanceOnDate, todayISO } from "./fetyCalculations";
import { accountBalanceWithTransactions } from "./ledger";
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
    assert.equal(monthlyFromFrequency(100, "weekly"), 433.33);
    assert.equal(monthlyFromFrequency(200, "biweekly"), 433.33);
    assert.equal(monthlyFromFrequency(2000, "semimonthly"), 4000);
    assert.equal(monthlyFromFrequency(6, "weekday"), 130);
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
        { id: "b1", name: "Electric", amount: 180, dueDay: 10, frequency: "monthly", category: "Electric", icon: "⚡" },
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
    assert.equal(pageForAction({ type: "calendar" }), "dashboard");
    assert.equal(pageForAction({ type: "goals", goalId: "g1" }), "goals");
    assert.equal(pageForAction({ type: "budget" }), "budget");
    assert.equal(pageForAction({ type: "bills" }), "budget");
    assert.equal(pageForAction({ type: "spending" }), "spending");
    assert.equal(pageForAction({ type: "transactions" }), "spending");
    assert.equal(pageForAction({ type: "dashboard" }), "dashboard");
  });
});

describe("buildPersonalizedTour", () => {
  it("starts with a dashboard orientation when data is sparse", () => {
    const store = createEmptyStore();
    const steps = buildPersonalizedTour(store, analyzeStore(store));
    assert.ok(steps[0]?.id === "snapshot" || steps[0]?.id === "spending-power");
    assert.equal(steps[0]?.page, "dashboard");
    assert.equal(steps[0]?.phase, "financial");
    assert.ok(steps.some((s) => s.phase === "bridge"));
    assert.ok(steps.some((s) => s.phase === "product"));
  });

  it("runs financial widget highlights then bridges into the product tour", () => {
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
        { id: "g1", name: "Emergency fund", icon: "🛟", target: 5000, saved: 500, targetDate: "2027-12-31", monthlyContribution: 0 },
      ],
      categories: [{ id: "c-dining", name: "Dining", icon: "🍽️", monthlyBudget: 400 }],
      pinnedWidgets: ["weekly-power", "spending-breakdown", "savings-goal", "next-paycheck"],
    });
    const analysis = analyzeStore(store);
    const steps = buildPersonalizedTour(store, analysis, {
      financialStory: { summary: "Spending awareness may be most useful.", beats: [] },
      needs: [{ id: "spending_awareness", label: "Spending awareness" }],
      recommendedPinned: ["weekly-power", "spending-breakdown", "savings-goal"],
    });
    assert.equal(steps[0]?.target, "widget-weekly-power");
    assert.equal(steps[0]?.phase, "financial");
    assert.match(steps[0].explanation, /Alex/);
    assert.match(steps[0].explanation, /spending power this week/i);
    assert.ok(steps.some((s) => s.target === "widget-spending-breakdown" && s.phase === "financial"));
    assert.ok(steps.some((s) => s.target === "widget-savings-goal" && s.phase === "financial"));
    assert.ok(steps.some((s) => s.id === "bridge-product" && s.phase === "bridge"));
    assert.ok(steps.some((s) => s.id === "budget" && s.phase === "product"));
    assert.ok(steps.some((s) => s.id === "customize" && s.phase === "product"));
  });
});

describe("buildChatBriefingTips", () => {
  it("returns three tips on different platform areas", () => {
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
    const cards = buildChatBriefingTips(store, analyzeStore(store));
    assert.equal(cards.length, 3);
    assert.equal(new Set(cards.map((c) => c.featureLabel)).size, 3);
    assert.ok(cards.every((c) => c.workflow.length === 3 && c.action));
  });

  it("still offers three starting areas when the store is empty", () => {
    const store = createEmptyStore();
    const cards = buildChatBriefingTips(store, analyzeStore(store));
    assert.equal(cards.length, 3);
    assert.equal(new Set(cards.map((c) => c.featureLabel)).size, 3);
  });
});

describe("ledger start date and current balance", () => {
  it("does not create scheduled transactions before the setup date", () => {
    const store = applyBillScheduleToStore(
      withMoney({
        profile: {
          displayName: "Alex",
          email: "",
          currency: "USD",
          startingBalance: 1000,
          balanceAsOfISO: "2026-10-15",
        },
        incomeStreams: [
          { id: "i1", name: "Paycheck", amount: 2000, dueDay: 1, frequency: "monthly", category: "Income", icon: "💵" },
        ],
      }),
      new Date(2026, 9, 20),
    );
    assert.ok(store.transactions.every((t) => t.dateISO >= "2026-10-15"));
    assert.equal(store.transactions.some((t) => t.desc === "Paycheck" && t.dateISO === "2026-10-01"), false);
    assert.ok(store.transactions.some((t) => t.desc === "Paycheck" && t.dateISO === "2026-11-01"));
  });

  it("keeps the current balance through today, not future scheduled pay", () => {
    const store = applyBillScheduleToStore(
      withMoney({
        profile: {
          displayName: "Alex",
          email: "",
          currency: "USD",
          startingBalance: 100,
          balanceAsOfISO: "2026-10-01",
        },
        incomeStreams: [
          {
            id: "i1",
            name: "Paycheck",
            amount: 2000,
            dueDay: 1,
            frequency: "monthly",
            category: "Income",
            icon: "💵",
            startDateISO: "2027-06-01",
          },
        ],
      }),
      new Date(2026, 9, 20),
    );
    const summary = computeSummary(store, new Date(2026, 9, 20));
    assert.equal(summary.balance, 100);
    assert.ok(store.transactions.some((t) => t.desc === "Paycheck" && t.dateISO === "2027-06-01"));
  });

  it("computeSummary caps category spend through today without throwing", () => {
    const store = applyBillScheduleToStore({
      ...createEmptyStore(),
      onboardingCompleted: true,
      profile: {
        displayName: "Alex",
        email: "",
        currency: "USD",
        startingBalance: 500,
        balanceAsOfISO: "2026-10-01",
      },
      categories: [{ id: "c1", name: "Groceries", icon: "🛒", monthlyBudget: 200 }],
      transactions: [
        {
          id: "t1",
          dateISO: "2026-10-15",
          desc: "Store",
          category: "Groceries",
          amount: -40,
          type: "expense",
          icon: "🛒",
        },
      ],
    });
    const summary = computeSummary(store, new Date(2026, 9, 20));
    assert.equal(summary.categoriesWithSpent[0]?.spent, 40);
  });
});

describe("account-linked balances", () => {
  it("updates account balance and calendar totals when a transaction uses fromAccountId", () => {
    const store = withMoney({
      profile: {
        displayName: "Alex",
        email: "",
        currency: "USD",
        startingBalance: 0,
        balanceAsOfISO: "2026-01-01",
      },
      accounts: [
        {
          id: "a1",
          name: "Checking",
          type: "Checking",
          balance: 1000,
          icon: "🏦",
          kind: "asset",
          balanceAsOfISO: "2026-01-01",
        },
      ],
      transactions: [
        {
          id: "t1",
          dateISO: "2026-01-10",
          desc: "Groceries",
          category: "Groceries",
          amount: -75,
          type: "expense",
          icon: "🛒",
          fromAccountId: "a1",
        },
      ],
    });

    assert.equal(accountBalanceWithTransactions(store, "a1"), 925);
    assert.equal(endingBalanceOnDate(store, "2026-01-10"), 925);
    const day = buildCalendarMap(store, 2026).get("2026-01-10");
    assert.equal(day?.endBal, 925);
    assert.equal(day?.startBal, 1000);
  });

  it("updates the destination account for income with toAccountId", () => {
    const store = withMoney({
      profile: {
        displayName: "Alex",
        email: "",
        currency: "USD",
        startingBalance: 0,
        balanceAsOfISO: "2026-01-01",
      },
      accounts: [
        {
          id: "a1",
          name: "Checking",
          type: "Checking",
          balance: 200,
          icon: "🏦",
          kind: "asset",
          balanceAsOfISO: "2026-01-01",
        },
      ],
      transactions: [
        {
          id: "t1",
          dateISO: "2026-01-05",
          desc: "Paycheck",
          category: "Income",
          amount: 500,
          type: "deposit",
          icon: "💵",
          toAccountId: "a1",
        },
      ],
    });

    assert.equal(accountBalanceWithTransactions(store, "a1"), 700);
    assert.equal(endingBalanceOnDate(store, "2026-01-05"), 700);
  });

  it("caps net worth account balances at today but projects calendar balances on future dates", () => {
    const today = todayISO();
    const store = withMoney({
      profile: {
        displayName: "Alex",
        email: "",
        currency: "USD",
        startingBalance: 1000,
        balanceAsOfISO: "2020-01-01",
      },
      accounts: [
        {
          id: "a1",
          name: "Checking",
          type: "Checking",
          balance: 1000,
          icon: "🏦",
          kind: "asset",
          balanceAsOfISO: "2020-01-01",
        },
      ],
      transactions: [
        {
          id: "t-future",
          dateISO: "2099-06-01",
          desc: "Future bill",
          category: "Bills",
          amount: -500,
          type: "expense",
          icon: "📄",
          fromAccountId: "a1",
        },
      ],
    });

    assert.equal(accountBalanceWithTransactions(store, "a1"), 1000);
    assert.equal(endingBalanceOnDate(store, today), 1000);
    assert.equal(endingBalanceOnDate(store, "2099-06-01"), 500);
    const futureDay = buildCalendarMap(store, 2099).get("2099-06-01");
    assert.equal(futureDay?.items.length, 1);
    assert.equal(futureDay?.endBal, 500);
  });
});
