import type { BillFrequency, IncomeFrequency } from "../types/fety";

/** UI-only everyday cadence; stored as weekly or monthly on the recurring item. */
export type EverydayFrequency = BillFrequency | "weekday";

/** Convert a scheduled amount into an approximate monthly total. */
export function monthlyFromFrequency(
  amount: number,
  frequency: IncomeFrequency | EverydayFrequency,
): number {
  if (!Number.isFinite(amount) || amount === 0) return 0;
  switch (frequency) {
    case "weekly":
      return (amount * 52) / 12;
    case "biweekly":
      return (amount * 26) / 12;
    case "quarterly":
      return amount / 3;
    case "semimonthly":
      return amount * 2;
    case "weekday":
      return (amount * 5 * 52) / 12;
    case "monthly":
    default:
      return amount;
  }
}

export function formatUsd(amount: number, digits = 0): string {
  const formatted = Math.abs(amount).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
  return amount < 0 ? `−${formatted}` : formatted;
}

/** Map a weekday-style everyday draft onto a stored bill frequency + amount. */
export function everydayToStoredSchedule(
  amount: number,
  frequency: EverydayFrequency,
): { amount: number; frequency: BillFrequency } {
  if (frequency === "weekday") {
    return { amount: amount * 5, frequency: "weekly" };
  }
  if (frequency === "semimonthly") {
    return { amount, frequency: "monthly" };
  }
  return { amount, frequency };
}