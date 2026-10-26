import { useMemo, useState, type ReactNode } from "react";
import { buildCalendarMap, formatDisplayDate } from "../lib/fetyCalculations";
import { calendarEndingBalanceBg, calBalanceColor } from "../lib/calendarUi";
import { hasCalendarNote } from "../lib/calendarNotes";
import type { FinancialAnalysis, FetyActionTarget } from "../types/analysis";
import type { FetyStore, FinanceSummary } from "../types/fety";
import HomeInsightCharts from "./HomeInsightCharts";
import HomeThingsToTry from "./HomeThingsToTry";
import { NotesPanel, UpcomingExpensesPanel } from "./homePanels";

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

const calKey = (d: Date) => d.toISOString().slice(0, 10);

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function compactUsd(n: number) {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 10000) return `${sign}$${(abs / 1000).toFixed(0)}k`;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return sign + usd(abs);
}

function HomeCard({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`fety-home-card${className ? ` ${className}` : ""}`}>
      <header className="fety-home-card-header">
        <h2 className="fety-home-card-title">{title}</h2>
        {action}
      </header>
      <div className="fety-home-card-body">{children}</div>
    </section>
  );
}

function HomeMiniCalendar({
  store,
  selectedDateISO,
  onSelectDate,
  onOpenCalendar,
}: {
  store: FetyStore;
  selectedDateISO: string;
  onSelectDate: (dateISO: string) => void;
  onOpenCalendar: () => void;
}) {
  const [month, setMonth] = useState(() => {
    const d = new Date(`${selectedDateISO}T12:00:00`);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const y = month.getFullYear();
  const m = month.getMonth();
  const calendarMap = useMemo(() => buildCalendarMap(store, y), [store, y]);
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d));
  const today = new Date();

  const shiftMonth = (delta: number) => {
    setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  return (
    <div className="fety-home-calendar">
      <div className="fety-home-calendar-toolbar">
        <button type="button" className="fety-home-calendar-nav" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
          ‹
        </button>
        <p className="fety-home-calendar-month">
          {MONTHS[m]} {y}
        </p>
        <button type="button" className="fety-home-calendar-nav" aria-label="Next month" onClick={() => shiftMonth(1)}>
          ›
        </button>
      </div>
      <div className="fety-home-calendar-dow">
        {DAYS_SHORT.map((d) => (
          <span key={d}>{d.slice(0, 1)}</span>
        ))}
      </div>
      <div className="fety-home-calendar-grid">
        {cells.map((date, i) => {
          if (!date) return <div key={`pad-${i}`} className="fety-home-calendar-pad" aria-hidden />;
          const key = calKey(date);
          const data = calendarMap.get(key);
          const isToday = date.toDateString() === today.toDateString();
          const isSelected = key === selectedDateISO;
          return (
            <button
              key={key}
              type="button"
              className={`fety-home-calendar-day${isToday ? " fety-home-calendar-day--today" : ""}${isSelected ? " fety-home-calendar-day--selected" : ""}`}
              style={{
                background: data ? calendarEndingBalanceBg(data.endBal, false) : "var(--surface)",
              }}
              onClick={() => onSelectDate(key)}
              title={data ? `Ending ${compactUsd(data.endBal)}` : undefined}
              aria-pressed={isSelected}
            >
              <span className="fety-home-calendar-day-num">{date.getDate()}</span>
              {hasCalendarNote(store.calendarNotes, key) ? (
                <span className="fety-cal-day-note-dot" aria-hidden />
              ) : null}
              {data ? (
                <span className="fety-home-calendar-day-bal" style={{ color: calBalanceColor(data.endBal, false) }}>
                  {compactUsd(data.endBal)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <button type="button" className="fety-home-calendar-open" onClick={onOpenCalendar}>
        Open full calendar
      </button>
    </div>
  );
}

function HomeStatTile({
  label,
  value,
  tone = "neutral",
  sub,
}: {
  label: string;
  value: string;
  tone?: "neutral" | "in" | "out" | "power";
  sub?: string;
}) {
  return (
    <div className={`fety-home-stat fety-home-stat--${tone}`}>
      <p className="fety-home-stat-label">{label}</p>
      <p className="fety-home-stat-value">{value}</p>
      {sub ? <p className="fety-home-stat-sub">{sub}</p> : null}
    </div>
  );
}

function HomeStatsStack({ summary, focusDateISO }: { summary: FinanceSummary; focusDateISO: string }) {
  const dayLabel = formatDisplayDate(focusDateISO);
  return (
    <div className="fety-home-stats-stack">
      <HomeStatTile label="Balance" value={usd(summary.balance)} tone="neutral" sub="End of day · all accounts" />
      <HomeStatTile
        label="Spending power"
        value={usd(summary.weeklySpendingPower)}
        tone="power"
        sub="This week after bills"
      />
      <HomeStatTile label="Money in" value={`+${usd(summary.moneyInToday)}`} tone="in" sub={dayLabel} />
      <HomeStatTile label="Money out" value={`−${usd(summary.moneyOutToday)}`} tone="out" sub={dayLabel} />
    </div>
  );
}

export default function HomeView({
  store,
  summary,
  analysis,
  focusDateISO,
  onFocusDateChange,
  onAction,
  onMarkTipDone,
  onArchiveTip,
  onOpenCalendar,
  balanceChart,
}: {
  store: FetyStore;
  summary: FinanceSummary;
  analysis: FinancialAnalysis;
  focusDateISO: string;
  onFocusDateChange: (dateISO: string) => void;
  onAction: (action: FetyActionTarget) => void;
  onMarkTipDone: (tipId: string) => void;
  onArchiveTip: (tipId: string) => void;
  onOpenCalendar: () => void;
  balanceChart: ReactNode;
}) {
  return (
    <div className="fety-home">
      <div className="fety-home-row fety-home-row--hero">
        <HomeCard title="At a glance" className="fety-home-cell">
          <HomeStatsStack summary={summary} focusDateISO={focusDateISO} />
        </HomeCard>
        <HomeCard title="Calendar" className="fety-home-cell fety-home-span-2">
          <HomeMiniCalendar
            store={store}
            selectedDateISO={focusDateISO}
            onSelectDate={onFocusDateChange}
            onOpenCalendar={onOpenCalendar}
          />
        </HomeCard>
      </div>

      <div className="fety-home-row">
        <HomeCard title="Upcoming expenses" className="fety-home-cell">
          <UpcomingExpensesPanel store={store} onAction={onAction} focusDateISO={focusDateISO} />
        </HomeCard>
        <HomeCard title="Insights" className="fety-home-cell fety-home-span-2">
          <HomeInsightCharts analysis={analysis} summary={summary} focusDateISO={focusDateISO} />
        </HomeCard>
      </div>

      <div className="fety-home-row">
        <HomeCard title="Your notes" className="fety-home-cell">
          <NotesPanel store={store} onAction={onAction} focusDateISO={focusDateISO} />
        </HomeCard>
        <HomeCard title="Balance chart" className="fety-home-cell fety-home-span-2">
          {balanceChart}
        </HomeCard>
      </div>

      <HomeCard title="Things to try" className="fety-home-cell fety-home-span-3">
        <HomeThingsToTry
          store={store}
          analysis={analysis}
          focusDateISO={focusDateISO}
          onAction={onAction}
          onMarkDone={onMarkTipDone}
          onArchive={onArchiveTip}
        />
      </HomeCard>
    </div>
  );
}
