import { useMemo, useState, type ReactNode } from "react";
import AddTransactionModal, { type AddTransactionPayload } from "../components/AddTransactionModal";
import { buildCalendarMap, dateToISOLocal, todayISO } from "../lib/fetyCalculations";
import { calendarEndingBalanceBg, calBalanceColor, calSignedColor } from "../lib/calendarUi";
import { hasCalendarNote } from "../lib/calendarNotes";
import type { FinancialAnalysis, FetyActionTarget } from "../types/analysis";
import type { CalDayItem, CalendarMap, FetyStore, FinanceSummary } from "../types/fety";
import HomeInsightCharts from "./HomeInsightCharts";
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

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function compactUsd(n: number) {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 10000) return `${sign}$${(abs / 1000).toFixed(0)}k`;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return sign + usd(abs);
}

function homeCalItemLabel(item: CalDayItem): string {
  const name = item.desc.trim() || item.category || "Transaction";
  if (item.type === "bill") return `${name} due`;
  return name;
}

function homeCalItemAmount(amount: number): string {
  const abs = Math.abs(amount);
  const dollars = usd(abs);
  if (amount > 0) return `+${dollars}`;
  if (amount < 0) return `-${dollars}`;
  return dollars;
}

/** Max transaction lines shown per day before the row expands. */
const HOME_CAL_TX_MAX_COLLAPSED = 3;
const HOME_CAL_ROW_MIN_PX = 86;
const HOME_CAL_ROW_LINE_PX = 12;

function maxTxCountInCalendarRow(cells: (Date | null)[], weekIndex: number, calendarMap: CalendarMap): number {
  let max = 0;
  for (let col = 0; col < 7; col++) {
    const idx = weekIndex * 7 + col;
    const date = cells[idx];
    if (!date) continue;
    const key = dateToISOLocal(date);
    max = Math.max(max, calendarMap.get(key)?.items.length ?? 0);
  }
  return max;
}

function homeCalendarGridTemplateRows(
  cells: (Date | null)[],
  expandedWeekRow: number | null,
  calendarMap: CalendarMap,
): string | undefined {
  if (expandedWeekRow === null) return undefined;
  const weeks = Math.ceil(cells.length / 7);
  return Array.from({ length: weeks }, (_, w) => {
    if (w !== expandedWeekRow) return `minmax(${HOME_CAL_ROW_MIN_PX}px, 1fr)`;
    const maxItems = maxTxCountInCalendarRow(cells, w, calendarMap);
    const extra = Math.max(0, maxItems - HOME_CAL_TX_MAX_COLLAPSED);
    const h = HOME_CAL_ROW_MIN_PX + extra * HOME_CAL_ROW_LINE_PX + (extra > 0 ? 16 : 0);
    return `minmax(${h}px, ${h}px)`;
  }).join(" ");
}

const HOME_AS_OF_MONTHS = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];

function formatHomeDateBadge(focusDateISO: string): string {
  const d = new Date(`${focusDateISO}T12:00:00`);
  if (Number.isNaN(d.getTime())) return focusDateISO;
  const month = d.toLocaleDateString("en-US", { month: "short" }).replace(".", "").toUpperCase();
  return `${month} ${d.getDate()}`;
}

function formatHomeAsOf(focusDateISO: string): string {
  const d = new Date(`${focusDateISO}T12:00:00`);
  if (Number.isNaN(d.getTime())) return `as of ${focusDateISO}`;
  const today = todayISO();
  let label = `${HOME_AS_OF_MONTHS[d.getMonth()]} ${d.getDate()}`;
  if (focusDateISO.slice(0, 4) !== today.slice(0, 4)) {
    label = `${label}, ${d.getFullYear()}`;
  }
  return `as of ${label}`;
}

type HomeCardTitleMode = "dated" | "plain" | "asOf";

