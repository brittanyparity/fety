import type { Account, AccountKind, FetyStore, Goal, Transaction } from "../types/fety";
import { todayISO } from "./fetyCalculations";
import { flowForTransactionType } from "./transactionTypes";

function balanceAsOfISO(store: FetyStore): string {
  return store.profile.balanceAsOfISO ?? "1970-01-01";
}

/** Date from which this account's opening balance and linked transactions apply. */
export function accountBalanceAsOfISO(account: Account, store: FetyStore): string {
  return account.balanceAsOfISO ?? store.profile.balanceAsOfISO ?? "1970-01-01";
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
  const asOf = accountBalanceAsOfISO(account, store);
  const end = throughISO ?? new Date().toISOString().slice(0, 10);
  if (end < asOf) return 0;
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

const DEBT_TYPE_HINTS = /credit|debt|loan|card/i;

export function accountKind(account: Account): AccountKind {
  if (account.kind === "debt" || account.kind === "asset") return account.kind;
  if (DEBT_TYPE_HINTS.test(account.type) || account.balance < 0) return "debt";
  return "asset";
}

export function isDebtAccount(account: Account): boolean {
  return accountKind(account) === "debt";
}

/** Opening balance for storage: debt accounts stay negative (amount owed). */
export function normalizeAccountOpeningBalance(kind: AccountKind, raw: number): number {
  if (kind === "debt") return -Math.abs(raw);
  return raw;
}

/** Ensure debt/asset kind, signed opening balance, and as-of date are set for ledger math. */
export function normalizeAccountRecord(account: Account, store: FetyStore): Account {
  const kind = accountKind(account);
  const magnitude = kind === "debt" ? Math.abs(account.balance) : account.balance;
  return {
    ...account,
    kind,
    balance: normalizeAccountOpeningBalance(kind, magnitude),
    balanceAsOfISO: account.balanceAsOfISO ?? store.profile.balanceAsOfISO ?? todayISO(),
  };
}

export function formatAccountBalanceDisplay(account: Account, balance: number): string {
  if (isDebtAccount(account)) {
    const owed = Math.abs(balance);
    return owed === 0 ? "$0 owed" : `${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(owed)} owed`;
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(balance);
}

export type AccountActivityRow = {
  transaction: Transaction;
  delta: number;
  direction: "in" | "out";
};

export function accountActivityForAccount(store: FetyStore, accountId: string, limit = 40): AccountActivityRow[] {
  const account = store.accounts.find((a) => a.id === accountId);
  const asOf = account ? accountBalanceAsOfISO(account, store) : balanceAsOfISO(store);
  const rows: AccountActivityRow[] = [];
  for (const t of store.transactions) {
    if (t.dateISO < asOf) continue;
    const delta = accountBalanceDelta(t, accountId, store);
    if (delta === 0) continue;
    rows.push({ transaction: t, delta, direction: delta > 0 ? "in" : "out" });
  }
  return rows.sort((a, b) => b.transaction.dateISO.localeCompare(a.transaction.dateISO)).slice(0, limit);
}

export function netWorthTotals(store: FetyStore): { assets: number; debts: number; net: number } {
  let assets = 0;
  let debts = 0;
  for (const a of store.accounts) {
    const bal = accountBalanceWithTransactions(store, a.id);
    if (isDebtAccount(a)) {
      if (bal < 0) debts += Math.abs(bal);
      else if (bal > 0) assets += bal;
    } else {
      assets += bal;
    }
  }
  return { assets, debts, net: assets - debts };
}

/** Net worth from accounts through `throughISO` (inclusive), aligned with calendar day ending. */
export function netWorthTotalsOnDate(store: FetyStore, throughISO: string): { assets: number; debts: number; net: number } {
  let assets = 0;
  let debts = 0;
  for (const a of store.accounts) {
    const bal = accountBalanceWithTransactions(store, a.id, throughISO);
    if (isDebtAccount(a)) {
      if (bal < 0) debts += Math.abs(bal);
      else if (bal > 0) assets += bal;
    } else {
      assets += bal;
    }
  }
  return { assets, debts, net: assets - debts };
}

export function goalsLinkedToAccount(store: FetyStore, accountId: string): Goal[] {
  return store.goals.filter((g) => g.accountId === accountId);
}
