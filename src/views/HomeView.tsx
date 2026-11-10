import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import AddTransactionModal, {
  type AddTransactionModalActions,
  type AddTransactionPayload,
} from "../components/AddTransactionModal";
import { CalendarPeriodMenu } from "../components/CalendarPeriodMenu";
import {
  categoryActualSpendBetween,
  computeSummary,
  dateToISOLocal,
  endingBalanceOnDate,
  mergeCalendarMaps,
  todayISO,
} from "../lib/fetyCalculations";
import { calendarYearsForHomeView, shiftFocusDate, type CalView } from "../lib/calendarView";
import { analyzeStore } from "../lib/financialAnalysis";
import HomeSectionDateRangePicker from "../components/HomeSectionDateRangePicker";
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

const CALENDAR_FONT_SCALES = [0.85, 0.93, 1, 1.12, 1.24, 1.36, 1.48] as const;
const CALENDAR_FONT_STEP_DEFAULT = 2;
const CALENDAR_FONT_STEP_STORAGE = "fety-home-calendar-font-step";

function readCalendarFontStep(): number {
  if (typeof window === "undefined") return CALENDAR_FONT_STEP_DEFAULT;
  const raw = window.localStorage.getItem(CALENDAR_FONT_STEP_STORAGE);
  if (raw == null) return CALENDAR_FONT_STEP_DEFAULT;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0 || n >= CALENDAR_FONT_SCALES.length) return CALENDAR_FONT_STEP_DEFAULT;
  return n;
}

function HomeCalendarTextSizeIcon() {
  return (
    <svg className="fety-home-cal-textsize-icon" viewBox="0 0 24 24" aria-hidden focusable="false">
      <text x="3" y="17" fontSize="13" fontWeight="700" fill="currentColor">
        A
      </text>
      <text x="14" y="19" fontSize="9" fontWeight="600" fill="currentColor">
        A
      </text>
    </svg>
  );
}

