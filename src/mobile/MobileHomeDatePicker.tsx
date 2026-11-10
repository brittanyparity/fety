import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import CalendarMiniMonth from "../components/CalendarMiniMonth";
import { dateToISOLocal, todayISO } from "../lib/fetyCalculations";

function labelForSelectedDate(iso: string): string {
  if (iso === todayISO()) return "Today";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function MobileHomeDatePicker({
  selectedISO,
  onSelect,
  endingBalanceForDate,
}: {
  selectedISO: string;
  onSelect: (dateISO: string) => void;
  endingBalanceForDate?: (dateISO: string) => number;
}) {
  const [open, setOpen] = useState(false);
  const focusDate = useMemo(() => new Date(`${selectedISO}T12:00:00`), [selectedISO]);
  const [viewYear, setViewYear] = useState(focusDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(focusDate.getMonth());

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    setViewYear(focusDate.getFullYear());
    setViewMonth(focusDate.getMonth());
  }, [open, focusDate]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const pickDay = (d: Date) => {
    onSelect(dateToISOLocal(d));
    close();
  };

  const pickToday = () => {
    onSelect(todayISO());
    close();
  };

  const triggerLabel = labelForSelectedDate(selectedISO);

  return (
    <>
      <button
        type="button"
        className="fety-mobile-date-picker-trigger"
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
            <div
              className="fety-mobile-date-picker-overlay"
              role="presentation"
              onClick={close}
            >
              <div
                className="fety-mobile-date-picker-sheet"
                role="dialog"
                aria-label="Choose a day"
                onClick={(e) => e.stopPropagation()}
              >
                <header className="fety-mobile-date-picker-head">
                  <h3 className="fety-mobile-date-picker-title">Choose a day</h3>
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
                  selectedDay={focusDate}
                  onViewMonthChange={(y, m) => {
                    setViewYear(y);
                    setViewMonth(m);
                  }}
                  onSelectDay={pickDay}
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
