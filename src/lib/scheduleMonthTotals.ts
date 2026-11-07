import type { Bill, IncomeStream, RecurringScheduleBase, RecurringTransaction } from "../types/fety";
import { incomeOccurrencesInRange, occurrencesInRange } from "./billScheduling";
import { dateToISOLocal } from "./fetyCalculations";
import { roundMoney } from "./scheduleAmounts";

/** First and last calendar day of the month containing `ref` (local time). */
export function calendarMonthBounds(ref: Date): { start: Date; end: Date } {
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1, 12, 0, 0, 0);
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 12, 0, 0, 0);
  return { start, end };
}

export function scheduledAmountInCalendarMonth(
  item: Pick<RecurringScheduleBase, "amount" | "dueDay" | "frequency">,
  ref: Date,
): number {
  const { start, end } = calendarMonthBounds(ref);
  const dates = occurrencesInRange(item, start, end);
  return roundMoney(dates.length * Math.abs(item.amount));
}

export function incomeScheduledAmountInCalendarMonth(stream: IncomeStream, ref: Date): number {
  const { start, end } = calendarMonthBounds(ref);
  const dates = incomeOccurrencesInRange(stream, start, end);
  return roundMoney(dates.length * Math.abs(stream.amount));
}

export function billsScheduledTotalInMonth(bills: Bill[], ref: Date): number {
  return roundMoney(bills.reduce((s, b) => s + scheduledAmountInCalendarMonth(b, ref), 0));
}

export function incomeScheduledTotalInMonth(streams: IncomeStream[], ref: Date): number {
  return roundMoney(streams.reduce((s, st) => s + incomeScheduledAmountInCalendarMonth(st, ref), 0));
}

export function recurringScheduledTotalInMonth(items: RecurringTransaction[], ref: Date): number {
  return roundMoney(items.reduce((s, r) => s + scheduledAmountInCalendarMonth(r, ref), 0));
}

/** ISO bounds for the Monday–Sunday week containing `ref` (matches computeSummary). */
export function weekRangeISO(ref: Date): { startISO: string; endISO: string } {
  const x = new Date(ref);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(12, 0, 0, 0);
  const startISO = dateToISOLocal(x);
  const end = new Date(x);
  end.setDate(end.getDate() + 6);
  return { startISO, endISO: dateToISOLocal(end) };
}

export function isoInInclusiveRange(iso: string, startISO: string, endISO: string): boolean {
  return iso >= startISO && iso <= endISO;
}
