import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import CalendarMiniMonth, { diffCalendarDays, noonDate } from "../components/CalendarMiniMonth";
import { dateToISOLocal, todayISO } from "../lib/fetyCalculations";

function labelForSingle(iso: string): string {
  if (iso === todayISO()) return "Today";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function labelForRange(startISO: string, endISO: string): string {
  if (!startISO) return "Choose dates";
  const start = new Date(`${startISO}T12:00:00`);
  const end = new Date(`${endISO || startISO}T12:00:00`);
  if (startISO === endISO || !endISO) {
    return start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  const sameYear = start.getFullYear() === end.getFullYear();
  const a = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const b = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${a} – ${b}`;
}

function isoToNoon(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return noonDate(y, m - 1, d);
}

type SingleProps = {
  mode?: "single";
  selectedISO: string;
  onSelect: (dateISO: string) => void;
  rangeStartISO?: never;
  rangeEndISO?: never;
  onRangeChange?: never;
};

type RangeProps = {
  mode: "range";
  rangeStartISO: string;
  rangeEndISO: string;
  onRangeChange: (startISO: string, endISO: string) => void;
  selectedISO?: never;
  onSelect?: never;
};

export default function MobileHeaderDatePicker({
  mode = "single",
  selectedISO,
  onSelect,
  rangeStartISO = "",
  rangeEndISO = "",
  onRangeChange,
  endingBalanceForDate,
  className = "",
}: (SingleProps | RangeProps) & {
  endingBalanceForDate?: (dateISO: string) => number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const isRange = mode === "range";

  const anchorISO = isRange ? rangeStartISO || todayISO() : selectedISO;
  const focusDate = useMemo(() => new Date(`${anchorISO}T12:00:00`), [anchorISO]);
  const [viewYear, setViewYear] = useState(focusDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(focusDate.getMonth());
  const [pickStart, setPickStart] = useState<Date | null>(null);
  const [pickEnd, setPickEnd] = useState<Date | null>(null);
  const [hoverDay, setHoverDay] = useState<Date | null>(null);

  const rangePreviewEnd = pickStart && !pickEnd && hoverDay ? hoverDay : null;

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    setViewYear(focusDate.getFullYear());
    setViewMonth(focusDate.getMonth());
    if (isRange) {
      setPickStart(rangeStartISO ? isoToNoon(rangeStartISO) : null);
      setPickEnd(rangeEndISO ? isoToNoon(rangeEndISO) : null);
    }
    setHoverDay(null);
  }, [open, focusDate, isRange, rangeStartISO, rangeEndISO]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const triggerLabel = isRange
    ? labelForRange(rangeStartISO, rangeEndISO)
    : labelForSingle(selectedISO);

  const pickToday = () => {
    const t = todayISO();
    if (isRange) {
      onRangeChange(t, t);
    } else {
      onSelect(t);
    }
    close();
  };

  const handleDaySelect = (d: Date) => {
    if (!isRange) {
      onSelect(dateToISOLocal(d));
      close();
      return;
    }
    if (!pickStart || (pickStart && pickEnd)) {
      setPickStart(d);
      setPickEnd(null);
      setHoverDay(null);
      return;
    }
    const ordered =
      diffCalendarDays(pickStart, d) >= 0 ? { start: pickStart, end: d } : { start: d, end: pickStart };
    setPickStart(ordered.start);
    setPickEnd(ordered.end);
    setHoverDay(null);
    const startISO = dateToISOLocal(ordered.start);
    const endISO = dateToISOLocal(ordered.end);
    onRangeChange(startISO, endISO);
    window.setTimeout(close, 160);
  };

  const handleSingleDaySelect = (d: Date) => handleDaySelect(d);

  const sheetTitle = isRange ? "Choose dates" : "Choose a day";

  return (
    <>
      <button
        type="button"
        className={`fety-mobile-date-picker-trigger fety-mobile-date-picker-trigger--header${className ? ` ${className}` : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <span className="fety-mobile-date-picker-trigger-label">{triggerLabel}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden className="fety-mobile-date-picker-caret">
          <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open
        ? createPortal(
            <div className="fety-mobile-date-picker-overlay" role="presentation" onClick={close}>
              <div
                className="fety-mobile-date-picker-sheet"
                role="dialog"
                aria-label={sheetTitle}
                onClick={(e) => e.stopPropagation()}
              >
                <header className="fety-mobile-date-picker-head">
                  <h3 className="fety-mobile-date-picker-title">{sheetTitle}</h3>
                  <button type="button" className="fety-mobile-link-btn" onClick={close}>
                    Done
                  </button>
                </header>
                <div className="fety-mobile-date-picker-today-row">
                  <button type="button" className="fety-mobile-today-btn" onClick={pickToday}>
                    Today
                  </button>
                </div>
                <CalendarMiniMonth
                  viewYear={viewYear}
                  viewMonth={viewMonth}
                  focusDate={focusDate}
                  selectedDay={isRange ? null : focusDate}
                  rangeStart={isRange ? pickStart : null}
                  rangeEnd={isRange ? pickEnd : null}
                  rangePreviewEnd={isRange ? rangePreviewEnd : null}
                  rangeMode={isRange}
                  onViewMonthChange={(y, m) => {
                    setViewYear(y);
                    setViewMonth(m);
                  }}
                  onSelectDay={isRange ? handleDaySelect : handleSingleDaySelect}
                  onHoverDay={isRange ? setHoverDay : undefined}
                  endingBalanceForDate={endingBalanceForDate}
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
