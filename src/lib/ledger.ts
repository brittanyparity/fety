import type { Account, AccountKind, FetyStore, Goal, ScheduledItemKind, Transaction } from "../types/fety";
import { parseScheduledTransactionId, transactionMatchesScheduleItem } from "./billScheduling";
import { ledgerThroughISO, todayISO } from "./fetyCalculations";
import { scheduledItemKindLabel } from "./scheduledItemCatalog";
import { scheduledItemRefForCategory } from "./transactionCategories";
import { flowForTransactionType, getTransactionTypes } from "./transactionTypes";

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

export function transactionLinksToAccount(t: Transaction): boolean {
  return Boolean(t.fromAccountId || t.toAccountId);
}

/** Profile-style cash flow for transactions not tied to a Net Worth account. */
export function unlinkedGlobalNetThrough(
  store: FetyStore,
  throughISO: string,
  capAtToday = false,
): number {
  const asOf = balanceAsOfISO(store);
  const through = capAtToday ? ledgerThroughISO(throughISO) : throughISO;
  if (through < asOf) return 0;
  return store.transactions
    .filter((t) => t.dateISO >= asOf && t.dateISO <= through && !transactionLinksToAccount(t))
    .reduce((s, t) => s + globalBalanceContribution(t, store), 0);
}

/** End-of-day balance when accounts exist (calendar / projections — may include future dates). */
export function endingBalanceFromAccounts(store: FetyStore, throughISO: string): number {
  return netWorthTotalsProjectedOnDate(store, throughISO).net + unlinkedGlobalNetThrough(store, throughISO, false);
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
    if (t.fromAccountId === accountId) return amt;
    return 0;
  }
  if (t.fromAccountId === accountId) return -amt;
  return 0;
}

export function accountName(store: FetyStore, accountId: string | undefined): string | null {
  if (!accountId) return null;
  return store.accounts.find((a) => a.id === accountId)?.name ?? null;
}

function accountBalanceThrough(
  store: FetyStore,
  accountId: string,
  throughISO: string,
  capAtToday: boolean,
): number {
  const account = store.accounts.find((a) => a.id === accountId);
  if (!account) return 0;
  const asOf = accountBalanceAsOfISO(account, store);
  const end = capAtToday ? ledgerThroughISO(throughISO) : throughISO;
  if (end < asOf) return 0;
  let bal = account.balance;
  const txs = store.transactions
    .filter((t) => t.dateISO >= asOf && t.dateISO <= end)
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO) || a.id.localeCompare(b.id));
  for (const t of txs) bal += accountBalanceDelta(t, accountId, store);
  return bal;
}

/** Real-time account balance (never includes transactions after today). */
export function accountBalanceWithTransactions(store: FetyStore, accountId: string, throughISO?: string): number {
  return accountBalanceThrough(store, accountId, throughISO ?? todayISO(), true);
}

/** Projected account balance through `throughISO`, including future-dated transactions. */
export function accountBalanceProjectedThrough(store: FetyStore, accountId: string, throughISO: string): number {
  return accountBalanceThrough(store, accountId, throughISO, false);
}

export function goalContributionsFromTransactions(
  store: FetyStore,
  goalId: string,
  throughISO?: string,
): number {
  const asOf = balanceAsOfISO(store);
  const end = ledgerThroughISO(throughISO ?? todayISO());
  return store.transactions
    .filter((t) => t.goalId === goalId && t.dateISO >= asOf && t.dateISO <= end)
    .reduce((s, t) => s + transactionAmountMagnitude(t), 0);
}

/** Manual baseline on the goal plus linked transaction contributions. */
export function goalSavedTotal(store: FetyStore, goal: Goal, throughISO?: string): number {
  return goal.saved + goalContributionsFromTransactions(store, goal.id, throughISO);
}

export function transactionTypeDisplayName(store: FetyStore, typeId: string): string {
  const normalized = getTransactionTypes(store).find((tt) => tt.id === typeId);
  return normalized?.name ?? typeId;
}

export function transactionScheduleItemKind(t: Transaction): ScheduledItemKind | null {
  if (t.scheduledItemKind) return t.scheduledItemKind;
  const parsed = parseScheduledTransactionId(t.id);
  return parsed?.kind ?? null;
}