function HomeCalendarTextSizeControl({
  step,
  onStepChange,
}: {
  step: number;
  onStepChange: (next: number) => void;
}) {
  const pctLabel = (scale: number) => `${Math.round(scale * 100)}%`;

  return (
    <div className="fety-home-cal-textsize" role="group" aria-label="Calendar text size">
      <span className="fety-home-cal-textsize-mark" aria-hidden>
        <HomeCalendarTextSizeIcon />
      </span>
      <label className="fety-home-cal-textsize-select-wrap">
        <span className="fety-home-cal-textsize-select-sr">Text size</span>
        <select
          className="fety-home-cal-textsize-select"
          value={step}
          aria-label="Calendar text size percentage"
          onChange={(e) => onStepChange(parseInt(e.target.value, 10))}
        >
          {CALENDAR_FONT_SCALES.map((scale, index) => (
            <option key={scale} value={index}>
              {pctLabel(scale)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

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

function coalesceSectionRangeISO(startISO: string, endISO: string, fallbackISO: string): { start: string; end: string } {
  const fb = fallbackISO || todayISO();
  if (!startISO && !endISO) return { start: fb, end: fb };
  const start = startISO || endISO || fb;
  const end = endISO || startISO || fb;
  return end >= start ? { start, end } : { start: end, end: start };
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
  onCompleteTransaction,
  onMarkTransactionUpcoming,
  onAddCalendarNote,
  onUpdateCalendarNote,
  onDeleteCalendarNote,
}: {
  store: FetyStore;
  selectedDateISO: string;
  onSelectDate: (dateISO: string) => void;
  onAddCalendarNote: (dateISO: string, text: string) => void;
  onUpdateCalendarNote: (dateISO: string, noteId: string, text: string) => void;
  onDeleteCalendarNote: (dateISO: string, noteId: string) => void;
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
  onCompleteTransaction?: (id: string, completedAtISO?: string) => void;
  onMarkTransactionUpcoming?: (id: string) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [calView, setCalView] = useState<CalView>("monthly");
  const [focusDate, setFocusDate] = useState(() => new Date(`${selectedDateISO}T12:00:00`));
  const [expandedWeekRow, setExpandedWeekRow] = useState<number | null>(null);
  const [calendarFontStep, setCalendarFontStep] = useState(readCalendarFontStep);

  const setCalendarFontStepPersisted = (next: number) => {
    const clamped = Math.max(0, Math.min(CALENDAR_FONT_SCALES.length - 1, next));
    setCalendarFontStep(clamped);
    try {
      window.localStorage.setItem(CALENDAR_FONT_STEP_STORAGE, String(clamped));
    } catch {
      /* storage unavailable */
    }
  };

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
    <section
      className="fety-home-card fety-home-cell fety-home-cell--calendar fety-home-span-2 fety-home-card--calendar"
      data-tour-id="home-calendar"
      style={{ "--fety-cal-font-scale": CALENDAR_FONT_SCALES[calendarFontStep] } as CSSProperties}
    >
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
        <div className="fety-home-calendar-font-root">
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
                onCompleteTransaction={onCompleteTransaction}
                onMarkTransactionUpcoming={onMarkTransactionUpcoming}
                onAddCalendarNote={onAddCalendarNote}
                onUpdateCalendarNote={onUpdateCalendarNote}
                onDeleteCalendarNote={onDeleteCalendarNote}
              />
            ) : null}
          </div>
        </div>
        <div className="fety-home-calendar-footer">
          <HomeCalendarColorKey />
          <HomeCalendarTextSizeControl step={calendarFontStep} onStepChange={setCalendarFontStepPersisted} />
        </div>
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
          <>No monthly cap · see Affordability in Insights for spending room</>
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
            {usd(row.monthActual)} {actualLabel} · no {plannedLabel} amount · see Affordability in Insights
          </>
        )}
      </p>
    </div>
  );
}

export function HomeAtAGlance({
  store,
  summary,
  rangeStartISO,
  rangeEndISO,
}: {
  store: FetyStore;
  summary: FinanceSummary;
  rangeStartISO: string;
  rangeEndISO: string;
}) {
  const rangeMode = rangeStartISO !== rangeEndISO;
  const focusDate = useMemo(
    () => new Date(`${(rangeEndISO >= rangeStartISO ? rangeEndISO : rangeStartISO)}T12:00:00`),
    [rangeStartISO, rangeEndISO],
  );
  const scheduledProgress = useMemo(() => computeScheduledKindProgress(store, focusDate), [store, focusDate]);
  const rangeSpendByCategory = useMemo(() => {
    if (!rangeMode) return null;
    const rows = categoryActualSpendBetween(store, rangeStartISO, rangeEndISO);
    return new Map(rows.map((r) => [r.name, r.amount]));
  }, [rangeMode, rangeStartISO, rangeEndISO, store]);
  const budgetCategories = useMemo(
    () =>
      summary.categoriesWithSpent
        .filter((c) => c.name.trim().toLowerCase() !== "housing")
        .map((c) =>
          rangeSpendByCategory
            ? { ...c, spent: rangeSpendByCategory.get(c.name) ?? 0 }
            : c,
        ),
    [summary.categoriesWithSpent, rangeSpendByCategory],
  );
  return (
    <div className="fety-home-glance">
      <div className="fety-home-stat fety-home-stat--budget">
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
  glanceSummary,
  analysis,
  focusDateISO,
  onFocusDateChange,
  onAction,
  onAddTransaction,
  addTransactionActions,
  onUpdateTransaction,
  onDeleteTransaction,
  onCompleteTransaction,
  onMarkTransactionUpcoming,
  onAddCalendarNote,
  onUpdateCalendarNote,
  onDeleteCalendarNote,
  balanceChart,
}: {
  store: FetyStore;
  summary: FinanceSummary;
  glanceSummary: FinanceSummary;
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
  onCompleteTransaction?: (id: string, completedAtISO?: string) => void;
  onMarkTransactionUpcoming?: (id: string) => void;
  onAddCalendarNote: (dateISO: string, text: string) => void;
  onUpdateCalendarNote: (dateISO: string, noteId: string, text: string) => void;
  onDeleteCalendarNote: (dateISO: string, noteId: string) => void;
  balanceChart: ReactNode;
}) {
  const [glanceOpen, setGlanceOpen] = useState(true);
  const [notesOpen, setNotesOpen] = useState(true);
  const [upcomingOpen, setUpcomingOpen] = useState(true);
  const [balanceOpen, setBalanceOpen] = useState(true);
  const [insightsOpen, setInsightsOpen] = useState(true);
  const sectionDefaultISO = todayISO();
  const [glanceStartISO, setGlanceStartISO] = useState(sectionDefaultISO);
  const [glanceEndISO, setGlanceEndISO] = useState(sectionDefaultISO);
  const [insightsStartISO, setInsightsStartISO] = useState(sectionDefaultISO);
  const [insightsEndISO, setInsightsEndISO] = useState(sectionDefaultISO);
  const upcomingAnchorISO = todayISO();

  const glanceRange = coalesceSectionRangeISO(glanceStartISO, glanceEndISO, sectionDefaultISO);
  const insightsRange = coalesceSectionRangeISO(insightsStartISO, insightsEndISO, sectionDefaultISO);
  const { start: glanceStartSafe, end: glanceEndSafe } = glanceRange;
  const { start: insightsStartSafe, end: insightsEndSafe } = insightsRange;
  const glanceFocusISO = glanceEndSafe;
  const insightsFocusISO = insightsEndSafe;

  const glanceFocusDate = useMemo(() => new Date(`${glanceFocusISO}T12:00:00`), [glanceFocusISO]);
  const insightsFocusDate = useMemo(() => new Date(`${insightsFocusISO}T12:00:00`), [insightsFocusISO]);
  const glanceSummaryForRange = useMemo(
    () => computeSummary(store, glanceFocusDate),
    [store, glanceFocusDate],
  );
  const insightsSummaryForRange = useMemo(
    () => computeSummary(store, insightsFocusDate),
    [store, insightsFocusDate],
  );
  const insightsAnalysisForRange = useMemo(
    () => analyzeStore(store, insightsFocusDate),
    [store, insightsFocusDate],
  );

  const sectionEndingBalance = useCallback(
    (dateISO: string) => endingBalanceOnDate(store, dateISO),
    [store],
  );

  const collapsePairedPanel = (collapseSelf: () => void, neighborOpen: boolean, expandNeighbor: () => void) => {
    if (!neighborOpen) expandNeighbor();
    collapseSelf();
  };

  return (
    <div className="fety-home">
      <div
        className={`fety-home-row fety-home-row--hero${notesOpen ? "" : " fety-home-row--notes-collapsed"}`}
      >
        <HomeCalendarCard
          store={store}
          selectedDateISO={focusDateISO}
          onSelectDate={onFocusDateChange}
          onAddTransaction={onAddTransaction}
          addTransactionActions={addTransactionActions}
          onUpdateTransaction={onUpdateTransaction}
          onDeleteTransaction={onDeleteTransaction}
          onCompleteTransaction={onCompleteTransaction}
          onMarkTransactionUpcoming={onMarkTransactionUpcoming}
          onAddCalendarNote={onAddCalendarNote}
          onUpdateCalendarNote={onUpdateCalendarNote}
          onDeleteCalendarNote={onDeleteCalendarNote}
        />
        <HomeCard
          label="Notes"
          focusDateISO={focusDateISO}
          className={`fety-home-cell fety-home-cell--notes${notesOpen ? "" : " fety-home-cell--collapsed"}`}
          action={
            notesOpen ? (
              <button
                type="button"
                className="fety-home-panel-toggle"
                aria-expanded
                aria-label="Collapse notes"
                onClick={() => setNotesOpen(false)}
              >
                Collapse
              </button>
            ) : undefined
          }
        >
          {notesOpen ? (
            <NotesPanel
              store={store}
              focusDateISO={focusDateISO}
              onAddNote={onAddCalendarNote}
              onUpdateNote={onUpdateCalendarNote}
              onDeleteNote={onDeleteCalendarNote}
            />
          ) : (
            <>
              <p className="fety-home-panel-collapsed-hint">
                Day notes for the selected date — expand to view or add notes.
              </p>
              <div className="fety-home-notes-rail">
                <button
                  type="button"
                  className="fety-home-panel-toggle fety-home-panel-toggle--rail fety-home-panel-toggle--rail-right"
                  aria-expanded={false}
                  aria-label="Expand notes"
                  onClick={() => setNotesOpen(true)}
                >
                  Expand
                </button>
                <span className="fety-home-notes-rail-label">Notes</span>
              </div>
            </>
          )}
        </HomeCard>
      </div>

      <div
        className={`fety-home-row fety-home-row--balance${balanceOpen ? "" : " fety-home-row--balance-collapsed"}${upcomingOpen ? "" : " fety-home-row--upcoming-collapsed"}`}
      >
        <HomeCard
          label="Balance"
          titleMode="plain"
          className={`fety-home-cell fety-home-cell--balance fety-home-span-2${balanceOpen ? "" : " fety-home-cell--collapsed"}`}
          action={
            balanceOpen ? (
              <button
                type="button"
                className="fety-home-panel-toggle"
                aria-expanded
                aria-label="Collapse balance"
                onClick={() => collapsePairedPanel(() => setBalanceOpen(false), upcomingOpen, () => setUpcomingOpen(true))}
              >
                Collapse
              </button>
            ) : undefined
          }
        >
          {balanceOpen ? (
            balanceChart
          ) : (
            <>
              <p className="fety-home-panel-collapsed-hint">
                Ending balance and account breakdown — expand to view the chart.
              </p>
              <div className="fety-home-balance-rail">
                <button
                  type="button"
                  className="fety-home-panel-toggle fety-home-panel-toggle--rail"
                  aria-expanded={false}
                  aria-label="Expand balance"
                  onClick={() => setBalanceOpen(true)}
                >
                  Expand
                </button>
                <span className="fety-home-balance-rail-label">Balance</span>
              </div>
            </>
          )}
        </HomeCard>
        <HomeCard
          label="Upcoming expenses"
          titleMode="plain"
          className={`fety-home-cell fety-home-cell--upcoming${upcomingOpen ? "" : " fety-home-cell--collapsed"}`}
          action={
            upcomingOpen ? (
              <button
                type="button"
                className="fety-home-panel-toggle"
                aria-expanded
                aria-label="Collapse upcoming expenses"
                onClick={() => collapsePairedPanel(() => setUpcomingOpen(false), balanceOpen, () => setBalanceOpen(true))}
              >
                Collapse
              </button>
            ) : undefined
          }
        >
          {upcomingOpen ? (
            <UpcomingExpensesPanel store={store} onAction={onAction} focusDateISO={upcomingAnchorISO} />
          ) : (
            <>
              <p className="fety-home-panel-collapsed-hint">
                Bills and recurring charges ahead — expand to review what&apos;s coming up.
              </p>
              <div className="fety-home-upcoming-rail">
                <button
                  type="button"
                  className="fety-home-panel-toggle fety-home-panel-toggle--rail fety-home-panel-toggle--rail-right"
                  aria-expanded={false}
                  aria-label="Expand upcoming expenses"
                  onClick={() => setUpcomingOpen(true)}
                >
                  Expand
                </button>
                <span className="fety-home-upcoming-rail-label">Upcoming</span>
              </div>
            </>
          )}
        </HomeCard>
      </div>

      <div
        className={`fety-home-row fety-home-row--insights${glanceOpen ? "" : " fety-home-row--glance-collapsed"}${insightsOpen ? "" : " fety-home-row--insights-collapsed"}`}
      >
        <HomeCard
          label="At a glance"
          titleMode="plain"
          className={`fety-home-cell fety-home-cell--glance${glanceOpen ? "" : " fety-home-cell--collapsed"}`}
          action={
            glanceOpen ? (
              <div className="fety-home-card-header-actions">
                <HomeSectionDateRangePicker
                  rangeStartISO={glanceStartISO}
                  rangeEndISO={glanceEndISO}
                  onRangeChange={(start, end) => {
                    const next = coalesceSectionRangeISO(start, end, sectionDefaultISO);
                    setGlanceStartISO(next.start);
                    setGlanceEndISO(next.end);
                  }}
                  endingBalanceForDate={sectionEndingBalance}
                />
                <button
                  type="button"
                  className="fety-home-panel-toggle"
                  aria-expanded
                  aria-label="Collapse at a glance"
                  onClick={() => collapsePairedPanel(() => setGlanceOpen(false), insightsOpen, () => setInsightsOpen(true))}
                >
                  Collapse
                </button>
              </div>
            ) : undefined
          }
        >
          {glanceOpen ? (
            <HomeAtAGlance
              store={store}
              summary={glanceSummaryForRange}
              rangeStartISO={glanceStartSafe}
              rangeEndISO={glanceEndSafe}
            />
          ) : (
            <>
              <p className="fety-home-panel-collapsed-hint">
                Monthly budget and scheduled activity — expand to see category progress for the current month.
              </p>
              <div className="fety-home-glance-rail">
                <button
                  type="button"
                  className="fety-home-panel-toggle fety-home-panel-toggle--rail"
                  aria-expanded={false}
                  aria-label="Expand at a glance"
                  onClick={() => setGlanceOpen(true)}
                >
                  Expand
                </button>
                <span className="fety-home-glance-rail-label">At a glance</span>
              </div>
            </>
          )}
        </HomeCard>
        <HomeCard
          label="Insights"
          titleMode="plain"
          className={`fety-home-cell fety-home-cell--insights fety-home-span-2${insightsOpen ? "" : " fety-home-cell--collapsed"}`}
          bodyClassName="fety-home-card-body--insights"
          action={
            insightsOpen ? (
              <div className="fety-home-card-header-actions">
                <HomeSectionDateRangePicker
                  rangeStartISO={insightsStartISO}
                  rangeEndISO={insightsEndISO}
                  onRangeChange={(start, end) => {
                    const next = coalesceSectionRangeISO(start, end, sectionDefaultISO);
                    setInsightsStartISO(next.start);
                    setInsightsEndISO(next.end);
                  }}
                  endingBalanceForDate={sectionEndingBalance}
                />
                <button
                  type="button"
                  className="fety-home-panel-toggle"
                  aria-expanded
                  aria-label="Collapse insights"
                  onClick={() => collapsePairedPanel(() => setInsightsOpen(false), glanceOpen, () => setGlanceOpen(true))}
                >
                  Collapse
                </button>
              </div>
            ) : undefined
          }
        >
          {insightsOpen ? (
            <HomeInsightCharts
              analysis={insightsAnalysisForRange}
              summary={insightsSummaryForRange}
              store={store}
              focusDateISO={insightsFocusISO}
              rangeStartISO={insightsStartSafe}
              rangeEndISO={insightsEndSafe}
            />
          ) : (
            <>
              <p className="fety-home-panel-collapsed-hint">
                Income, budget mix, and affordability — expand to view charts.
              </p>
              <div className="fety-home-insights-rail">
                <button
                  type="button"
                  className="fety-home-panel-toggle fety-home-panel-toggle--rail fety-home-panel-toggle--rail-right"
                  aria-expanded={false}
                  aria-label="Expand insights"
                  onClick={() => setInsightsOpen(true)}
                >
                  Expand
                </button>
                <span className="fety-home-insights-rail-label">Insights</span>
              </div>
            </>
          )}
        </HomeCard>
      </div>
    </div>
  );
}
