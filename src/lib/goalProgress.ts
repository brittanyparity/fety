const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

const MONTH_ABBR = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** Last calendar day of the goal's target month, or null when unknown / TBD. */
export function parseGoalTargetDateEnd(targetDate: string): Date | null {
  const trimmed = targetDate.trim();
  if (!trimmed || trimmed.toUpperCase() === "TBD") return null;
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12, 0, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const match = trimmed.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (!match) return null;
  const month = MONTH_INDEX[match[1].toLowerCase()];
  const year = Number.parseInt(match[2], 10);
  if (month === undefined || !Number.isFinite(year)) return null;
  return new Date(year, month + 1, 0);
}

/** Value for `<input type="date">` from stored goal target (ISO or legacy month/year). */
export function goalTargetDateForDateInput(targetDate: string): string {
  const trimmed = targetDate.trim();
  if (!trimmed || trimmed.toUpperCase() === "TBD") return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const end = parseGoalTargetDateEnd(trimmed);
  if (!end) return "";
  const y = end.getFullYear();
  const m = String(end.getMonth() + 1).padStart(2, "0");
  const day = String(end.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Whole months of contributions still available before the target date (inclusive of target month). */
export function monthsRemainingUntilGoalTarget(from: Date, targetEnd: Date | null): number {
  if (!targetEnd) return 0;
  if (from > targetEnd) return 0;
  let months = (targetEnd.getFullYear() - from.getFullYear()) * 12 + (targetEnd.getMonth() - from.getMonth());
  if (from.getDate() <= targetEnd.getDate()) months += 1;
  return Math.max(0, months);
}

export function formatGoalByline(targetDate: string): string | null {
  const end = parseGoalTargetDateEnd(targetDate);
  if (!end) return null;
  return `BY ${MONTH_ABBR[end.getMonth()]} ${end.getFullYear()}`;
}

export type GoalPaceStatus = "on_track" | "behind";

export function goalPaceStatus(
  savedTotal: number,
  target: number,
  targetDate: string,
  monthlyContribution: number,
  asOf: Date = new Date(),
): GoalPaceStatus {
  if (target <= 0) return "on_track";
  if (savedTotal >= target) return "on_track";

  const pct = savedTotal / target;
  const targetEnd = parseGoalTargetDateEnd(targetDate);
  const monthsLeft = monthsRemainingUntilGoalTarget(asOf, targetEnd);

  if (monthsLeft === 0) {
    return pct >= 0.45 ? "on_track" : "behind";
  }

  const projected = savedTotal + Math.max(0, monthlyContribution) * monthsLeft;
  const paceThreshold = target * 0.75;
  return projected >= paceThreshold ? "on_track" : "behind";
}
