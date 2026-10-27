import { useEffect, useMemo, useState, type ReactNode } from "react";
import AddTransactionModal, {
  type AddTransactionModalActions,
  type AddTransactionPayload,
} from "../components/AddTransactionModal";
import { CalendarPeriodMenu } from "../components/CalendarPeriodMenu";
import { dateToISOLocal } from "../lib/fetyCalculations";
import { calendarYearsForHomeView, shiftFocusDate, type CalView } from "../lib/calendarView";
import { endingBalanceOnDate, mergeCalendarMaps, todayISO } from "../lib/fetyCalculations";
import {
  HomeCalendarDailyGrid,
  HomeCalendarMonthGrid,
  HomeCalendarWeekGrid,
} from "./calendar/HomeCalendarViewGrids";
import HomeCalendarColorKey from "./calendar/HomeCalendarColorKey";
import HomeCalendarViewSwitch from "./calendar/HomeCalendarViewSwitch";
import type { FinancialAnalysis, FetyActionTarget } from "../types/analysis";
import { computeScheduledKindProgress, type ScheduledKindProgressRow } from "../lib/scheduledKindProgress";
import type { FetyStore, FinanceSummary } from "../types/fety";
import HomeInsightCharts from "./HomeInsightCharts";
import { NotesPanel, UpcomingExpensesPanel } from "./homePanels";

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

const HOME_AS_OF_MONTHS = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];

function formatHomeDateBadge(focusDateISO: string): string {
  const d = new Date(`${focusDateISO}T12:00:00`);
  if (Number.isNaN(d.getTime())) return focusDateISO;
  const month = d.toLocaleDateString("en-US", { month: "short" }).replace(".", "").toUpperCase();
  return `${month} ${d.getDate()}`;
}

function formatHomeDateContext(focusDateISO: string): string {
  const d = new Date(`${focusDateISO}T12:00:00`);
  if (Number.isNaN(d.getTime())) return focusDateISO;
  const today = todayISO();
  let label = `${HOME_AS_OF_MONTHS[d.getMonth()]} ${d.getDate()}`;
  if (focusDateISO.slice(0, 4) !== today.slice(0, 4)) {
    label = `${label}, ${d.getFullYear()}`;
  }
  return label;
}

function formatHomeAsOf(focusDateISO: string): string {
  return `as of ${formatHomeDateContext(focusDateISO)}`;
}

function formatHomeNear(focusDateISO: string): string {
  return `near ${formatHomeDateContext(focusDateISO)}`;
}

function formatHomeBy(focusDateISO: string): string {
  return `by ${formatHomeDateContext(focusDateISO)}`;
}

