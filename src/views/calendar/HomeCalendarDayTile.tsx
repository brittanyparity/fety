import { calendarEndingBalanceBg, calSignedColor } from "../../lib/calendarUi";
import CalendarNoteIcon from "../../components/CalendarNoteIcon";
import { hasCalendarNote } from "../../lib/calendarNotes";
import type { CalDay, CalDayItem, FetyStore } from "../../types/fety";
import HomeOpenDayButton from "./HomeOpenDayButton";

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

export default function HomeCalendarDayTile({
  date,
  dateISO,
  data,
  isToday,
  isSelected,
  calendarNotes,
  maxVisibleItems = 3,
  itemsExpanded = false,
  onSelect,
  onOpenInPlanner,
  density = "default",
  registerDayRef,
  moreControl,
}: {
  date: Date;
  dateISO: string;
  data?: CalDay;
  isToday: boolean;
  isSelected: boolean;
  calendarNotes?: FetyStore["calendarNotes"];
  maxVisibleItems?: number;
  itemsExpanded?: boolean;
  onSelect: (dateISO: string) => void;
  onOpenInPlanner?: (dateISO: string) => void;
  density?: "default" | "year";
  registerDayRef?: (dateISO: string, el: HTMLDivElement | null) => void;
  moreControl?: {
    hiddenCount: number;
    expanded: boolean;
    onToggle: () => void;
  };
}) {
  const endBal = data?.endBal ?? 0;
  const dayIcons = data?.items ?? [];
  const visibleIcons = itemsExpanded ? dayIcons : dayIcons.slice(0, maxVisibleItems);
  const showMore = density !== "year" && moreControl != null && moreControl.hiddenCount > 0;
  const showOpenFoot = density !== "year" && isSelected && onOpenInPlanner != null;
  const showYearOpen = density === "year" && isSelected && onOpenInPlanner != null;
  const showFoot = showOpenFoot || showMore;
  const dayNum = date.getDate();
  const monthAbbrOnYearStart =
    density === "year" && dayNum === 1 ? date.toLocaleDateString("en-US", { month: "short" }) : null;

  return (
    <div
      ref={(el) => registerDayRef?.(dateISO, el)}
      className={`fety-home-calendar-day${isToday ? " fety-home-calendar-day--today" : ""}${isSelected ? " fety-home-calendar-day--selected" : ""}${itemsExpanded ? " fety-home-calendar-day--expanded" : ""}${density === "year" ? " fety-home-calendar-day--year" : ""}`}
      style={{
        background: data || isSelected ? calendarEndingBalanceBg(endBal, isSelected) : "var(--surface)",
      }}
    >
      {showYearOpen ? (
        <HomeOpenDayButton
          dateISO={dateISO}
          onOpen={onOpenInPlanner}
          label="More"
          className="fety-home-open-day-btn--year-tile"
        />
      ) : null}
      <button
        type="button"
        className="fety-home-calendar-day-main"
        onClick={() => onSelect(dateISO)}
        title={data ? `Ending ${compactUsd(data.endBal)}` : undefined}
        aria-pressed={isSelected}
      >
        <span className="fety-home-calendar-day-top">
          <span className="fety-home-calendar-day-date-label">
            {monthAbbrOnYearStart ? (
              <span className="fety-home-calendar-day-month-abbr">{monthAbbrOnYearStart}</span>
            ) : null}
            <span className="fety-home-calendar-day-num">{dayNum}</span>
          </span>
          {hasCalendarNote(calendarNotes, dateISO) ? (
            <CalendarNoteIcon size={10} className={isSelected ? "fety-cal-day-note-icon--on-dark" : undefined} />
          ) : null}
        </span>
        {dayIcons.length > 0 && maxVisibleItems > 0 ? (
          <ul className={`fety-home-calendar-day-items${itemsExpanded ? " fety-home-calendar-day-items--expanded" : ""}`}>
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
      {showFoot ? (
        <div className="fety-home-calendar-day-foot">
          <div className="fety-home-calendar-day-foot-start">
            {showOpenFoot ? (
              <HomeOpenDayButton dateISO={dateISO} onOpen={onOpenInPlanner} className="fety-home-open-day-btn--month-tile" />
            ) : null}
          </div>
          <div className="fety-home-calendar-day-foot-end">
            {showMore ? (
              <button
                type="button"
                className="fety-home-calendar-day-more"
                onClick={(event) => {
                  event.stopPropagation();
                  moreControl.onToggle();
                }}
                aria-expanded={moreControl.expanded}
              >
                {moreControl.expanded ? "Less" : `More (${moreControl.hiddenCount})`}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
