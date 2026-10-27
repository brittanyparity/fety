import type {
  CalDay,
  CalDayItem,
  CalDayItemType,
  CalendarMap,
  FinanceSummary,
  FetyStore,
  Transaction,
} from "../types/fety";
import { isScheduledBillTransaction } from "./billScheduling";
import { flowForTransactionType } from "./transactionTypes";
import {
  endingBalanceFromAccounts,
  globalBalanceContribution,
  goalSavedTotal,
  accountBalanceProjectedThrough,
} from "./ledger";
import { filterBudgetCategories } from "./transactionCategories";

/** Calendar / UI date key in the user's local timezone (YYYY-MM-DD). */
export function dateToISOLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return dateToISOLocal(new Date());
}

/** Last calendar day that may change stored balances (today in local time). */
export function ledgerThroughISO(requestedISO: string): string {
  const today = todayISO();
  return requestedISO > today ? today : requestedISO;
}

export function formatDisplayDate(dateISO: string): string {
  const today = todayISO();
  const d = new Date(dateISO + "T12:00:00");
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yISO = dateToISOLocal(yesterday);
  if (dateISO === today) return "Today";
  if (dateISO === yISO) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Group headers on the Transactions page — always include year so recurring bills do not stack by month/day alone. */
export function formatTransactionGroupDate(dateISO: string): string {
  const today = todayISO();
  const d = new Date(dateISO + "T12:00:00");
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yISO = dateToISOLocal(yesterday);
  if (dateISO === today) return "Today";
  if (dateISO === yISO) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const CONVERSATIONAL_MONTHS = [
  "Jan.",
  "Feb.",
  "Mar.",
  "Apr.",
  "May",
  "June",
  "July",
  "Aug.",
  "Sept.",
  "Oct.",
  "Nov.",
  "Dec.",
];

/** Header date line, e.g. "Today is Oct. 25, 2026". */
export function formatNavDate(d = new Date()): string {
  const month = CONVERSATIONAL_MONTHS[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  return `Today is ${month} ${day}, ${year}`;
}

/** Chat-friendly date, e.g. "Sept. 23, 2026". Uses "today" / "yesterday" when applicable. */
export function formatConversationalDate(dateISO: string): string {
  const iso = dateISO.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return dateISO;
  const today = todayISO();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yISO = dateToISOLocal(yesterday);
  if (iso === today) return "today";
  if (iso === yISO) return "yesterday";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateISO;
  return `${CONVERSATIONAL_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** Replace ISO dates (YYYY-MM-DD) in assistant/chat copy with conversational dates. */
export function conversationalizeDatesInText(text: string): string {
  return text.replace(/\b(\d{4}-\d{2}-\d{2})\b/g, (match) => formatConversationalDate(match));
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfWeek(d: Date): Date {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  return e;
}

function inRange(iso: string, start: Date, end: Date): boolean {
  const t = new Date(iso + "T12:00:00").getTime();
  return t >= start.getTime() && t <= end.getTime();
}

function monthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function monthEnd(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
}

function isOutflow(t: Transaction, store: FetyStore): boolean {
  return t.amount < 0 && flowForTransactionType(store, t.type) !== "transfer";
}

function isInflow(t: Transaction, store: FetyStore): boolean {
  return t.amount > 0 && flowForTransactionType(store, t.type) === "income";
}

const calKey = (d: Date) => dateToISOLocal(d);

function categorySpentInMonth(store: FetyStore, categoryName: string, ref: Date): number {
  const start = monthStart(ref);
  const end = monthEnd(ref);
  const asOf = balanceAsOfISO(store);
  const focusISO = calKey(ref);
  const focusDate = new Date(`${focusISO}T12:00:00`);
  const through = end > focusDate ? focusDate : end;
  return store.transactions
    .filter(
      (t) =>
        t.dateISO >= asOf &&
        t.category === categoryName &&
        isOutflow(t, store) &&
        inRange(t.dateISO, start, through),
    )
    .reduce((s, t) => s + Math.abs(t.amount), 0);
}

export function balanceAsOfISO(store: FetyStore): string {
  return store.profile.balanceAsOfISO ?? "1970-01-01";
}

function dayBeforeISO(dateISO: string): string {
  const d = new Date(`${dateISO}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return dateToISOLocal(d);
}

function usesAccountLedger(store: FetyStore): boolean {
  return (store.accounts?.length ?? 0) > 0;
}

/** Cash position after all transactions on `dateISO` (through that day, inclusive), including future projections. */
export function endingBalanceOnDate(store: FetyStore, dateISO: string): number {
  if (usesAccountLedger(store)) {
    return endingBalanceFromAccounts(store, dateISO);
  }
  const asOf = balanceAsOfISO(store);
  let balance = store.profile.startingBalance;
  const txs = store.transactions
    .filter((t) => t.dateISO >= asOf && t.dateISO <= dateISO)
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO) || a.id.localeCompare(b.id));
  for (const t of txs) balance += globalBalanceContribution(t, store);
  return balance;
}

export function computeSummary(store: FetyStore, ref = new Date()): FinanceSummary {
  const focusISO = calKey(ref);
  const wStart = startOfWeek(ref);
  const wEnd = endOfWeek(ref);
  const mStart = monthStart(ref);
  const mEnd = monthEnd(ref);
  const asOf = balanceAsOfISO(store);
  const balance = endingBalanceOnDate(store, focusISO);
  const balanceTx = store.transactions.filter((t) => t.dateISO >= asOf && t.dateISO <= focusISO);

  const moneyInToday = balanceTx
    .filter((t) => t.dateISO === focusISO && isInflow(t, store))
    .reduce((s, t) => s + t.amount, 0);

  const moneyOutToday = balanceTx
    .filter((t) => t.dateISO === focusISO && isOutflow(t, store))
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  const weeklySpent = balanceTx
    .filter((t) => isOutflow(t, store) && inRange(t.dateISO, wStart, wEnd))
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  const monthlyIncome = balanceTx
    .filter((t) => isInflow(t, store) && inRange(t.dateISO, mStart, mEnd))
    .reduce((s, t) => s + t.amount, 0);

  const monthlyExpenses = balanceTx
    .filter((t) => isOutflow(t, store) && inRange(t.dateISO, mStart, mEnd))
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  const monthlyBudgetTotal = filterBudgetCategories(store.categories).reduce((s, c) => s + c.monthlyBudget, 0);
  const weeklyBudget = Math.round(monthlyBudgetTotal / 4.33);
  const weeklySpendingPower = Math.max(0, weeklyBudget - weeklySpent);
  const weeklyUsedPct = weeklyBudget > 0 ? Math.min(100, Math.round((weeklySpent / weeklyBudget) * 100)) : 0;

  const savingsTotal = store.goals.reduce((s, g) => s + goalSavedTotal(store, g), 0);

  const categoriesWithSpent = filterBudgetCategories(store.categories).map((c) => ({
    ...c,
    spent: categorySpentInMonth(store, c.name, ref),
  }));

  return {
    balance,
    balanceThroughToday: endingBalanceOnDate(store, focusISO),
    moneyInToday,
    moneyOutToday,
    savingsTotal,
    weeklyBudget,
    weeklySpent,
    weeklySpendingPower,
    weeklyUsedPct,
    monthlyIncome,
    monthlyExpenses,
    categoriesWithSpent,
  };
}

function itemTypeForTransaction(t: Transaction, store: FetyStore): CalDayItemType {
  if (isScheduledBillTransaction(t.id)) return "bill";
  const flow = flowForTransactionType(store, t.type);
  if (flow === "income") return t.amount >= 500 ? "paycheck" : "income";
  if (flow === "bill") return "bill";
  return "expense";
}

/** Day-by-day balances for a calendar year from stored transactions. */
export function buildCalendarMap(store: FetyStore, year: number): CalendarMap {
  const map: CalendarMap = new Map();
  const yearPrefix = String(year);
  const asOf = balanceAsOfISO(store);
  const accountLedger = usesAccountLedger(store);

  let balance = store.profile.startingBalance;
  if (!accountLedger) {
    const sorted = [...store.transactions]
      .filter((t) => t.dateISO >= asOf)
      .sort((a, b) => a.dateISO.localeCompare(b.dateISO));
    for (const t of sorted) {
      if (t.dateISO < `${yearPrefix}-01-01`) balance += globalBalanceContribution(t, store);
    }
  }

  const byDate = new Map<string, Transaction[]>();
  for (const t of store.transactions) {
    if (!t.dateISO.startsWith(yearPrefix)) continue;
    if (t.dateISO < asOf) continue;
    const list = byDate.get(t.dateISO) ?? [];
    list.push(t);
    byDate.set(t.dateISO, list);
  }

  for (let month = 0; month < 12; month++) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const key = calKey(date);
      const txns = byDate.get(key) ?? [];
      const items: CalDayItem[] = txns.map((t) => ({
        id: t.id,
        icon: t.icon,
        desc: t.desc,
        amount: t.amount,
        type: itemTypeForTransaction(t, store),
        category: t.category,
        txnType: t.type,
      }));
      const income = txns
        .filter((t) => globalBalanceContribution(t, store) > 0)
        .reduce((s, t) => s + globalBalanceContribution(t, store), 0);
      const expenses = txns
        .filter((t) => globalBalanceContribution(t, store) < 0)
        .reduce((s, t) => s + globalBalanceContribution(t, store), 0);

      if (accountLedger) {
        const endBal = endingBalanceOnDate(store, key);
        const startBal = key < asOf ? endBal : endingBalanceOnDate(store, dayBeforeISO(key));
        map.set(key, { date, startBal, endBal, income, expenses, items });
        continue;
      }

      if (key < asOf) {
        map.set(key, {
          date,
          startBal: store.profile.startingBalance,
          endBal: store.profile.startingBalance,
          income: 0,
          expenses: 0,
          items: [],
        });
        continue;
      }

      const startBal = balance;
      const endBal = startBal + income + expenses;
      balance = endBal;
      map.set(key, { date, startBal, endBal, income, expenses, items });
    }
  }

  return map;
}