type HomeCardTitleMode = "dated" | "plain" | "asOf" | "near" | "by";

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
  if ((titleMode === "asOf" || titleMode === "near" || titleMode === "by") && focusDateISO) {
    const contextLabel =
      titleMode === "near"
        ? formatHomeNear(focusDateISO)
        : titleMode === "by"
          ? formatHomeBy(focusDateISO)
          : formatHomeAsOf(focusDateISO);
    return (
      <h2 className="fety-home-card-title fety-home-card-title--split">
        <span>{label}</span>
        <span className="fety-home-card-title-asof">{contextLabel}</span>
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
  onAddTransaction,
  addTransactionActions,
  onUpdateTransaction,
  onDeleteTransaction,
}: {
  store: FetyStore;
  selectedDateISO: string;
  onSelectDate: (dateISO: string) => void;
  onAddTransaction: (input: AddTransactionPayload) => void;
  addTransactionActions?: AddTransactionModalActions;
  onUpdateTransaction: (
    id: string,
    updates: Partial<
      Pick<
        import("../types/fety").Transaction,
        "desc" | "amount" | "type" | "category" | "dateISO" | "fromAccountId" | "toAccountId" | "goalId"
      >
    >,
  ) => void;
  onDeleteTransaction: (id: string) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [calView, setCalView] = useState<CalView>("monthly");
  const [focusDate, setFocusDate] = useState(() => new Date(`${selectedDateISO}T12:00:00`));
  const [expandedWeekRow, setExpandedWeekRow] = useState<number | null>(null);

  useEffect(() => {
    setFocusDate(new Date(`${selectedDateISO}T12:00:00`));
  }, [selectedDateISO]);

  const y = focusDate.getFullYear();
  const m = focusDate.getMonth();
  const calendarYears = useMemo(() => calendarYearsForHomeView(calView, focusDate), [calView, focusDate]);
  const calendarMap = useMemo(() => mergeCalendarMaps(store, calendarYears), [store, calendarYears]);
  const endingBalanceForDate = useMemo(
    () => (dateISO: string) => calendarMap.get(dateISO)?.endBal ?? endingBalanceOnDate(store, dateISO),
    [calendarMap, store],
  );

  const openDayAtHome = (dateISO: string) => {
    onSelectDate(dateISO);
    setFocusDate(new Date(`${dateISO}T12:00:00`));
    setCalView("daily");
  };
  const today = new Date();

  const navPeriod = (delta: -1 | 1) => {
    setExpandedWeekRow(null);
    setFocusDate((prev) => shiftFocusDate(calView, prev, delta));
  };

  const jumpToToday = () => {
    const now = new Date();
    onSelectDate(todayISO());
    setExpandedWeekRow(null);
    setFocusDate(now);
  };

  const selectDay = (dateISO: string) => {
    onSelectDate(dateISO);
    setFocusDate(new Date(`${dateISO}T12:00:00`));
  };

  return (
    <section className="fety-home-card fety-home-cell fety-home-span-2 fety-home-card--calendar" data-tour-id="home-calendar">
      <header className="fety-home-card-header fety-home-card-header--calendar">
        <div className="fety-home-calendar-toolbar-nav">
          <button
            type="button"
            className="fety-home-calendar-nav"
            aria-label="Previous period"
            onClick={() => navPeriod(-1)}
          >
            ‹
          </button>
          <CalendarPeriodMenu
            variant="home"
            calView={calView}
            focusDate={focusDate}
            year={y}
            endingBalanceForDate={endingBalanceForDate}
            onFocusDate={(d) => {
              setExpandedWeekRow(null);
              setFocusDate(d);
              if (calView === "daily") onSelectDate(dateToISOLocal(d));
            }}
          />
          <button type="button" className="fety-home-calendar-nav" aria-label="Next period" onClick={() => navPeriod(1)}>
            ›
          </button>
          <button type="button" className="fety-home-calendar-today" onClick={jumpToToday} aria-label="Jump to today">
            Today
          </button>
        </div>
        <button type="button" className="fety-home-add-tx fety-home-add-tx--calendar" onClick={() => setAddOpen(true)}>
          Add transaction
        </button>
      </header>
      <div className="fety-home-card-body fety-home-card-body--calendar">
        <HomeCalendarViewSwitch
          value={calView}
          onChange={(view) => {
            setExpandedWeekRow(null);
            setCalView(view);
          }}
        />
        <div className={`fety-home-calendar-scroll fety-home-calendar-scroll--${calView}`}>
          {calView === "monthly" ? (
            <HomeCalendarMonthGrid
              year={y}
              month={m}
              calendarMap={calendarMap}
              store={store}
              selectedDateISO={selectedDateISO}
              expandedWeekRow={expandedWeekRow}
              onToggleWeekRow={setExpandedWeekRow}
              onSelectDay={selectDay}
              onOpenDay={openDayAtHome}
              today={today}
            />
          ) : null}
          {calView === "weekly" ? (
            <HomeCalendarWeekGrid
              anchor={focusDate}
              days={7}
              calendarMap={calendarMap}
              store={store}
              selectedDateISO={selectedDateISO}
              onSelectDay={selectDay}
              onOpenDay={openDayAtHome}
              today={today}
            />
          ) : null}
          {calView === "biweekly" ? (
            <HomeCalendarWeekGrid
              anchor={focusDate}
              days={14}
              calendarMap={calendarMap}
              store={store}
              selectedDateISO={selectedDateISO}
              onSelectDay={selectDay}
              onOpenDay={openDayAtHome}
              today={today}
            />
          ) : null}
          {calView === "daily" ? (
            <HomeCalendarDailyGrid
              date={focusDate}
              calendarMap={calendarMap}
              store={store}
              selectedDateISO={selectedDateISO}
              onSelectDay={selectDay}
              today={today}
              onUpdateTransaction={onUpdateTransaction}
              onDeleteTransaction={onDeleteTransaction}
            />
          ) : null}
        </div>
        <HomeCalendarColorKey />
      </div>
      <AddTransactionModal
        open={addOpen}
        dateISO={selectedDateISO}
        store={store}
        onClose={() => setAddOpen(false)}
        onSubmit={onAddTransaction}
        actions={addTransactionActions}
      />
    </section>
  );
}

function budgetBarMeta(spent: number, budget: number) {
  const budgetUsedPct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
  const budgetOver = spent > budget;
  const budgetLeft = budget - spent;
  return { budgetUsedPct, budgetOver, budgetLeft };
}

function scheduledProgressHead(row: ScheduledKindProgressRow, budgetOver: boolean, budgetLeft: number): string {
  if (row.monthlyScheduled <= 0 && row.monthActual <= 0) return "—";
  if (row.monthlyScheduled <= 0) return usd(row.monthActual);
  if (budgetOver) {
    return row.kind === "income"
      ? `${usd(Math.abs(budgetLeft))} over plan`
      : `${usd(Math.abs(budgetLeft))} over`;
  }
  if (row.kind === "income") return `${usd(Math.max(0, budgetLeft))} to earn`;
  return `${usd(Math.max(0, budgetLeft))} to pay`;
}

function HomeBudgetProgressRow({
  name,
  icon,
  spent,
  budget,
}: {
  name: string;
  icon?: string;
  spent: number;
  budget: number;
}) {
  const { budgetUsedPct, budgetOver, budgetLeft } = budgetBarMeta(spent, budget);
  const fillClass =
    budgetOver ? " fety-home-budget-bar-fill--over" : budgetUsedPct >= 80 ? " fety-home-budget-bar-fill--warn" : "";

  return (
    <div className="fety-home-budget-row">
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
        {budget > 0 ? (
          <>
            {usd(spent)} spent · {usd(budget)} cap
          </>
        ) : (
          <>No monthly cap · flexible spending power is in Insights (uses calendar balances)</>
        )}
      </p>
    </div>
  );
}

function HomeScheduledProgressRow({ row }: { row: ScheduledKindProgressRow }) {
  const { budgetUsedPct, budgetOver, budgetLeft } = budgetBarMeta(row.monthActual, row.monthlyScheduled);
  const fillClass =
    budgetOver ? " fety-home-budget-bar-fill--over" : budgetUsedPct >= 80 ? " fety-home-budget-bar-fill--warn" : "";
  const actualLabel = row.kind === "income" ? "earned" : "paid";
  const plannedLabel = row.kind === "income" ? "planned" : "scheduled";

  return (
    <div className="fety-home-budget-row">
      <div className="fety-home-budget-row-head">
        <span className="fety-home-budget-row-name">
          {row.icon} {row.label}
        </span>
        <span className={`fety-home-budget-row-left${budgetOver ? " fety-home-budget-row-left--over" : ""}`}>
          {scheduledProgressHead(row, budgetOver, budgetLeft)}
        </span>
      </div>
      <div
        className="fety-home-budget-bar"
        role="progressbar"
        aria-valuenow={budgetUsedPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${row.label} this month`}
      >
        <div className={`fety-home-budget-bar-fill${fillClass}`} style={{ width: `${budgetUsedPct}%` }} />
      </div>
      <p className="fety-home-budget-row-meta">
        {row.monthlyScheduled > 0 ? (
          <>
            {usd(row.monthActual)} {actualLabel} · {usd(row.monthlyScheduled)} {plannedLabel}
          </>
        ) : (
          <>
            {usd(row.monthActual)} {actualLabel} · no {plannedLabel} amount · see Spending power in Insights
          </>
        )}
      </p>
    </div>
  );
}

function HomeAtAGlance({
  store,
  summary,
  focusDateISO,
}: {
  store: FetyStore;
  summary: FinanceSummary;
  focusDateISO: string;
}) {
  const focusDate = useMemo(() => new Date(`${focusDateISO}T12:00:00`), [focusDateISO]);
  const scheduledProgress = useMemo(() => computeScheduledKindProgress(store, focusDate), [store, focusDate]);
  const budgetCategories = useMemo(
    () => summary.categoriesWithSpent.filter((c) => c.name.trim().toLowerCase() !== "housing"),
    [summary.categoriesWithSpent],
  );

  return (
    <div className="fety-home-glance">
      <div className="fety-home-stat fety-home-stat--budget">
        <div className="fety-home-stat-head">
          <p className="fety-home-stat-label">Budget balance</p>
        </div>
        <div className="fety-home-budget-scroll">
          {scheduledProgress.map((row) => (
            <HomeScheduledProgressRow key={row.kind} row={row} />
          ))}
          {budgetCategories.map((c) => (
            <HomeBudgetProgressRow key={c.id} name={c.name} icon={c.icon} spent={c.spent} budget={c.monthlyBudget} />
          ))}
        </div>
      </div>
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
  addTransactionActions,
  onUpdateTransaction,
  onDeleteTransaction,
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
  addTransactionActions?: AddTransactionModalActions;
  onUpdateTransaction: (
    id: string,
    updates: Partial<
      Pick<
        import("../types/fety").Transaction,
        "desc" | "amount" | "type" | "category" | "dateISO" | "fromAccountId" | "toAccountId" | "goalId"
      >
    >,
  ) => void;
  onDeleteTransaction: (id: string) => void;
  onAddCalendarNote: (dateISO: string, text: string) => void;
  onDeleteCalendarNote: (dateISO: string, noteId: string) => void;
  balanceChart: ReactNode;
}) {
  return (
    <div className="fety-home">
      <div className="fety-home-row fety-home-row--hero">
        <HomeCard label="At a glance" focusDateISO={focusDateISO} className="fety-home-cell">
          <HomeAtAGlance store={store} summary={summary} focusDateISO={focusDateISO} />
        </HomeCard>
        <HomeCalendarCard
          store={store}
          selectedDateISO={focusDateISO}
          onSelectDate={onFocusDateChange}
          onAddTransaction={onAddTransaction}
          addTransactionActions={addTransactionActions}
          onUpdateTransaction={onUpdateTransaction}
          onDeleteTransaction={onDeleteTransaction}
        />
      </div>

      <div className="fety-home-row">
        <HomeCard label="Upcoming expenses" focusDateISO={focusDateISO} titleMode="near" className="fety-home-cell">
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
        <HomeCard
          label="Balance"
          focusDateISO={focusDateISO}
          titleMode="by"
          className="fety-home-cell fety-home-span-2"
        >
          {balanceChart}
        </HomeCard>
      </div>
    </div>
  );
}
