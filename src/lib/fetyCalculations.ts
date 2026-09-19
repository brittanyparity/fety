import type {
  CalDay,
  CalDayItem,
  CalDayItemType,
  CalendarMap,
  FinanceSummary,
  FetyStore,
  Transaction,
} from "../types/fety";

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

export function formatNavDate(d = new Date()): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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

function isOutflow(t: Transaction): boolean {
  return t.amount < 0 && t.type !== "transfer";
}

function isInflow(t: Transaction): boolean {
  return t.amount > 0 && t.type === "income";
}

function categorySpentInMonth(store: FetyStore, categoryName: string, ref: Date): number {
  const start = monthStart(ref);
  const end = monthEnd(ref);
  return store.transactions
    .filter(
      (t) =>
        t.category === categoryName &&
        isOutflow(t) &&
        inRange(t.dateISO, start, end),
    )
    .reduce((s, t) => s + Math.abs(t.amount), 0);
}

export function computeSummary(store: FetyStore, ref = new Date()): FinanceSummary {
  const today = todayISO();
  const wStart = startOfWeek(ref);
  const wEnd = endOfWeek(ref);
  const mStart = monthStart(ref);
  const mEnd = monthEnd(ref);

  const txSum = store.transactions.reduce((s, t) => s + t.amount, 0);
  const balance = store.profile.startingBalance + txSum;

  const moneyInToday = store.transactions
    .filter((t) => t.dateISO === today && isInflow(t))
    .reduce((s, t) => s + t.amount, 0);

  const moneyOutToday = store.transactions
    .filter((t) => t.dateISO === today && isOutflow(t))
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  const weeklySpent = store.transactions
    .filter((t) => isOutflow(t) && inRange(t.dateISO, wStart, wEnd))
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  const monthlyIncome = store.transactions
    .filter((t) => isInflow(t) && inRange(t.dateISO, mStart, mEnd))
    .reduce((s, t) => s + t.amount, 0);

  const monthlyExpenses = store.transactions
    .filter((t) => isOutflow(t) && inRange(t.dateISO, mStart, mEnd))
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  const monthlyBudgetTotal = store.categories.reduce((s, c) => s + c.monthlyBudget, 0);
  const weeklyBudget = Math.round(monthlyBudgetTotal / 4.33);
  const weeklySpendingPower = Math.max(0, weeklyBudget - weeklySpent);
  const weeklyUsedPct = weeklyBudget > 0 ? Math.min(100, Math.round((weeklySpent / weeklyBudget) * 100)) : 0;

  const savingsTotal = store.goals.reduce((s, g) => s + g.saved, 0);

  const categoriesWithSpent = store.categories.map((c) => ({
    ...c,
    spent: categorySpentInMonth(store, c.name, ref),
  }));

  return {
    balance,
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

function itemTypeForTransaction(t: Transaction): CalDayItemType {
  if (t.type === "income") return t.amount >= 500 ? "paycheck" : "income";
  if (t.type === "bill") return "bill";
  return "expense";
}

/** Day-by-day balances for a calendar year from stored transactions. */
export function buildCalendarMap(store: FetyStore, year: number): CalendarMap {
  const map: CalendarMap = new Map();
  const yearPrefix = String(year);

  let balance = store.profile.startingBalance;
  const sorted = [...store.transactions].sort((a, b) => a.dateISO.localeCompare(b.dateISO));
  for (const t of sorted) {
    if (t.dateISO < `${yearPrefix}-01-01`) balance += t.amount;
  }

  const byDate = new Map<string, Transaction[]>();
  for (const t of store.transactions) {
    if (!t.dateISO.startsWith(yearPrefix)) continue;
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
        type: itemTypeForTransaction(t),
        category: t.category,
        txnType: t.type,
      }));
      const income = txns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
      const expenses = txns.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);
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
