import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FetyStore } from "../types/fety";
import { computeAffordability } from "./affordability";
import { todayISO } from "./fetyCalculations";

function minimalStore(overrides: Partial<FetyStore> = {}): FetyStore {
  const base: FetyStore = {
    version: 1,
    onboardingCompleted: true,
    profile: {
      displayName: "Test",
      email: "t@test.com",
      currency: "USD",
      startingBalance: 1000,
      balanceAsOfISO: "2026-01-01",
    },
    categories: [],
    transactions: [],
    bills: [],
    incomeStreams: [],
    recurringTransactions: [],
    goals: [],
    accounts: [],
    messages: [],
    pinnedWidgets: [],
    typeIcons: { expense: "💸", income: "💵", transfer: "↔️", bill: "📄" },
  };
  return { ...base, ...overrides };
}

describe("computeAffordability", () => {
  it("uses actual balance and does not add future income to affordability", () => {
    const today = todayISO();
    const store = minimalStore({
      transactions: [
        {
          id: "t1",
          dateISO: today,
          desc: "Pay",
          category: "Work",
          amount: 500,
          type: "income",
          icon: "💵",
          postingStatus: "planned",
        },
      ],
    });
    const result = computeAffordability(store);
    assert.equal(result.actualBalance, 1000);
    assert.ok(result.expectedIncomeWeek >= 0);
    assert.equal(result.affordabilityAmount, result.actualBalance);
  });
});
