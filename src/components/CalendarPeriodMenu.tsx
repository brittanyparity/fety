import { useEffect, useRef, useState } from "react";
import type { CalView } from "../lib/calendarView";
import CalendarMiniMonth, { diffCalendarDays, noonDate } from "./CalendarMiniMonth";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function mondayOfWeek(d: Date): Date {
  const mon = new Date(d);
  mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  mon.setHours(12, 0, 0, 0);
  return mon;
}

function formatWeekRange(mon: Date): string {
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return `${mon.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${sun.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

function formatBiweekRange(mon: Date): string {
  const end = new Date(mon);
  end.setDate(mon.getDate() + 13);
  return `${mon.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

export function calendarPeriodLabel(calView: CalView, focusDate: Date, year: number): string {
  if (calView === "daily") {
    return focusDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }
  if (calView === "weekly") return formatWeekRange(mondayOfWeek(focusDate));
  if (calView === "biweekly") return formatBiweekRange(mondayOfWeek(focusDate));
  return `${focusDate.toLocaleDateString("en-US", { month: "long" })} ${focusDate.getFullYear()}`;
}

export function CalendarPeriodMenu({
  calView,
  focusDate,
  year,
  onFocusDate,
  endingBalanceForDate,
  variant = "default",
}: {
  calView: CalView;
  focusDate: Date;
  year: number;
  onFocusDate: (d: Date) => void;
  endingBalanceForDate?: (dateISO: string) => number;
  variant?: "default" | "home";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const [viewYear, setViewYear] = useState(focusDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(focusDate.getMonth());
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(focusDate.getFullYear());

  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);

  useEffect(() => {
    if (!open) return;
    setViewYear(focusDate.getFullYear());
    setViewMonth(focusDate.getMonth());
    setPickerYear(focusDate.getFullYear());
    setYearPickerOpen(false);
    setRangeStart(null);
    setRangeEnd(null);
  }, [open, focusDate, calView]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const label = calendarPeriodLabel(calView, focusDate, year);
  const home = variant === "home";

  const close = () => setOpen(false);

  const onViewMonthChange = (y: number, m: number) => {
    setViewYear(y);
    setViewMonth(m);
  };

  const applyMonth = (monthIndex: number) => {
    const last = new Date(pickerYear, monthIndex + 1, 0).getDate();
    const day = Math.min(focusDate.getDate(), last);
    onFocusDate(noonDate(pickerYear, monthIndex, day));
    close();
  };

  const yearOptions = Array.from({ length: 11 }, (_, i) => pickerYear - 5 + i);

  const handleDailySelect = (d: Date) => {
    onFocusDate(d);
    close();
  };

  const handleRangeSelect = (d: Date, spanDays: number) => {
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(d);
      setRangeEnd(null);
      return;
    }
    const start = rangeStart;
    const end = d;
    const len = Math.abs(diffCalendarDays(start, end)) + 1;
    if (len !== spanDays) {
      setRangeStart(d);
      setRangeEnd(null);
      return;
    }
    const a = diffCalendarDays(start, end) >= 0 ? start : end;
    const b = diffCalendarDays(start, end) >= 0 ? end : start;
    setRangeEnd(b);
    window.setTimeout(() => {
      onFocusDate(mondayOfWeek(a));
      close();
    }, 180);
  };

  const pickerContent = (
    <div className="fety-cal-period-picker" role="document" aria-label="Choose calendar period">
      {calView === "daily" ? (
        <CalendarMiniMonth
          viewYear={viewYear}
          viewMonth={viewMonth}
          focusDate={focusDate}
          selectedDay={focusDate}
          onViewMonthChange={onViewMonthChange}
          onSelectDay={handleDailySelect}
          endingBalanceForDate={endingBalanceForDate}
        />
      ) : null}

      {calView === "monthly" ? (
        <div className="fety-cal-period-monthly">
          <button
            type="button"
            className="fety-cal-period-year-btn"
            onClick={() => setYearPickerOpen((v) => !v)}
            aria-expanded={yearPickerOpen}
          >
            {pickerYear}
            <span className="fety-cal-period-year-caret" aria-hidden>
              ▾
            </span>
          </button>
          {yearPickerOpen ? (
            <div className="fety-cal-period-year-grid">
              {yearOptions.map((y) => (
                <button
                  key={y}
                  type="button"
                  className={`fety-cal-period-year-opt${y === pickerYear ? " fety-cal-period-year-opt--active" : ""}`}
                  onClick={() => {
                    setPickerYear(y);
                    setYearPickerOpen(false);
                  }}
                >
                  {y}
                </button>
              ))}
            </div>
          ) : null}
          <div className="fety-cal-period-month-grid">
            {MONTH_FULL.map((name, i) => (
              <button
                key={name}
                type="button"
                className={`fety-cal-period-month-cell${i === focusDate.getMonth() && pickerYear === focusDate.getFullYear() ? " fety-cal-period-month-cell--active" : ""}`}
                onClick={() => applyMonth(i)}
              >
                {MONTH_ABBR[i]}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {calView === "weekly" ? (
        <div className="fety-cal-period-range">
          <CalendarMiniMonth
            viewYear={viewYear}
            viewMonth={viewMonth}
            focusDate={focusDate}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            rangeMode
            rangeSpanDays={7}
            endingBalanceForDate={endingBalanceForDate}
            onViewMonthChange={onViewMonthChange}
            onSelectDay={(d) => handleRangeSelect(d, 7)}
          />
        </div>
      ) : null}

      {calView === "biweekly" ? (
        <div className="fety-cal-period-range">
          <CalendarMiniMonth
            viewYear={viewYear}
            viewMonth={viewMonth}
            focusDate={focusDate}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            rangeMode
            rangeSpanDays={14}
            endingBalanceForDate={endingBalanceForDate}
            onViewMonthChange={onViewMonthChange}
            onSelectDay={(d) => handleRangeSelect(d, 14)}
          />
        </div>
      ) : null}
    </div>
  );

  return (
    <div
      ref={rootRef}
      className={`fety-cal-period-menu${home ? " fety-cal-period-menu--home" : ""}`}
      style={home ? undefined : { position: "relative", minWidth: 140 }}
    >
      <button
        type="button"
        className={home ? "fety-cal-period-menu-trigger" : undefined}
        onClick={() => setOpen((o) => !o)}
        style={
          home
            ? undefined
            : {
                fontSize: 12,
                fontWeight: 600,
                color: "var(--ink)",
                minWidth: 140,
                textAlign: "center",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: "4px 8px",
                borderRadius: 8,
              }
        }
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className={home ? "fety-cal-period-menu-label" : undefined}>{label}</span>
      </button>
      {open ? <div className="fety-cal-period-menu-panel">{pickerContent}</div> : null}
    </div>
  );
}