/** Merge day maps for multiple calendar years (e.g. week spanning Dec–Jan). */
export function mergeCalendarMaps(store: FetyStore, years: number[]): CalendarMap {
  const merged: CalendarMap = new Map();
  for (const year of years) {
    for (const [key, day] of buildCalendarMap(store, year)) merged.set(key, day);
  }
  return merged;
}

/** Background tint for yearly tiles from daily net cash flow. */
export function calendarFlowHeat(net: number, maxAbsNet: number): string {
  if (maxAbsNet <= 0 || net === 0) return "var(--surface)";
  const t = Math.min(1, Math.abs(net) / maxAbsNet);
  if (net > 0) {
    const a = 0.18 + t * 0.62;
    return `rgba(145, 216, 182, ${a.toFixed(2)})`;
  }
  const a = 0.14 + t * 0.58;
  return `rgba(255, 111, 94, ${a.toFixed(2)})`;
}

export function maxAbsDailyNet(map: CalendarMap, year: number): number {
  let max = 0;
  for (const [, day] of map) {
    if (day.date.getFullYear() !== year) continue;
    max = Math.max(max, Math.abs(day.endBal - day.startBal));
  }
  return max || 1;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type BalanceChartRange = "7d" | "14d" | "30d" | "month";
export type SpendTrendMonths = 3 | 6 | 12;
export type CategorySpendPeriod = "week" | "month" | "30d" | "90d";

function daysInBalanceRange(range: BalanceChartRange, ref: Date): number {
  if (range === "7d") return 7;
  if (range === "14d") return 14;
  if (range === "30d") return 30;
  const start = monthStart(ref);
  const end = new Date(ref);
  end.setHours(0, 0, 0, 0);
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);
}

