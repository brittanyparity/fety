import { useEffect, useMemo, useRef } from "react";
import { formatDisplayDate, todayISO } from "../lib/fetyCalculations";
import type { CalendarMap } from "../types/fety";
import { calendarEndingBalanceBg } from "../lib/calendarUi";

function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

const usdCompact = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

export default function MobileDateStrip({
  selectedISO,
  onSelect,
  calendarMap,
  daysBefore = 21,
  daysAfter = 21,
}: {
  selectedISO: string;
  onSelect: (dateISO: string) => void;
  calendarMap: CalendarMap;
  daysBefore?: number;
  daysAfter?: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = todayISO();

  const dates = useMemo(() => {
    const start = addDays(today, -daysBefore);
    const out: string[] = [];
    const total = daysBefore + daysAfter + 1;
    for (let i = 0; i < total; i++) {
      out.push(addDays(start, i));
    }
    return out;
  }, [today, daysBefore, daysAfter]);

  useEffect(() => {
    const el = scrollRef.current?.querySelector(`[data-mobile-date="${selectedISO}"]`);
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [selectedISO]);

  return (
    <div className="fety-mobile-date-strip-wrap">
      <div className="fety-mobile-date-strip" ref={scrollRef} role="listbox" aria-label="Choose a day">
        {dates.map((dateISO) => {
          const d = new Date(`${dateISO}T12:00:00`);
          const day = dataFromMap(calendarMap, dateISO);
          const endBal = day?.endBal ?? 0;
          const selected = dateISO === selectedISO;
          const isToday = dateISO === today;
          const dow = d.toLocaleDateString("en-US", { weekday: "short" });
          const dom = d.getDate();
          return (
            <button
              key={dateISO}
              type="button"
              role="option"
              aria-selected={selected}
              data-mobile-date={dateISO}
              className={`fety-mobile-date-pill${selected ? " fety-mobile-date-pill--selected" : ""}${isToday ? " fety-mobile-date-pill--today" : ""}`}
              style={{
                background: selected || day ? calendarEndingBalanceBg(endBal, selected) : "var(--paper)",
              }}
              onClick={() => onSelect(dateISO)}
            >
              <span className="fety-mobile-date-pill-dow">{dow}</span>
              <span className="fety-mobile-date-pill-dom">{dom}</span>
              {day ? (
                <span className="fety-mobile-date-pill-bal">{usdCompact(endBal)}</span>
              ) : (
                <span className="fety-mobile-date-pill-bal fety-mobile-date-pill-bal--empty">—</span>
              )}
              {isToday ? <span className="fety-mobile-date-pill-tag">Today</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function dataFromMap(calendarMap: CalendarMap, dateISO: string) {
  return calendarMap.get(dateISO);
}
