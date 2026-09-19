/** Calendar amount / balance color helpers (positive = green, negative = red). */

export function calSignedColor(amount: number, whenSelected?: boolean): string {
  if (whenSelected) return amount >= 0 ? "var(--clear)" : "var(--trouble)";
  return amount >= 0 ? "var(--clear-dk)" : "var(--trouble-dk)";
}

export function calDailyNetPositive(startBal: number, endBal: number): boolean {
  return endBal >= startBal;
}

export function calDailyNet(startBal: number, endBal: number): number {
  return endBal - startBal;
}

/** Tile background from daily net (end vs start). */
export function calendarDailyBalanceBg(net: number, isSelected: boolean): string {
  if (isSelected) return "var(--ink)";
  if (net > 0) return "rgba(145, 216, 182, 0.42)";
  if (net < 0) return "rgba(255, 111, 94, 0.38)";
  return "var(--surface)";
}

export function calendarDailyBalanceBgStrong(net: number): string {
  if (net > 0) return "rgba(145, 216, 182, 0.55)";
  if (net < 0) return "rgba(255, 111, 94, 0.5)";
  return "var(--surface)";
}