function HomeCardTitle({
  label,
  focusDateISO,
  titleMode,
}: {
  label: string;
  focusDateISO?: string;
  titleMode: HomeCardTitleMode;
}) {
  if (titleMode === "plain") {
    return <h2 className="fety-home-card-title">{label}</h2>;
  }
  if (titleMode === "asOf" && focusDateISO) {
    return (
      <h2 className="fety-home-card-title fety-home-card-title--split">
        <span>{label}</span>
        <span className="fety-home-card-title-asof">{formatHomeAsOf(focusDateISO)}</span>
      </h2>
    );
  }
  if (!focusDateISO) {
    return <h2 className="fety-home-card-title">{label}</h2>;
  }
  return (
    <h2 className="fety-home-card-title">
      <span className="fety-home-card-title-date">{formatHomeDateBadge(focusDateISO)}</span>
      <span className="fety-home-card-title-sep" aria-hidden>
        |
      </span>
      <span>{label}</span>
    </h2>
  );
}

function HomeCard({
  label,
  focusDateISO,
  titleMode = "dated",
  action,
  children,
  className,
  bodyClassName,
}: {
  label: string;
  focusDateISO?: string;
  titleMode?: HomeCardTitleMode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`fety-home-card${className ? ` ${className}` : ""}`}>
      <header className="fety-home-card-header">
        <HomeCardTitle label={label} focusDateISO={focusDateISO} titleMode={titleMode} />
        {action}
      </header>
      <div className={`fety-home-card-body${bodyClassName ? ` ${bodyClassName}` : ""}`}>{children}</div>
    </section>
  );
}