function labelForBalancePoint(d: Date, range: BalanceChartRange): string {
  if (range === "7d") return DAY_LABELS[d.getDay()];
  if (range === "month") return String(d.getDate());
  if (range === "14d") return `${d.getMonth() + 1}/${d.getDate()}`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** 30D axis: day number always; month abbreviation only on the first in-range day of each month. */
function labelForBalancePoint30d(d: Date, firstDayOfMonthOnChart: boolean): string {
  const dayNum = String(d.getDate());
  if (!firstDayOfMonthOnChart) return dayNum;
  return `${d.getMonth() + 1}/${dayNum}`;
}

export type BalanceChartPoint = {
  /** X-axis tick label (may be abbreviated on 30D). */
  d: string;
  bal: number;
  /** Full calendar date for chart tooltips. */
  dateLabel: string;
};

function formatBalanceChartTooltipDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Daily ending balances for a selectable lookback (or calendar month to date). */
export function endingBalancesForRange(
  store: FetyStore,
  range: BalanceChartRange,
  ref = new Date(),
  accountId?: string | null,
): BalanceChartPoint[] {
  const count = daysInBalanceRange(range, ref);
  const out: BalanceChartPoint[] = [];
  const monthsSeenOnChart = new Set<string>();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(ref);
    d.setHours(12, 0, 0, 0);
    d.setDate(ref.getDate() - i);
    const key = calKey(d);
    const bal = accountId
      ? accountBalanceProjectedThrough(store, accountId, key)
      : endingBalanceOnDate(store, key);
    let label: string;
    if (range === "30d") {
      const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
      const firstDayOfMonthOnChart = !monthsSeenOnChart.has(monthKey);
      if (firstDayOfMonthOnChart) monthsSeenOnChart.add(monthKey);
      label = labelForBalancePoint30d(d, firstDayOfMonthOnChart);
    } else {
      label = labelForBalancePoint(d, range);
    }
    out.push({ d: label, bal, dateLabel: formatBalanceChartTooltipDate(d) });
  }
  return out;
}