function scheduledItemRefForTransaction(
  t: Transaction,
  store: FetyStore,
): { kind: ScheduledItemKind; sourceId: string } | null {
  const parsed = parseScheduledTransactionId(t.id);
  const kind = t.scheduledItemKind ?? parsed?.kind ?? null;
  const sourceId = t.scheduledItemId ?? parsed?.sourceId ?? null;
  if (kind && sourceId) return { kind, sourceId };

  const fromCategory = scheduledItemRefForCategory(store, t.category ?? "");
  if (fromCategory) return { kind: fromCategory.kind, sourceId: fromCategory.id };

  for (const b of store.bills ?? []) {
    if (transactionMatchesScheduleItem(t, b)) return { kind: "bill", sourceId: b.id };
  }
  for (const s of store.incomeStreams ?? []) {
    if (transactionMatchesScheduleItem(t, s)) return { kind: "income", sourceId: s.id };
  }
  for (const r of store.recurringTransactions ?? []) {
    if (transactionMatchesScheduleItem(t, r)) return { kind: "recur", sourceId: r.id };
  }
  return null;
}

export function scheduledItemNameForTransaction(t: Transaction, store: FetyStore): string | null {
  const ref = scheduledItemRefForTransaction(t, store);
  if (!ref) return null;
  if (ref.kind === "bill") return store.bills?.find((b) => b.id === ref.sourceId)?.name.trim() ?? null;
  if (ref.kind === "income") return store.incomeStreams?.find((s) => s.id === ref.sourceId)?.name.trim() ?? null;
  return store.recurringTransactions?.find((r) => r.id === ref.sourceId)?.name.trim() ?? null;
}

/** Primary list title: linked schedule name, otherwise transaction description. */
export function transactionListPrimaryTitle(t: Transaction, store: FetyStore): string {
  const scheduledName = scheduledItemNameForTransaction(t, store);
  if (scheduledName) return scheduledName;
  const desc = t.desc.trim();
  return desc || "Transaction";
}

/** Budget category or scheduled kind (Bill / Income / Recurring), then transaction type. */
export function formatTransactionCategoryTypeLines(
  t: Transaction,
  store: FetyStore,
): { subtitle: string; category: string; typeLine: string } {
  const typeName = transactionTypeDisplayName(store, t.type);
  const ref = scheduledItemRefForTransaction(t, store);
  const category = ref
    ? scheduledItemKindLabel(ref.kind)
    : (t.category ?? "").trim() || "—";
  const subtitle = `${category} | ${typeName}`;
  return { subtitle, category, typeLine: typeName };
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
  const through = todayISO();
  const rows: AccountActivityRow[] = [];
  for (const t of store.transactions) {
    if (t.dateISO < asOf || t.dateISO > through) continue;
    const delta = accountBalanceDelta(t, accountId, store);
    if (delta === 0) continue;
    rows.push({ transaction: t, delta, direction: delta > 0 ? "in" : "out" });
  }
  return rows.sort((a, b) => b.transaction.dateISO.localeCompare(a.transaction.dateISO)).slice(0, limit);
}

function rollUpNetWorthBalances(
  store: FetyStore,
  throughISO: string,
  projected: boolean,
): { assets: number; debts: number; net: number } {
  let assets = 0;
  let debts = 0;
  for (const a of store.accounts) {
    const bal = projected
      ? accountBalanceProjectedThrough(store, a.id, throughISO)
      : accountBalanceWithTransactions(store, a.id, throughISO);
    if (isDebtAccount(a)) {
      if (bal < 0) debts += Math.abs(bal);
      else if (bal > 0) assets += bal;
    } else {
      assets += bal;
    }
  }
  return { assets, debts, net: assets - debts };
}

/** Real-time net worth from accounts (capped at today). */
export function netWorthTotals(store: FetyStore): { assets: number; debts: number; net: number } {
  return rollUpNetWorthBalances(store, todayISO(), false);
}

/** Real-time net worth through `throughISO` (still capped at today). */
export function netWorthTotalsOnDate(store: FetyStore, throughISO: string): { assets: number; debts: number; net: number } {
  return rollUpNetWorthBalances(store, throughISO, false);
}

/** Projected net worth through `throughISO`, including future-dated transactions. */
export function netWorthTotalsProjectedOnDate(
  store: FetyStore,
  throughISO: string,
): { assets: number; debts: number; net: number } {
  return rollUpNetWorthBalances(store, throughISO, true);
}

export function goalsLinkedToAccount(store: FetyStore, accountId: string): Goal[] {
  return store.goals.filter((g) => g.accountId === accountId);
}
