import { useEffect, useMemo, useRef, useState } from "react";
import CalendarMiniMonth, { diffCalendarDays, noonDate } from "./CalendarMiniMonth";
import { dateToISOLocal } from "../lib/fetyCalculations";

function formatRangeLabel(startISO: string, endISO: string): string {
  if (!startISO && !endISO) return "All dates";
  const start = new Date(`${startISO}T12:00:00`);
  const end = new Date(`${endISO}T12:00:00`);
  if (startISO === endISO) {
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

type TransactionDateRangeFilterProps = {
  rangeStartISO: string;
  rangeEndISO: string;
  onRangeChange: (startISO: string, endISO: string) => void;
  endingBalanceForDate?: (dateISO: string) => number;
};

export default function TransactionDateRangeFilter({
  rangeStartISO,
  rangeEndISO,
  onRangeChange,
  endingBalanceForDate,
}: TransactionDateRangeFilterProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const label = useMemo(() => formatRangeLabel(rangeStartISO, rangeEndISO), [rangeStartISO, rangeEndISO]);

  const focusDate = useMemo(() => {
    const appliedStart = rangeStartISO ? isoToNoon(rangeStartISO) : null;
    const appliedEnd = rangeEndISO ? isoToNoon(rangeEndISO) : null;
    const today = new Date();
    return (
      appliedEnd ??
      appliedStart ??
      noonDate(today.getFullYear(), today.getMonth(), today.getDate())
    );
  }, [rangeStartISO, rangeEndISO]);

  const [viewYear, setViewYear] = useState(focusDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(focusDate.getMonth());
  const [pickStart, setPickStart] = useState<Date | null>(null);
  const [pickEnd, setPickEnd] = useState<Date | null>(null);
  const [hoverDay, setHoverDay] = useState<Date | null>(null);

  const rangePreviewEnd = pickStart && !pickEnd && hoverDay ? hoverDay : null;

  useEffect(() => {
    if (!open) return;
    setViewYear(focusDate.getFullYear());
    setViewMonth(focusDate.getMonth());
    setPickStart(rangeStartISO ? isoToNoon(rangeStartISO) : null);
    setPickEnd(rangeEndISO ? isoToNoon(rangeEndISO) : null);
    setHoverDay(null);
  }, [open, rangeStartISO, rangeEndISO, focusDate]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const handleDaySelect = (d: Date) => {
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
    window.setTimeout(() => {
      onRangeChange(startISO, endISO);
      setOpen(false);
    }, 180);
  };

  const clearRange = () => {
    onRangeChange("", "");
    setPickStart(null);
    setPickEnd(null);
    setHoverDay(null);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="fety-txn-date-range-menu">
      <button
        type="button"
        className="fety-txn-date-range-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="fety-txn-date-range-trigger-label">{label}</span>
      </button>
      {open ? (
        <div className="fety-cal-period-menu-panel fety-txn-date-range-panel">
          <div className="fety-cal-period-picker fety-txn-date-range-picker" role="dialog" aria-label="Choose date range">
            <div className="fety-cal-period-range">
              <CalendarMiniMonth
                viewYear={viewYear}
                viewMonth={viewMonth}
                focusDate={focusDate}
                rangeStart={pickStart}
                rangeEnd={pickEnd}
                rangePreviewEnd={rangePreviewEnd}
                rangeMode
                endingBalanceForDate={endingBalanceForDate}
                onViewMonthChange={(y, m) => {
                  setViewYear(y);
                  setViewMonth(m);
                }}
                onSelectDay={handleDaySelect}
                onHoverDay={setHoverDay}
              />
            </div>
            <div className="fety-txn-date-range-actions">
              <button type="button" className="fety-txn-date-range-clear" onClick={clearRange}>
                All dates
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
