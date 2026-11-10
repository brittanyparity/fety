/** Calendar amount / balance color helpers (positive = green, negative = red). */

const ZERO_BALANCE_EPS = 0.005;

export function isZeroEndingBalance(endBal: number): boolean {
  return Math.abs(endBal) <= ZERO_BALANCE_EPS;
}

function calAmber(whenSelected?: boolean): string {
  return whenSelected ? "var(--amber)" : "var(--amber-dk)";
}

export function calSignedColor(amount: number, whenSelected?: boolean): string {
  if (!Number.isFinite(amount)) return whenSelected ? "rgba(255,255,255,0.7)" : "var(--ink-3)";
  if (whenSelected) return amount >= 0 ? "var(--clear)" : "var(--trouble)";
  return amount >= 0 ? "var(--clear-dk)" : "var(--trouble-dk)";
}

/** Running balance text (green when positive, red when negative, amber at zero). */
export function calBalanceColor(balance: number, whenSelected?: boolean): string {
  if (isZeroEndingBalance(balance)) return calAmber(whenSelected);
  return calSignedColor(balance, whenSelected);
}

/** Amount color when the day's ending balance is known (all figures amber on zero-balance days). */
export function calFigureColor(amount: number, dayEndBalance: number, whenSelected?: boolean): string {
  if (isZeroEndingBalance(dayEndBalance)) return calAmber(whenSelected);
  return calSignedColor(amount, whenSelected);
}

/** Balance figure on a calendar day tile (start/end rows respect zero ending balance for the day). */
export function calDayBalanceColor(balance: number, dayEndBalance: number, whenSelected?: boolean): string {
  if (isZeroEndingBalance(dayEndBalance)) return calAmber(whenSelected);
  return calBalanceColor(balance, whenSelected);
}

/** Net worth total: green positive, red negative, amber at zero. */
export function calNetWorthColor(net: number): string {
  if (isZeroEndingBalance(net)) return "var(--amber-dk)";
  if (net > 0) return "var(--clear-dk)";
  return "var(--trouble-dk)";
}

/** Lighter net worth summary tile (green / red / yellow from value). */
export function calNetWorthBg(net: number): string {
  if (isZeroEndingBalance(net)) return YELLOW_TILE_STRONG;
  if (net > 0) return GREEN_TILE_STRONG;
  return RED_TILE_STRONG;
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
