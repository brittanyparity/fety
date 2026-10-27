import { useMemo } from "react";
import { dateToISOLocal } from "../../lib/fetyCalculations";
import CalendarNoteIcon from "../../components/CalendarNoteIcon";
import { calendarNotePreview, hasCalendarNote, noteForCalendarDay } from "../../lib/calendarNotes";
import {
  calendarEndingBalanceBg,
  calBalanceColor,
  calSignedColor,
} from "../../lib/calendarUi";
import { useIsNarrow } from "../../hooks/useIsNarrow";
import type { CalDay, CalendarMap, FetyStore } from "../../types/fety";

const CAL_KEY = (d: Date) => dateToISOLocal(d);

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
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

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const compactUsd = (n: number) => {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 10000) return `${sign}$${(abs / 1000).toFixed(0)}k`;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return sign + usd(abs);
};

function dayActivityTotals(data: CalDay) {
  let income = 0;
  let bills = 0;
  let expenses = 0;
  for (const item of data.items) {
    const amt = Math.abs(item.amount);
    if (item.type === "income" || item.type === "paycheck") income += amt;
    else if (item.type === "bill") bills += amt;
    else if (item.type === "expense") expenses += amt;
  }
  return { income, bills, expenses };
}

function CalDayNotePreview({
  notes,
  dateISO,
  selected,
}: {
  notes: FetyStore["calendarNotes"];
  dateISO: string;
  selected?: boolean;
}) {
  const preview = calendarNotePreview(notes, dateISO, 32);
  if (!preview) return null;
  return (
    <p
      className="fety-cal-day-note-preview"
      style={selected ? { color: "rgba(255,255,255,0.75)" } : undefined}
      title={noteForCalendarDay(notes, dateISO)?.text}
    >
      {preview}
    </p>
  );
}

function DayActivityCopy({
  data,
  money,
  selected,
}: {
  data: CalDay;
  money: (n: number) => string;
  selected?: boolean;
}) {
  const { income, bills, expenses } = dayActivityTotals(data);
  if (income <= 0 && bills <= 0 && expenses <= 0) return null;
  return (
    <div className="fety-cal-day-activity" style={{ color: selected ? "rgba(255,255,255,0.82)" : "var(--ink-2)" }}>
      {income > 0 ? <p>Income {money(income)}</p> : null}
      {bills > 0 ? <p>Bills due {money(bills)}</p> : null}
      {expenses > 0 ? <p>Expenses {money(expenses)}</p> : null}
    </div>
  );
}

export function WeeklyCalGrid({
  anchor,
  days,
  calendarMap,
  selected,
  onSelect,
  store,
  compact,
}: {
  anchor: Date;
  days: number;
  calendarMap: CalendarMap;
  selected: string | null;
  onSelect: (k: string) => void;
  store: FetyStore;
  compact?: boolean;
}) {
  const narrow = useIsNarrow();
  const money = narrow || compact ? compactUsd : usd;
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7));

  const cols: Date[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    cols.push(d);
  }

  const today = new Date();
  const isBiweekly = days === 14;
  const rows: Date[][] = isBiweekly ? [cols.slice(0, 7), cols.slice(7, 14)] : [cols];

  const DayCell = (date: Date) => {
    const key = CAL_KEY(date);
    const data = calendarMap.get(key);
    const isSelected = selected === key;
    const isToday = date.toDateString() === today.toDateString();
    const net = data ? data.endBal - data.startBal : 0;
    return (
      <button
        key={key}
        type="button"
        className="fety-cal-week-cell"
        onClick={() => onSelect(key)}
        style={{
          background: data ? calendarEndingBalanceBg(data.endBal, isSelected) : "var(--surface)",
          border: isSelected ? "2px solid var(--ink)" : "1px solid var(--border)",
          borderRadius: compact ? 10 : 12,
          padding: compact ? "8px 8px" : "12px 10px",
          cursor: "pointer",
          textAlign: "left",
          display: "flex",
          flexDirection: "column",
          gap: compact ? 6 : 8,
        }}
      >
        <div>
          <p
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: isSelected ? "rgba(255,255,255,0.6)" : "var(--ink-3)",
              textTransform: "uppercase",
              letterSpacing: "0.16em",
            }}
          >
            {DAYS_SHORT[date.getDay()]}
          </p>
          <p
            style={{
              fontSize: compact ? 16 : 18,
              fontWeight: 400,
              color: isSelected ? calSignedColor(net, true) : isToday ? "var(--lime-dk)" : "var(--ink)",
              letterSpacing: "-0.5px",
              lineHeight: 1.1,
            }}
          >
            {date.getDate()}
          </p>
        </div>
        {data ? (
          <DayActivityCopy data={data} money={money} selected={isSelected} />
        ) : (
          <div style={{ fontSize: 9, color: isSelected ? "rgba(255,255,255,0.4)" : "var(--ink-3)" }}>No activity</div>
        )}
        <CalDayNotePreview notes={store.calendarNotes ?? {}} dateISO={key} selected={isSelected} />
      </button>
    );
  };

  return (
    <div className={`fety-cal-week-stack${compact ? " fety-cal-week-stack--compact" : ""}`}>
      <div className="fety-cal-week-dow">
        {DAYS_SHORT.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      {rows.map((row, ri) => (
        <div key={ri} className="fety-cal-week-row">
          {row.map((date) => DayCell(date))}
        </div>
      ))}
    </div>
  );
}

