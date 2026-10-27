import { calBalanceColor, calendarEndingBalanceBgStrong } from "../lib/calendarUi";
import { dateToISOLocal } from "../lib/fetyCalculations";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

export function noonDate(y: number, m: number, d: number): Date {
  return new Date(y, m, d, 12, 0, 0, 0);
}

export function diffCalendarDays(a: Date, b: Date): number {
  const ms = noonDate(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  const ms2 = noonDate(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  return Math.round((ms - ms2) / 86400000);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function inRange(day: Date, start: Date | null, end: Date | null): boolean {
  if (!start || !end) return false;
  const t = noonDate(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const a = noonDate(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const b = noonDate(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return t >= lo && t <= hi;
}

function addCalendarDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(d.getDate() + days);
  return noonDate(next.getFullYear(), next.getMonth(), next.getDate());
}

type CalendarMiniMonthProps = {
  viewYear: number;
  viewMonth: number;
  focusDate: Date;
  onViewMonthChange: (year: number, month: number) => void;
  onSelectDay: (d: Date) => void;
  rangeStart?: Date | null;
  rangeEnd?: Date | null;
  selectedDay?: Date | null;
  /** Weekly / bi-weekly range picking — do not highlight focusDate as selected. */
  rangeMode?: boolean;
  /** When start is chosen but not end, preview this many days inclusive from start. */
  rangeSpanDays?: number;
  /** Free-form range preview end (e.g. hover) while start is set and end is not. */
  rangePreviewEnd?: Date | null;
  onHoverDay?: (day: Date | null) => void;
  /** End-of-day balance — tiles use the same green / yellow / red coding as the main calendar. */
  endingBalanceForDate?: (dateISO: string) => number;
};

export default function CalendarMiniMonth({
  viewYear,
  viewMonth,
  focusDate,
  onViewMonthChange,
  onSelectDay,
  rangeStart = null,
  rangeEnd = null,
  selectedDay = null,
  rangeMode = false,
  rangeSpanDays,
  rangePreviewEnd = null,
  onHoverDay,
  endingBalanceForDate,
}: CalendarMiniMonthProps) {
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(noonDate(viewYear, viewMonth, d));

  const header = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const prev = () => {
    const d = new Date(viewYear, viewMonth - 1, 1);
    onViewMonthChange(d.getFullYear(), d.getMonth());
  };
  const next = () => {
    const d = new Date(viewYear, viewMonth + 1, 1);
    onViewMonthChange(d.getFullYear(), d.getMonth());
  };

  const activeSelected = rangeMode ? selectedDay : (selectedDay ?? focusDate);
  const rangeComplete = rangeStart != null && rangeEnd != null;
  const fixedSpanPreview =
    rangeMode && rangeStart != null && rangeEnd == null && rangeSpanDays != null && rangeSpanDays > 1;
  const flexiblePreview =
    rangeMode && rangeStart != null && rangeEnd == null && rangePreviewEnd != null;
  const previewEnd = rangeComplete
    ? null
    : flexiblePreview
      ? rangePreviewEnd
      : fixedSpanPreview && rangeStart
        ? addCalendarDays(rangeStart, rangeSpanDays! - 1)
        : null;
  const previewActive = previewEnd != null;
  const pickStartOnly = rangeMode && rangeStart != null && rangeEnd == null && !previewActive;
  const useBalanceTiles = endingBalanceForDate != null;

  return (
    <div className="fety-cal-mini-month">
      <div className="fety-cal-mini-month-nav">
        <button type="button" className="fety-cal-mini-month-arrow" onClick={prev} aria-label="Previous month">
          ‹
        </button>
        <span className="fety-cal-mini-month-title">{header}</span>
        <button type="button" className="fety-cal-mini-month-arrow" onClick={next} aria-label="Next month">
          ›
        </button>
      </div>
      <div className="fety-cal-mini-month-dow">
        {DOW.map((d, i) => (
          <span key={`${d}-${i}`}>{d}</span>
        ))}
      </div>
      <div className="fety-cal-mini-month-grid">
        {cells.map((date, i) => {
          if (!date) return <span key={`pad-${i}`} className="fety-cal-mini-day fety-cal-mini-day--pad" aria-hidden />;
          const iso = dateToISOLocal(date);
          const selected = activeSelected != null && isSameDay(date, activeSelected);
          const isStart = rangeStart != null && isSameDay(date, rangeStart);
          const isEnd = rangeEnd != null && isSameDay(date, rangeEnd);
          const inRangeBand = rangeComplete && inRange(date, rangeStart, rangeEnd);
          const isBetween = inRangeBand && !isStart && !isEnd;
          const inPreviewBand = previewEnd != null && rangeStart != null && inRange(date, rangeStart, previewEnd);
          const isPreviewStart = previewActive && isStart;
          const isPreviewEnd = previewActive && previewEnd != null && isSameDay(date, previewEnd);
          const isPreviewBetween = inPreviewBand && !isPreviewStart && !isPreviewEnd && previewActive;
          const endBal = useBalanceTiles ? endingBalanceForDate!(iso) : null;
          const rangeClasses = rangeMode
            ? rangeComplete
              ? [
                  isStart ? " fety-cal-mini-day--range-start" : "",
                  isEnd ? " fety-cal-mini-day--range-end" : "",
                  isBetween ? " fety-cal-mini-day--range-mid" : "",
                ].join("")
              : previewActive
                ? [
                    isPreviewStart || (isStart && flexiblePreview) ? " fety-cal-mini-day--range-start fety-cal-mini-day--range-preview" : "",
                    isPreviewEnd ? " fety-cal-mini-day--range-end fety-cal-mini-day--range-preview-end" : "",
                    isPreviewBetween ? " fety-cal-mini-day--range-mid fety-cal-mini-day--range-preview-mid" : "",
                  ].join("")
                : pickStartOnly && isStart
                  ? " fety-cal-mini-day--range-start fety-cal-mini-day--range-preview"
                  : ""
            : "";
          const inRangeFill =
            rangeMode &&
            (isStart ||
              isEnd ||
              isBetween ||
              isPreviewStart ||
              isPreviewEnd ||
              isPreviewBetween);
          const tileStyle =
            endBal != null && !inRangeFill ? { background: calendarEndingBalanceBgStrong(endBal) } : undefined;
          const balanceTextOnDark = isStart || isPreviewStart;
          const numStyle =
            endBal != null ? { color: calBalanceColor(endBal, balanceTextOnDark) } : undefined;
          return (
            <button
              key={iso}
              type="button"
              className={`fety-cal-mini-day${selected ? " fety-cal-mini-day--selected" : ""}${endBal != null ? " fety-cal-mini-day--balance-tile" : ""}${rangeClasses}`}
              style={tileStyle}
              title={endBal != null ? `Ending balance ${endBal.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}` : undefined}
              onClick={() => onSelectDay(date)}
              onMouseEnter={() => onHoverDay?.(date)}
              onMouseLeave={() => onHoverDay?.(null)}
            >
              <span className="fety-cal-mini-day-num" style={numStyle}>
                {date.getDate()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