export function last7DayEndingBalances(store: FetyStore, ref = new Date()): { d: string; bal: number }[] {
  return endingBalancesForRange(store, "7d", ref);
}

/** Monthly outflow totals for the last N calendar months (inclusive of current). */
export function monthsSpending(
  store: FetyStore,
  monthCount: SpendTrendMonths,
  ref = new Date(),
): { m: string; v: number }[] {
  const out: { m: string; v: number }[] = [];
  const n = Math.max(1, monthCount);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    const start = monthStart(d);
    const end = monthEnd(d);
    const v = store.transactions
      .filter((t) => isOutflow(t, store) && inRange(t.dateISO, start, end))
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    out.push({ m: d.toLocaleDateString("en-US", { month: "short" }), v });
  }
  return out;
}

export function last6MonthsSpending(store: FetyStore, ref = new Date()): { m: string; v: number }[] {
  return monthsSpending(store, 6, ref);
}

function categoryPeriodBounds(period: CategorySpendPeriod, ref: Date): { start: Date; end: Date } {
  const end = new Date(ref);
  end.setHours(23, 59, 59, 999);
  if (period === "week") {
    return { start: startOfWeek(ref), end: endOfWeek(ref) };
  }
  if (period === "month") {
    return { start: monthStart(ref), end: monthEnd(ref) };
  }
  const start = new Date(ref);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (period === "30d" ? 29 : 89));
  return { start, end };
}

function categorySpentInRange(
  store: FetyStore,
  categoryName: string,
  start: Date,
  end: Date,
): number {
  const asOf = balanceAsOfISO(store);
  return store.transactions
    .filter(
      (t) =>
        t.dateISO >= asOf &&
        t.category === categoryName &&
        isOutflow(t, store) &&
        inRange(t.dateISO, start, end),
    )
    .reduce((s, t) => s + Math.abs(t.amount), 0);
}

export function categorySpendSharesForPeriod(
  store: FetyStore,
  period: CategorySpendPeriod,
  ref = new Date(),
): { name: string; value: number }[] {
  const { start, end } = categoryPeriodBounds(period, ref);
  const cats = filterBudgetCategories(store.categories).map((c) => ({
    name: c.name,
    value: categorySpentInRange(store, c.name, start, end),
  }));
  const total = cats.reduce((s, c) => s + c.value, 0) || 1;
  return cats
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .map((c) => ({ name: c.name, value: Math.round((c.value / total) * 100) }));
}

export function categorySpendShares(store: FetyStore, ref = new Date()): { name: string; value: number }[] {
  return categorySpendSharesForPeriod(store, "month", ref);
}
