import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyBillScheduleToStore } from "./billScheduling";
import { todayISO } from "./fetyCalculations";
import { createExploreStore } from "./fetyStorage";
import { accountBalanceWithTransactions } from "./ledger";
import {
  applyPostingDefaults,
  markTransactionCompleted,
  transactionCountsInActualLedger,
  defaultPostingStatusForNewTransaction,
} from "./transactionPosting";
import type { FetyStore } from "../types/fety";

function storeWithPlannedExpense(): FetyStore {
  let s = createExploreStore();
  s = applyBillScheduleToStore({
    ...s,
    accounts: [
      {
        id: "cash",
        name: "Checking",
        icon: "🏦",
        kind: "asset",
        balance: 500,
        balanceAsOfISO: "2026-01-01",
      },
    ],
    transactions: [
      {
        id: "tx-planned",
        dateISO: "2026-11-12",
        desc: "Utility",
        category: "Utilities",
        amount: -120,
        type: "expense",
        icon: "⚡",
        fromAccountId: "cash",
        postingStatus: "planned",
      },
    ],
  });
  return s;
}

describe("transactionPosting", () => {
  it("defaults future dated entries to planned", () => {
    assert.equal(defaultPostingStatusForNewTransaction("2099-01-01"), "planned");
    assert.equal(defaultPostingStatusForNewTransaction("2020-01-01"), "completed");
  });

  it("excludes planned manual txs from actual ledger", () => {
    const s = storeWithPlannedExpense();
    const tx = s.transactions.find((t) => t.id === "tx-planned");
    assert.ok(tx);
    assert.equal(transactionCountsInActualLedger(tx!), false);
    assert.equal(accountBalanceWithTransactions(s, "cash"), 500);
  });

  it("includes planned txs after mark completed once", () => {
    let s = storeWithPlannedExpense();
    const tx = s.transactions.find((t) => t.id === "tx-planned")!;
    const completed = markTransactionCompleted(tx, todayISO());
    s = { ...s, transactions: [completed] };
    assert.equal(accountBalanceWithTransactions(s, "cash"), 380);
    const again = markTransactionCompleted(completed, "2026-11-13");
    s = { ...s, transactions: [again] };
    assert.equal(accountBalanceWithTransactions(s, "cash"), 380);
  });

  it("applyPostingDefaults sets completedAtISO when completed", () => {
    const input = applyPostingDefaults({
      desc: "Coffee",
      amount: 5,
      type: "expense",
      category: "Food",
      dateISO: "2020-01-01",
    });
    assert.equal(input.postingStatus, "completed");
    assert.equal(input.completedAtISO, "2020-01-01");
  });
});
