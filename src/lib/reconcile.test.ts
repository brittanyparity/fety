import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Account, FetyStore } from "../types/fety";
import { accountBalanceWithTransactions, reconcileAccountBalance } from "./ledger";

function storeWithAccount(account: Account): FetyStore {
  return {
    version: 1,
    onboardingCompleted: true,
    profile: {
      displayName: "T",
      email: "t@t.com",
      currency: "USD",
      startingBalance: 0,
      balanceAsOfISO: "2026-01-01",
    },
    categories: [],
    transactions: [],
    bills: [],
    goals: [],
    accounts: [account],
    messages: [],
    pinnedWidgets: [],
    typeIcons: { expense: "💸", income: "💵", transfer: "↔️", bill: "📄" },
  };
}

describe("reconcileAccountBalance", () => {
  it("adjusts opening balance to match verified total", () => {
    const acct: Account = {
      id: "a1",
      name: "Checking",
      type: "Checking",
      balance: 2000,
      icon: "🏦",
      balanceAsOfISO: "2026-01-01",
    };
    const store = storeWithAccount(acct);
    const before = accountBalanceWithTransactions(store, "a1", "2026-06-01");
    assert.equal(before, 2000);
    const { store: next } = reconcileAccountBalance(store, "a1", 2380, "2026-06-01", "recon-1");
    const after = accountBalanceWithTransactions(next, "a1", "2026-06-01");
    assert.equal(after, 2380);
    assert.equal(next.accountReconciliations?.length, 1);
  });
});
