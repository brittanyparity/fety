import type { FetyStore } from "../types/fety";
import { balanceAsOfISO, computeSummary, todayISO } from "./fetyCalculations";
import { globalBalanceContribution, netWorthTotals } from "./ledger";
import {
  filterTransactionsForLedger,
  transactionCountsInActualLedger,
  transactionLedgerDateISO,
} from "./transactionPosting";
import { flowForTransactionType } from "./transactionTypes";
import { isoInInclusiveRange, weekRangeISO } from "./scheduleMonthTotals";
import { roundMoney } from "./scheduleAmounts";

export type AffordabilityBreakdown = {
  weekStartISO: string;
  weekEndISO: string;
  /** Cash position through today (actual ledger). */
  actualBalance: number;
  /** Completed outflows this week. */
  completedExpensesWeek: number;
  /** Completed inflows this week (informational — not added to spending room). */
  completedIncomeWeek: number;
  /** Scheduled / planned outflows still due this week (today through week end). */
  remainingScheduledOutWeek: number;
  /** Scheduled income still expected this week (informational). */
  expectedIncomeWeek: number;
  /** Aggregate category budget minus spent this month. */
  budgetHeadroomMonth: number;
  /** Spendable room: actual balance minus remaining week obligations (floored at 0). */
  affordabilityAmount: number;
};

function isOutflow(store: FetyStore, t: import("../types/fety").Transaction): boolean {
  const flow = flowForTransactionType(store, t.type);
  return flow === "expense" || flow === "bill";
}

function isInflow(store: FetyStore, t: import("../types/fety").Transaction): boolean {
  return flowForTransactionType(store, t.type) === "income";
}

export function actualCashBalance(store: FetyStore): number {
  if ((store.accounts?.length ?? 0) > 0) {
    return netWorthTotals(store).net;
  }
  const asOf = balanceAsOfISO(store);
  const today = todayISO();
  let balance = store.profile.startingBalance;
  for (const t of filterTransactionsForLedger(store.transactions, today, "actual")) {
    if (transactionLedgerDateISO(t) < asOf) continue;
    balance += globalBalanceContribution(t, store);
  }
  return balance;
}

export function computeAffordability(store: FetyStore, ref = new Date()): AffordabilityBreakdown {
  const today = todayISO();
  const { startISO, endISO } = weekRangeISO(ref);
  const actualBalance = actualCashBalance(store);

  const actualTx = filterTransactionsForLedger(store.transactions, endISO, "actual");
  const projectedTx = filterTransactionsForLedger(store.transactions, endISO, "projected");

  let completedExpensesWeek = 0;
  let completedIncomeWeek = 0;
  for (const t of actualTx) {
    const ledgerISO = transactionLedgerDateISO(t);
    if (!isoInInclusiveRange(ledgerISO, startISO, endISO)) continue;
    if (isOutflow(store, t)) completedExpensesWeek += Math.abs(t.amount);
    else if (isInflow(store, t)) completedIncomeWeek += Math.abs(t.amount);
  }

  let remainingScheduledOutWeek = 0;
  let expectedIncomeWeek = 0;
  for (const t of projectedTx) {
    const ledgerISO = transactionLedgerDateISO(t);
    if (!isoInInclusiveRange(ledgerISO, startISO, endISO)) continue;
    if (ledgerISO < today) continue;
    if (isOutflow(store, t)) {
      if (!transactionCountsInActualLedger(t)) {
        remainingScheduledOutWeek += Math.abs(t.amount);
      }
    } else if (isInflow(store, t) && !transactionCountsInActualLedger(t)) {
      expectedIncomeWeek += Math.abs(t.amount);
    }
  }

  const summary = computeSummary(store, ref);
  const budgetHeadroomMonth = Math.max(
    0,
    summary.categoriesWithSpent.reduce((s, c) => s + Math.max(0, c.monthlyBudget - c.spent), 0),
  );

  const obligations = Math.max(0, remainingScheduledOutWeek);
  let room = actualBalance - obligations;
  if (budgetHeadroomMonth > 0) {
    room = Math.min(room, Math.max(0, actualBalance + budgetHeadroomMonth - completedExpensesWeek));
  }
  const affordabilityAmount = roundMoney(Math.max(0, room));

  return {
    weekStartISO: startISO,
    weekEndISO: endISO,
    actualBalance: roundMoney(actualBalance),
    completedExpensesWeek: roundMoney(completedExpensesWeek),
    completedIncomeWeek: roundMoney(completedIncomeWeek),
    remainingScheduledOutWeek: roundMoney(remainingScheduledOutWeek),
    expectedIncomeWeek: roundMoney(expectedIncomeWeek),
    budgetHeadroomMonth: roundMoney(budgetHeadroomMonth),
    affordabilityAmount,
  };
}
