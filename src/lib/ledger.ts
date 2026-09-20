import type { FetyStore, Goal, Transaction } from "../types/fety";
import { flowForTransactionType } from "./transactionTypes";

function balanceAsOfISO(store: FetyStore): string {
  return store.profile.balanceAsOfISO ?? "1970-01-01";
}

export function transactionAmountMagnitude(t: Transaction): number {
  return Math.abs(t.amount);
}

/** Effect on net worth (profile starting balance rollup). Transfers are neutral. */
export function globalBalanceContribution(t: Transaction, store: FetyStore): number {
  const flow = flowForTransactionType(store, t.type);
  if (flow === "transfer") return 0;
  return t.amount;
}

/** Change to a single account from one transaction (0 if not linked to that account). */
export function accountBalanceDelta(t: Transaction, accountId: string, store: FetyStore): number {
  const amt = transactionAmountMagnitude(t);
  const flow = flowForTransactionType(store, t.type);

  if (flow === "transfer") {
    if (t.fromAccountId === accountId) return -amt;
    if (t.toAccountId === accountId) return amt;
    return 0;
  }
  if (flow === "income") {
    if (t.toAccountId === accountId) return amt;
    return 0;
  }
  if (t.fromAccountId === accountId) return -amt;
  return 0;
}

export function accountName(store: FetyStore, accountId: string | undefined): string | null {
  if (!accountId) return null;
  return store.accounts.find((a) => a.id === accountId)?.name ?? null;
}

export function accountBalanceWithTransactions(store: FetyStore, accountId: string, throughISO?: string): number {
  const account = store.accounts.find((a) => a.id === accountId);
  if (!account) return 0;
  const asOf = balanceAsOfISO(store);
  const end = throughISO ?? new Date().toISOString().slice(0, 10);
  let bal = account.balance;
  const txs = store.transactions
    .filter((t) => t.dateISO >= asOf && t.dateISO <= end)
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO) || a.id.localeCompare(b.id));
  for (const t of txs) bal += accountBalanceDelta(t, accountId, store);
  return bal;
}

export function goalContributionsFromTransactions(
  store: FetyStore,
  goalId: string,
  throughISO?: string,
): number {
  const asOf = balanceAsOfISO(store);
  const end = throughISO ?? new Date().toISOString().slice(0, 10);
  return store.transactions
    .filter((t) => t.goalId === goalId && t.dateISO >= asOf && t.dateISO <= end)
    .reduce((s, t) => s + transactionAmountMagnitude(t), 0);
}

/** Manual baseline on the goal plus linked transaction contributions. */
export function goalSavedTotal(store: FetyStore, goal: Goal, throughISO?: string): number {
  return goal.saved + goalContributionsFromTransactions(store, goal.id, throughISO);
}

export function formatTransactionDetailLine(t: Transaction, store: FetyStore): string | null {
  const flow = flowForTransactionType(store, t.type);
  const parts: string[] = [];
  if (flow === "transfer" && (t.fromAccountId || t.toAccountId)) {
    const from = accountName(store, t.fromAccountId) ?? "—";
    const to = accountName(store, t.toAccountId) ?? "—";
    parts.push(`${from} → ${to}`);
  } else if (t.fromAccountId || t.toAccountId) {
    const from = accountName(store, t.fromAccountId);
    const to = accountName(store, t.toAccountId);
    if (from) parts.push(`From ${from}`);
    if (to) parts.push(`To ${to}`);
  }
  if (t.goalId) {
    const goal = store.goals.find((g) => g.id === t.goalId);
    if (goal) parts.push(`Goal: ${goal.name}`);
  }
  return parts.length ? parts.join(" · ") : null;
}
