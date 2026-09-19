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

const GREEN_TILE = "rgba(145, 216, 182, 0.42)";
const RED_TILE = "rgba(255, 111, 94, 0.38)";
const YELLOW_TILE = "rgba(255, 217, 107, 0.48)";
const GREEN_TILE_STRONG = "rgba(145, 216, 182, 0.55)";
const RED_TILE_STRONG = "rgba(255, 111, 94, 0.5)";
const YELLOW_TILE_STRONG = "rgba(255, 217, 107, 0.58)";

/** Tile background from daily net cash flow (money in minus money out that day). */
export function calendarDailyBalanceBg(net: number, isSelected: boolean): string {
  if (isSelected) return "var(--ink)";
  if (net > 0) return GREEN_TILE;
  if (net < 0) return RED_TILE;
  return YELLOW_TILE;
}

export function calendarDailyBalanceBgStrong(net: number): string {
  if (net > 0) return GREEN_TILE_STRONG;
  if (net < 0) return RED_TILE_STRONG;
  return YELLOW_TILE_STRONG;
}

/** Ending balance at close of day (yearly heat map). */
export function calendarEndingBalanceBg(endBal: number, isSelected: boolean): string {
  if (isSelected) return "var(--ink)";
  if (endBal > 0) return GREEN_TILE;
  if (endBal < 0) return RED_TILE;
  return YELLOW_TILE;
}

export function calendarEndingBalanceBgStrong(endBal: number): string {
  if (endBal > 0) return GREEN_TILE_STRONG;
  if (endBal < 0) return RED_TILE_STRONG;
  return YELLOW_TILE_STRONG;
}