function HomeCalendarCard({
  store,
  selectedDateISO,
  onSelectDate,
  onOpenCalendarDay,
}: {
  store: FetyStore;
  selectedDateISO: string;
  onSelectDate: (dateISO: string) => void;
  onOpenCalendarDay: (dateISO: string) => void;
}) {
  const [month, setMonth] = useState(() => {
    const d = new Date(`${selectedDateISO}T12:00:00`);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [expandedWeekRow, setExpandedWeekRow] = useState<number | null>(null);

  const y = month.getFullYear();
  const m = month.getMonth();
  const calendarMap = useMemo(() => buildCalendarMap(store, y), [store, y]);
  const cells = useMemo(() => {
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const arr: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(y, m, d));
    return arr;
  }, [y, m]);
  const today = new Date();

  const shiftMonth = (delta: number) => {
    setExpandedWeekRow(null);
    setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const jumpToToday = () => {
    const now = new Date();
    onSelectDate(todayISO());
    setExpandedWeekRow(null);
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const gridTemplateRows = useMemo(
    () => homeCalendarGridTemplateRows(cells, expandedWeekRow, calendarMap),
    [cells, expandedWeekRow, calendarMap],
  );

  return (
    <section className="fety-home-card fety-home-cell fety-home-span-2 fety-home-card--calendar">
      <header className="fety-home-card-header fety-home-card-header--calendar">
        <div className="fety-home-calendar-toolbar-nav">
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
        <button type="button" className="fety-home-calendar-today" onClick={jumpToToday} aria-label="Jump to today">
          Today
        </button>
      </header>
      <div className="fety-home-card-body fety-home-card-body--calendar">
        <div className="fety-home-calendar">
      <div className="fety-home-calendar-dow">
        {DAYS_SHORT.map((d) => (
          <span key={d}>{d.slice(0, 1)}</span>
        ))}
      </div>
      <div
        className={`fety-home-calendar-grid${expandedWeekRow !== null ? " fety-home-calendar-grid--row-expanded" : ""}`}
        style={gridTemplateRows ? { gridTemplateRows } : undefined}
      >
        {cells.map((date, i) => {
          if (!date) return <div key={`pad-${i}`} className="fety-home-calendar-pad" aria-hidden />;
          const key = dateToISOLocal(date);
          const data = calendarMap.get(key);
          const isToday = date.toDateString() === today.toDateString();
          const isSelected = key === selectedDateISO;
          const endBal = data?.endBal ?? 0;
          const dayIcons = data?.items ?? [];
          const weekRow = Math.floor(i / 7);
          const rowExpanded = expandedWeekRow === weekRow;
          const hasHiddenTx = dayIcons.length > HOME_CAL_TX_MAX_COLLAPSED;
          const visibleIcons = rowExpanded ? dayIcons : dayIcons.slice(0, HOME_CAL_TX_MAX_COLLAPSED);
          return (
            <div
              key={key}
              className={`fety-home-calendar-day${isToday ? " fety-home-calendar-day--today" : ""}${isSelected ? " fety-home-calendar-day--selected" : ""}${rowExpanded ? " fety-home-calendar-day--expanded" : ""}`}
              style={{
                background: data || isSelected ? calendarEndingBalanceBg(endBal, isSelected) : "var(--surface)",
              }}
            >
              {isSelected ? (
                <button
                  type="button"
                  className="fety-home-calendar-day-open"
                  aria-label={`Open ${key} in calendar day view`}
                  title="Open in day view"
                  onClick={() => onOpenCalendarDay(key)}
                >
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
                    <path
                      d="M5 7H3.5a1 1 0 01-1-1V3.5a1 1 0 011-1H7a1 1 0 011 1V5"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M7 3h2.5V5.5M9.5 2.5 5.5 6.5"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              ) : null}
              <button
                type="button"
                className="fety-home-calendar-day-main"
                onClick={() => onSelectDate(key)}
                title={data ? `Ending ${compactUsd(data.endBal)}` : undefined}
                aria-pressed={isSelected}
              >
                <span className="fety-home-calendar-day-top">
                  <span className="fety-home-calendar-day-num">{date.getDate()}</span>
                  {hasCalendarNote(store.calendarNotes, key) ? (
                    <span className="fety-cal-day-note-dot" aria-hidden />
                  ) : null}
                </span>
                {dayIcons.length > 0 ? (
                  <ul
                    className={`fety-home-calendar-day-items${rowExpanded ? " fety-home-calendar-day-items--expanded" : ""}`}
                  >
                    {visibleIcons.map((item) => (
                      <li key={item.id} className="fety-home-calendar-day-item">
                        <span className="fety-home-calendar-day-item-icon" aria-hidden>
                          {item.icon}
                        </span>
                        <span className="fety-home-calendar-day-item-text">{homeCalItemLabel(item)}</span>
                        <span
                          className="fety-home-calendar-day-item-amt"
                          style={{ color: calSignedColor(item.amount, isSelected) }}
                        >
                          {homeCalItemAmount(item.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </button>
              {data || hasHiddenTx ? (
                <div className="fety-home-calendar-day-foot">
                  {data ? (
                    <span className="fety-home-calendar-day-bal" style={{ color: calBalanceColor(data.endBal, isSelected) }}>
                      {compactUsd(data.endBal)}
                    </span>
                  ) : (
                    <span className="fety-home-calendar-day-foot-spacer" aria-hidden />
                  )}
                  {hasHiddenTx ? (
                    <button
                      type="button"
                      className="fety-home-calendar-day-more"
                      onClick={() => setExpandedWeekRow(rowExpanded ? null : weekRow)}
                      aria-expanded={rowExpanded}
                    >
                      {rowExpanded ? "Less" : `More (${dayIcons.length - HOME_CAL_TX_MAX_COLLAPSED})`}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
        </div>
      </div>
    </section>
  );
}

function budgetBarMeta(spent: number, budget: number) {
  const budgetUsedPct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
  const budgetOver = spent > budget;
  const budgetLeft = budget - spent;
  return { budgetUsedPct, budgetOver, budgetLeft };
}

function HomeBudgetProgressRow({
  name,
  icon,
  spent,
  budget,
  allBudgets,
}: {
  name: string;
  icon?: string;
  spent: number;
  budget: number;
  allBudgets?: boolean;
}) {
  const { budgetUsedPct, budgetOver, budgetLeft } = budgetBarMeta(spent, budget);
  const fillClass =
    budgetOver ? " fety-home-budget-bar-fill--over" : budgetUsedPct >= 80 ? " fety-home-budget-bar-fill--warn" : "";

  return (
    <div className={`fety-home-budget-row${allBudgets ? " fety-home-budget-row--all" : ""}`}>
      <div className="fety-home-budget-row-head">
        <span className="fety-home-budget-row-name">
          {icon ? `${icon} ` : null}
          {name}
        </span>
        <span className={`fety-home-budget-row-left${budgetOver ? " fety-home-budget-row-left--over" : ""}`}>
          {budgetOver ? `${usd(Math.abs(budgetLeft))} over` : `${usd(Math.max(0, budgetLeft))} left`}
        </span>
      </div>
      <div className="fety-home-budget-bar" role="progressbar" aria-valuenow={budgetUsedPct} aria-valuemin={0} aria-valuemax={100}>
        <div className={`fety-home-budget-bar-fill${fillClass}`} style={{ width: `${budgetUsedPct}%` }} />
      </div>
      <p className="fety-home-budget-row-meta">
        {usd(spent)} spent · {usd(budget)} cap
      </p>
    </div>
  );
}

function HomeAtAGlance({
  store,
  summary,
  focusDateISO,
  onAddTransaction,
}: {
  store: FetyStore;
  summary: FinanceSummary;
  focusDateISO: string;
  onAddTransaction: (input: AddTransactionPayload) => void;
}) {
  const categories = summary.categoriesWithSpent;
  const totalSpent = categories.reduce((s, c) => s + c.spent, 0);
  const totalBudget = categories.reduce((s, c) => s + c.monthlyBudget, 0);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="fety-home-glance">
      <div className="fety-home-stat fety-home-stat--budget">
        <div className="fety-home-stat-head">
          <p className="fety-home-stat-label">Budget balance</p>
          <button type="button" className="fety-home-add-tx" onClick={() => setAddOpen(true)}>
            Add transaction
          </button>
        </div>
        {categories.length === 0 ? (
          <p className="fety-home-stat-sub">Add categories in Budget to track caps here.</p>
        ) : (
          <div className="fety-home-budget-scroll">
            <HomeBudgetProgressRow name="All budgets" spent={totalSpent} budget={totalBudget} allBudgets />
            {categories.map((c) => (
              <HomeBudgetProgressRow key={c.id} name={c.name} icon={c.icon} spent={c.spent} budget={c.monthlyBudget} />
            ))}
          </div>
        )}
      </div>
      <AddTransactionModal
        open={addOpen}
        dateISO={focusDateISO}
        store={store}
        onClose={() => setAddOpen(false)}
        onSubmit={onAddTransaction}
      />
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
  onAddTransaction,
  onOpenCalendarDay,
  onAddCalendarNote,
  onDeleteCalendarNote,
  balanceChart,
}: {
  store: FetyStore;
  summary: FinanceSummary;
  analysis: FinancialAnalysis;
  focusDateISO: string;
  onFocusDateChange: (dateISO: string) => void;
  onAction: (action: FetyActionTarget) => void;
  onAddTransaction: (input: AddTransactionPayload) => void;
  onOpenCalendarDay: (dateISO: string) => void;
  onAddCalendarNote: (dateISO: string, text: string) => void;
  onDeleteCalendarNote: (dateISO: string, noteId: string) => void;
  balanceChart: ReactNode;
}) {
  return (
    <div className="fety-home">
      <div className="fety-home-row fety-home-row--hero">
        <HomeCard label="At a glance" focusDateISO={focusDateISO} className="fety-home-cell">
          <HomeAtAGlance
            store={store}
            summary={summary}
            focusDateISO={focusDateISO}
            onAddTransaction={onAddTransaction}
          />
        </HomeCard>
        <HomeCalendarCard
          store={store}
          selectedDateISO={focusDateISO}
          onSelectDate={onFocusDateChange}
          onOpenCalendarDay={onOpenCalendarDay}
        />
      </div>

      <div className="fety-home-row">
        <HomeCard label="Upcoming expenses" focusDateISO={focusDateISO} titleMode="asOf" className="fety-home-cell">
          <UpcomingExpensesPanel store={store} onAction={onAction} focusDateISO={focusDateISO} />
        </HomeCard>
        <HomeCard
          label="Insights"
          focusDateISO={focusDateISO}
          titleMode="asOf"
          className="fety-home-cell fety-home-span-2"
          bodyClassName="fety-home-card-body--insights"
        >
          <HomeInsightCharts
            analysis={analysis}
            summary={summary}
            store={store}
            focusDateISO={focusDateISO}
          />
        </HomeCard>
      </div>

      <div className="fety-home-row">
        <HomeCard label="Notes" focusDateISO={focusDateISO} className="fety-home-cell">
          <NotesPanel
            store={store}
            focusDateISO={focusDateISO}
            onAddNote={onAddCalendarNote}
            onDeleteNote={onDeleteCalendarNote}
          />
        </HomeCard>
        <HomeCard label="Balance" focusDateISO={focusDateISO} className="fety-home-cell fety-home-span-2">
          {balanceChart}
        </HomeCard>
      </div>
    </div>
  );
}