export function YearlyWeekdayBar() {
  return (
    <div className="fety-yearly-dow-wrap">
      <div className="fety-yearly-dow">
        {DAYS_SHORT.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
    </div>
  );
}

export function YearlyCalGrid({
  year,
  calendarMap,
  calendarNotes,
  selected,
  onSelect,
}: {
  year: number;
  calendarMap: CalendarMap;
  calendarNotes?: FetyStore["calendarNotes"];
  selected: string | null;
  onSelect: (k: string) => void;
}) {
  const cells: (Date | null)[] = [];
  const jan1 = new Date(year, 0, 1);
  for (let i = 0; i < jan1.getDay(); i++) cells.push(null);
  for (let month = 0; month < 12; month++) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();

  return (
    <div className="fety-cal-year-scroll-wrap fety-cal-year-scroll-wrap--home">
      <div className="fety-cal-year-grid" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {cells.map((date, i) => {
          if (!date) return <div key={`pad-${i}`} style={{ minHeight: 40, borderRadius: 8, background: "transparent" }} />;
          const key = CAL_KEY(date);
          const data = calendarMap.get(key);
          const net = data ? data.endBal - data.startBal : 0;
          const isSelected = selected === key;
          const isToday = date.toDateString() === today.toDateString();
          const isFirstOfMonth = date.getDate() === 1;
          const tileBg = data ? calendarEndingBalanceBg(data.endBal, isSelected) : calendarEndingBalanceBg(0, false);

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              title={data ? `${date.toLocaleDateString("en-US")} · ${compactUsd(data.endBal)}` : undefined}
              style={{
                borderRadius: 8,
                padding: "4px 5px",
                border: isSelected ? "2px solid var(--ink)" : isToday ? "1px solid var(--clear-dk)" : "1px solid var(--border)",
                background: tileBg,
                cursor: "pointer",
                textAlign: "left",
                minHeight: 40,
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, lineHeight: 1 }}>
                {isFirstOfMonth ? (
                  <span style={{ fontSize: 7, fontWeight: 700, color: isSelected ? "rgba(255,255,255,0.55)" : "var(--ink-3)", textTransform: "uppercase" }}>
                    {MONTHS[date.getMonth()].slice(0, 3)}
                  </span>
                ) : null}
                <span style={{ fontSize: 10, fontWeight: 600, color: isSelected ? calSignedColor(net, true) : isToday ? "var(--clear-dk)" : "var(--ink)" }}>
                  {date.getDate()}
                </span>
                {hasCalendarNote(calendarNotes, key) ? (
                  <CalendarNoteIcon size={9} className={isSelected ? "fety-cal-day-note-icon--on-dark" : undefined} />
                ) : null}
              </div>
              {data ? (
                <div style={{ fontSize: 7.5, lineHeight: 1.2, color: isSelected ? "rgba(255,255,255,0.55)" : "var(--ink-3)", marginTop: "auto" }}>
                  E{" "}
                  <span style={{ fontFamily: "var(--font-sans)", fontWeight: 700, color: calBalanceColor(data.endBal, isSelected) }}>
                    {compactUsd(data.endBal)}
                  </span>
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function HomeDailyCalSummary({
  date,
  calendarMap,
  store,
}: {
  date: Date;
  calendarMap: CalendarMap;
  store: FetyStore;
}) {
  const key = CAL_KEY(date);
  const data = calendarMap.get(key);
  const notes = useMemo(() => store.calendarNotes, [store.calendarNotes]);

  return (
    <div className="fety-home-cal-daily">
      <p className="fety-label">What this day looks like</p>
      <h3 className="fety-home-cal-daily-title">
        {date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
      </h3>
      <div className="fety-home-cal-daily-balances">
        <div className="fety-home-cal-daily-bal">
          <span className="fety-label">Starting</span>
          <strong style={{ color: calBalanceColor(data?.startBal ?? 0) }}>{data ? usd(data.startBal) : "—"}</strong>
        </div>
        <div className="fety-home-cal-daily-bal">
          <span className="fety-label">Ending</span>
          <strong style={{ color: calBalanceColor(data?.endBal ?? 0) }}>{data ? usd(data.endBal) : "—"}</strong>
        </div>
      </div>
      {data ? <DayActivityCopy data={data} money={usd} /> : null}
      {hasCalendarNote(notes, key) ? (
        <p className="fety-home-cal-daily-note">{calendarNotePreview(notes, key, 200)}</p>
      ) : null}
      {!data ? <p className="fety-home-cal-daily-empty">No scheduled activity for this day yet.</p> : null}
    </div>
  );
}
