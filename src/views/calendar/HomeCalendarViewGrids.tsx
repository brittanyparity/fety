import type { CSSProperties, ReactNode } from "react";
import { dateToISOLocal } from "../../lib/fetyCalculations";
import type { CalendarMap, FetyStore } from "../../types/fety";
import HomeCalendarDayTile from "./HomeCalendarDayTile";
import { HomeCalendarDailyDetail, HomeCalendarEquationDay } from "./homeCalendarPeriodDetail";

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const HOME_CAL_TX_MAX_COLLAPSED = 3;

function HomeCalendarDow() {
  return (
    <div className="fety-home-calendar-dow">
      {DAYS_SHORT.map((d) => (
        <span key={d}>{d.slice(0, 1)}</span>
      ))}
    </div>
  );
}

function HomeCalendarShell({
  shellClassName = "fety-home-calendar",
  gridClassName,
  gridStyle,
  children,
}: {
  shellClassName?: string;
  gridClassName: string;
  gridStyle?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div className={shellClassName}>
      <HomeCalendarDow />
      <div className={gridClassName} style={gridStyle}>
        {children}
      </div>
    </div>
  );
}

export function HomeCalendarMonthGrid({
  year,
  month,
  calendarMap,
  store,
  selectedDateISO,
  expandedWeekRow,
  onToggleWeekRow,
  onSelectDay,
  onOpenDay,
  today,
}: {
  year: number;
  month: number;
  calendarMap: CalendarMap;
  store: FetyStore;
  selectedDateISO: string;
  expandedWeekRow: number | null;
  onToggleWeekRow: (weekRow: number | null) => void;
  onSelectDay: (dateISO: string) => void;
  onOpenDay: (dateISO: string) => void;
  today: Date;
}) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const weekCount = Math.ceil(cells.length / 7);

  return (
    <HomeCalendarShell
      gridClassName="fety-home-calendar-grid fety-home-calendar-grid--month"
      gridStyle={{ gridTemplateRows: `repeat(${weekCount}, minmax(0, 1fr))` }}
    >
      {cells.map((date, i) => {
        if (!date) return <div key={`pad-${i}`} className="fety-home-calendar-pad" aria-hidden />;
        const key = dateToISOLocal(date);
        const data = calendarMap.get(key);
        const weekRow = Math.floor(i / 7);
        const rowExpanded = expandedWeekRow === weekRow;
        const dayIcons = data?.items ?? [];
        const hasHiddenTx = dayIcons.length > HOME_CAL_TX_MAX_COLLAPSED;

        return (
          <div key={key} className="fety-home-calendar-day-wrap">
            <HomeCalendarDayTile
              date={date}
              dateISO={key}
              data={data}
              isToday={date.toDateString() === today.toDateString()}
              isSelected={key === selectedDateISO}
              calendarNotes={store.calendarNotes}
              itemsExpanded={rowExpanded}
              onSelect={onSelectDay}
              onOpenInPlanner={onOpenDay}
              moreControl={
                hasHiddenTx
                  ? {
                      hiddenCount: dayIcons.length - HOME_CAL_TX_MAX_COLLAPSED,
                      expanded: rowExpanded,
                      onToggle: () => onToggleWeekRow(rowExpanded ? null : weekRow),
                    }
                  : undefined
              }
            />
          </div>
        );
      })}
    </HomeCalendarShell>
  );
}

function mondayOfWeek(anchor: Date): Date {
  const mon = new Date(anchor);
  mon.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7));
  mon.setHours(12, 0, 0, 0);
  return mon;
}

export function HomeCalendarWeekGrid({
  anchor,
  days,
  calendarMap,
  store,
  selectedDateISO,
  onSelectDay,
  onOpenDay,
  today,
}: {
  anchor: Date;
  days: 7 | 14;
  calendarMap: CalendarMap;
  store: FetyStore;
  selectedDateISO: string;
  onSelectDay: (dateISO: string) => void;
  onOpenDay: (dateISO: string) => void;
  today: Date;
}) {
  const monday = mondayOfWeek(anchor);
  const dates: Date[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }

  const density = days === 14 ? "biweekly" : "weekly";

  return (
    <div className={`fety-home-cal-period fety-home-cal-period--${density}`}>
      <div className="fety-home-calendar fety-home-calendar--period-eq">
        <HomeCalendarDow />
        <div className={`fety-home-cal-eq-grid fety-home-cal-eq-grid--${density}`}>
        {dates.map((date) => {
          const key = dateToISOLocal(date);
          const data = calendarMap.get(key);
          return (
            <div key={key} className="fety-home-cal-eq-cell">
              <HomeCalendarEquationDay
                date={date}
                dateISO={key}
                data={data}
                calendarNotes={store.calendarNotes}
                density={density}
                isToday={date.toDateString() === today.toDateString()}
                isSelected={key === selectedDateISO}
                onSelect={onSelectDay}
                onOpenDay={onOpenDay}
              />
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}

export function HomeCalendarDailyGrid({
  date,
  calendarMap,
  store,
  selectedDateISO: _selectedDateISO,
  onSelectDay: _onSelectDay,
  onUpdateTransaction,
  onDeleteTransaction,
}: {
  date: Date;
  calendarMap: CalendarMap;
  store: FetyStore;
  selectedDateISO: string;
  onSelectDay: (dateISO: string) => void;
  today: Date;
  onUpdateTransaction: (
    id: string,
    updates: Partial<
      Pick<
        import("../../types/fety").Transaction,
        "desc" | "amount" | "type" | "category" | "dateISO" | "fromAccountId" | "toAccountId" | "goalId"
      >
    >,
  ) => void;
  onDeleteTransaction: (id: string) => void;
}) {
  const key = dateToISOLocal(date);
  const data = calendarMap.get(key);

  return (
    <HomeCalendarDailyDetail
      date={date}
      dateISO={key}
      data={data}
      calendarNotes={store.calendarNotes}
      store={store}
      onUpdateTransaction={onUpdateTransaction}
      onDeleteTransaction={onDeleteTransaction}
    />
  );
}

