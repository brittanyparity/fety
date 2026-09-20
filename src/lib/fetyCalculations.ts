import type {
  CalDay,
  CalDayItem,
  CalDayItemType,
  CalendarMap,
  FinanceSummary,
  FetyStore,
  Transaction,
} from "../types/fety";
import { flowForTransactionType } from "./transactionTypes";
import { globalBalanceContribution, goalSavedTotal } from "./ledger";

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDisplayDate(dateISO: string): string {
  const today = todayISO();
  const d = new Date(dateISO + "T12:00:00");
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yISO = yesterday.toISOString().slice(0, 10);
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
  const yISO = yesterday.toISOString().slice(0, 10);
  if (dateISO === today) return "Today";
  if (dateISO === yISO) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatNavDate(d = new Date()): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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

/** Chat-friendly date, e.g. "Sept. 23, 2026". Uses "today" / "yesterday" when applicable. */
export function formatConversationalDate(dateISO: string): string {
  const iso = dateISO.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return dateISO;
  const today = todayISO();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yISO = yesterday.toISOString().slice(0, 10);
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

function categorySpentInMonth(store: FetyStore, categoryName: string, ref: Date): number {
  const start = monthStart(ref);
  const end = monthEnd(ref);
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

export function balanceAsOfISO(store: FetyStore): string {
  return store.profile.balanceAsOfISO ?? "1970-01-01";
}

/** Cash position after all transactions on `dateISO` (through that day, inclusive). */
export function endingBalanceOnDate(store: FetyStore, dateISO: string): number {
  const asOf = balanceAsOfISO(store);
  let balance = store.profile.startingBalance;
  const txs = store.transactions
    .filter((t) => t.dateISO >= asOf && t.dateISO <= dateISO)
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO) || a.id.localeCompare(b.id));
  for (const t of txs) balance += globalBalanceContribution(t, store);
  return balance;
}

export function computeSummary(store: FetyStore, ref = new Date()): FinanceSummary {
  const today = todayISO();
  const wStart = startOfWeek(ref);
  const wEnd = endOfWeek(ref);
  const mStart = monthStart(ref);
  const mEnd = monthEnd(ref);
  const asOf = balanceAsOfISO(store);
  const balanceTx = store.transactions.filter((t) => t.dateISO >= asOf);

  const txSum = balanceTx.reduce((s, t) => s + globalBalanceContribution(t, store), 0);
  const balance = store.profile.startingBalance + txSum;

  const moneyInToday = balanceTx
    .filter((t) => t.dateISO === today && isInflow(t, store))
    .reduce((s, t) => s + t.amount, 0);

  const moneyOutToday = balanceTx
    .filter((t) => t.dateISO === today && isOutflow(t, store))
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

  const monthlyBudgetTotal = store.categories.reduce((s, c) => s + c.monthlyBudget, 0);
  const weeklyBudget = Math.round(monthlyBudgetTotal / 4.33);
  const weeklySpendingPower = Math.max(0, weeklyBudget - weeklySpent);
  const weeklyUsedPct = weeklyBudget > 0 ? Math.min(100, Math.round((weeklySpent / weeklyBudget) * 100)) : 0;

  const savingsTotal = store.goals.reduce((s, g) => s + goalSavedTotal(store, g), 0);

  const categoriesWithSpent = store.categories.map((c) => ({
    ...c,
    spent: categorySpentInMonth(store, c.name, ref),
  }));

  return {
    balance,
    balanceThroughToday: endingBalanceOnDate(store, today),
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

const calKey = (d: Date) => d.toISOString().slice(0, 10);

function itemTypeForTransaction(t: Transaction, store: FetyStore): CalDayItemType {
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

  let balance = store.profile.startingBalance;
  const sorted = [...store.transactions]
    .filter((t) => t.dateISO >= asOf)
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO));
  for (const t of sorted) {
    if (t.dateISO < `${yearPrefix}-01-01`) balance += globalBalanceContribution(t, store);
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
      const startBal = balance;
      const endBal = startBal + income + expenses;
      balance = endBal;
      map.set(key, { date, startBal, endBal, income, expenses, items });
    }
  }

  return map;
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

export function last7DayEndingBalances(store: FetyStore, ref = new Date()): { d: string; bal: number }[] {
  const year = ref.getFullYear();
  const map = buildCalendarMap(store, year);
  const out: { d: string; bal: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(ref);
    d.setDate(ref.getDate() - i);
    const key = calKey(d);
    const day = map.get(key);
    out.push({ d: DAY_LABELS[d.getDay()], bal: day?.endBal ?? store.profile.startingBalance });
  }
  return out;
}

export function last6MonthsSpending(store: FetyStore, ref = new Date()): { m: string; v: number }[] {
  const out: { m: string; v: number }[] = [];
  for (let i = 5; i >= 0; i--) {
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

export function categorySpendShares(store: FetyStore, ref = new Date()): { name: string; value: number }[] {
  const cats = store.categories.map((c) => ({
    name: c.name,
    value: categorySpentInMonth(store, c.name, ref),
  }));
  const total = cats.reduce((s, c) => s + c.value, 0) || 1;
  return cats
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .map((c) => ({ name: c.name, value: Math.round((c.value / total) * 100) }));
}
