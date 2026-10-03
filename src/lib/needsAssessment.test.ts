import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDefaultStore, createEmptyStore } from "./fetyStorage";
import { assessFinancialNeeds, shouldApplyPersonalizedPins, withPersonalizedPins } from "./needsAssessment";
import { WIDGET_CATALOG, getWidgetDefinition } from "./widgetCatalog";
import { PLANNING_RULES, FINANCIAL_CONCEPTS } from "./financialKnowledge";
import type { FetyStore } from "../types/fety";

function withMoney(partial: Partial<FetyStore>): FetyStore {
  return {
    ...createEmptyStore(),
    ...partial,
    profile: { ...createEmptyStore().profile, ...(partial.profile ?? {}) },
  };
}

describe("widget catalog", () => {
  it("covers every known educational metadata field", () => {
    assert.ok(WIDGET_CATALOG.length >= 10);
    for (const w of WIDGET_CATALOG) {
      assert.ok(w.id);
      assert.ok(w.name);
      assert.ok(w.shortDescription);
      assert.ok(w.whatItShows);
      assert.ok(w.whyItMatters);
      assert.ok(w.financialPlanningUses.length > 0);
      assert.ok(w.primaryQuestion);
      assert.equal(getWidgetDefinition(w.id)?.id, w.id);
    }
  });
});

describe("financial knowledge base", () => {
  it("exposes concepts and planning rules without UI coupling", () => {
    assert.ok(FINANCIAL_CONCEPTS.some((c) => c.id === "cash_flow"));
    assert.ok(PLANNING_RULES.some((r) => r.id === "need-spending-awareness"));
    assert.ok(PLANNING_RULES.every((r) => r.relevantWidgets.length > 0));
  });
});

describe("assessFinancialNeeds", () => {
  it("asks for fundamentals when the store is empty", () => {
    const assessment = assessFinancialNeeds(createEmptyStore());
    assert.ok(assessment.needs.some((n) => n.id === "getting_started"));
    assert.ok(assessment.recommendedPinned.includes("stat-balance"));
    assert.ok(assessment.financialStory.beats.length > 0);
  });

  it("recommends spending and cash-flow widgets for the PRD example profile", () => {
    const store = withMoney({
      incomeStreams: [
        {
          id: "i1",
          name: "Paycheck",
          amount: 2000,
          dueDay: 1,
          frequency: "semimonthly",
          category: "Income",
          icon: "💵",
          semiMonthlyDays: [1, 15],
        },
      ],
      bills: [
        {
          id: "b1",
          name: "Rent",
          amount: 1800,
          dueDay: 1,
          frequency: "monthly",
          category: "Housing",
          icon: "🏠",
        },
      ],
      recurringTransactions: [
        {
          id: "r1",
          name: "Dining",
          amount: 300,
          dueDay: 1,
          frequency: "monthly",
          category: "Dining Out",
          icon: "🍽️",
          transactionType: "expense",
        },
        {
          id: "r2",
          name: "Shopping",
          amount: 250,
          dueDay: 1,
          frequency: "monthly",
          category: "Shopping",
          icon: "🛍️",
          transactionType: "expense",
        },
      ],
      goals: [
        {
          id: "g1",
          name: "Emergency Fund",
          icon: "🛡️",
          target: 5000,
          saved: 1000,
          targetDate: "Dec 2026",
          monthlyContribution: 200,
        },
      ],
      categories: [
        { id: "c1", name: "Dining Out", icon: "🍽️", monthlyBudget: 300 },
        { id: "c2", name: "Shopping", icon: "🛍️", monthlyBudget: 250 },
      ],
    });

    const assessment = assessFinancialNeeds(store);
    assert.ok(assessment.needs.some((n) => n.id === "spending_awareness" || n.id === "cash_flow_visibility"));
    assert.ok(assessment.needs.some((n) => n.id === "goal_planning"));
    assert.ok(assessment.recommendedPinned.includes("weekly-power"));
    assert.ok(assessment.recommendedPinned.includes("spending-breakdown"));
    assert.ok(assessment.recommendedPinned.includes("savings-goal"));

    const spendRec = assessment.prioritizedWidgets.find((r) => r.widgetId === "spending-breakdown");
    assert.ok(spendRec?.recommended);
    assert.ok((spendRec?.reasons.length ?? 0) > 0);
  });

  it("flags negative cash flow without inventing numbers", () => {
    const store = withMoney({
      incomeStreams: [
        { id: "i1", name: "Pay", amount: 1000, dueDay: 1, frequency: "monthly", category: "Income", icon: "💵" },
      ],
      bills: [
        { id: "b1", name: "Rent", amount: 1200, dueDay: 1, frequency: "monthly", category: "Housing", icon: "🏠" },
      ],
    });
    const assessment = assessFinancialNeeds(store);
    assert.ok(assessment.needs.some((n) => n.id === "cash_flow_visibility" || n.id === "recurring_expense_review"));
    assert.ok(assessment.recommendedPinned.includes("biggest-bill") || assessment.recommendedPinned.includes("weekly-power"));
  });

  it("does not override pins when the user has customized", () => {
    const store = {
      ...createDefaultStore(),
      dashboardCustomizedByUser: true,
      widgetsPersonalizedV1: false,
      pinnedWidgets: ["stat-balance"],
    };
    assert.equal(shouldApplyPersonalizedPins(store), false);
    assert.deepEqual(withPersonalizedPins(store).pinnedWidgets, ["stat-balance"]);
  });

  it("applies recommended pins once for a fresh completed profile", () => {
    const store = withMoney({
      onboardingCompleted: true,
      widgetsPersonalizedV1: false,
      dashboardCustomizedByUser: false,
      incomeStreams: [
        { id: "i1", name: "Pay", amount: 3000, dueDay: 1, frequency: "monthly", category: "Income", icon: "💵" },
      ],
      bills: [
        { id: "b1", name: "Rent", amount: 1000, dueDay: 1, frequency: "monthly", category: "Housing", icon: "🏠" },
      ],
    });
    const next = withPersonalizedPins(store);
    assert.equal(next.widgetsPersonalizedV1, true);
    assert.ok(next.pinnedWidgets.includes("weekly-power"));
    // Second pass must not reshuffle
    const again = withPersonalizedPins(next);
    assert.deepEqual(again.pinnedWidgets, next.pinnedWidgets);
  });
});
