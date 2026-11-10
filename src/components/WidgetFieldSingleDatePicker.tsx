import { useEffect, useMemo, useRef, useState } from "react";
import CalendarMiniMonth, { noonDate } from "./CalendarMiniMonth";
import { dateToISOLocal } from "../lib/fetyCalculations";

function formatSingleLabel(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isoToNoon(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return noonDate(y, m - 1, d);
}

export default function WidgetFieldSingleDatePicker({
  selectedISO,
  onSelect,
  fieldLabel = "Through",
  endingBalanceForDate,
  menuClassName = "",
  ariaLabel = "Choose date",
}: {
  selectedISO: string;
  onSelect: (dateISO: string) => void;
  fieldLabel?: string;
  endingBalanceForDate?: (dateISO: string) => number;
  menuClassName?: string;
  ariaLabel?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const label = useMemo(() => formatSingleLabel(selectedISO), [selectedISO]);
  const focusDate = useMemo(() => isoToNoon(selectedISO), [selectedISO]);
  const [viewYear, setViewYear] = useState(focusDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(focusDate.getMonth());

  useEffect(() => {
    if (!open) return;
    setViewYear(focusDate.getFullYear());
    setViewMonth(focusDate.getMonth());
  }, [open, focusDate]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const handleDaySelect = (d: Date) => {
    onSelect(dateToISOLocal(d));
    setOpen(false);
  };

  return (
    <div
      ref={rootRef}
      className={`fety-txn-date-range-menu fety-widget-date-filter-menu${menuClassName ? ` ${menuClassName}` : ""}`}
    >
      <span className="fety-widget-account-filter fety-widget-date-filter">
        <span className="fety-label">{fieldLabel}</span>
        <button
          type="button"
          className="fety-widget-date-filter-trigger"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={ariaLabel}
        >
          {label}
        </button>
      </span>
      {open ? (
        <div className="fety-cal-period-menu-panel fety-txn-date-range-panel fety-widget-date-filter-panel">
          <div className="fety-cal-period-picker fety-txn-date-range-picker" role="dialog" aria-label={ariaLabel}>
            <div className="fety-cal-period-range">
              <CalendarMiniMonth
                viewYear={viewYear}
                viewMonth={viewMonth}
                focusDate={focusDate}
                rangeStart={null}
                rangeEnd={null}
                rangePreviewEnd={null}
                rangeMode={false}
                endingBalanceForDate={endingBalanceForDate}
                onViewMonthChange={(y, m) => {
                  setViewYear(y);
                  setViewMonth(m);
                }}
                onSelectDay={handleDaySelect}
                onHoverDay={() => {}}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
