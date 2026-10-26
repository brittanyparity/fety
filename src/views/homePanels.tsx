import { useMemo } from "react";
import { listSavedCalendarNotes } from "../lib/calendarNotes";
import { buildUpcomingExpenses } from "../lib/insightsUpcoming";
import { formatUsd } from "../lib/scheduleAmounts";
import type { FetyActionTarget } from "../types/analysis";
import type { FetyStore } from "../types/fety";

function formatNoteDay(dateISO: string): string {
  return new Date(`${dateISO}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDueDay(dateISO: string, ref = new Date()): string {
  const due = new Date(`${dateISO}T12:00:00`);
  const anchor = new Date(ref);
  anchor.setHours(12, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - anchor.getTime()) / 86400000);
  const label = due.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (diffDays === 0) return `Today · ${label}`;
  if (diffDays === 1) return `Tomorrow · ${label}`;
  if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days · ${label}`;
  return label;
}

export function UpcomingExpensesPanel({
  store,
  onAction,
  focusDateISO,
  limit = 8,
}: {
  store: FetyStore;
  onAction: (action: FetyActionTarget) => void;
  focusDateISO: string;
  limit?: number;
}) {
  const ref = useMemo(() => new Date(`${focusDateISO}T12:00:00`), [focusDateISO]);
  const upcoming = useMemo(
    () => buildUpcomingExpenses(store, ref, { limit }),
    [store, store.bills, store.recurringTransactions, focusDateISO, ref, limit],
  );

  if (upcoming.length === 0) {
    return (
      <div className="fety-insights-feed-empty">
        <p>No upcoming expenses on file.</p>
        <button type="button" className="fety-insights-feed-link" onClick={() => onAction({ type: "bills" })}>
          Add bills in Budget
        </button>
      </div>
    );
  }

  return (
    <ul className="fety-insights-feed-list">
      {upcoming.map((row) => (
        <li key={row.id} className="fety-insights-feed-row">
          <span className="fety-insights-feed-icon" aria-hidden>
            {row.icon || "📋"}
          </span>
          <div className="fety-insights-feed-main">
            <p className="fety-insights-feed-title">{row.name}</p>
            <p className="fety-insights-feed-meta">
              {formatDueDay(row.dateISO, ref)}
              {row.category ? ` · ${row.category}` : ""}
            </p>
          </div>
          <span className="fety-insights-feed-amount">{formatUsd(row.amount)}</span>
        </li>
      ))}
    </ul>
  );
}

export function NotesPanel({
  store,
  onAction,
  focusDateISO,
}: {
  store: FetyStore;
  onAction: (action: FetyActionTarget) => void;
  focusDateISO: string;
}) {
  const notes = useMemo(() => {
    const all = listSavedCalendarNotes(store.calendarNotes, 200);
    return all.filter((row) => row.dateISO === focusDateISO);
  }, [store.calendarNotes, focusDateISO]);

  if (notes.length === 0) {
    return (
      <div className="fety-insights-feed-empty">
        <p>No note for this day.</p>
        <button type="button" className="fety-insights-feed-link" onClick={() => onAction({ type: "calendar" })}>
          Add a note on Calendar
        </button>
      </div>
    );
  }

  return (
    <ul className="fety-insights-feed-list">
      {notes.map((row) => (
        <li key={row.dateISO} className="fety-insights-feed-row fety-insights-feed-row--note">
          <div className="fety-insights-feed-main">
            <p className="fety-insights-feed-title">{formatNoteDay(row.dateISO)}</p>
            <p className="fety-insights-feed-note">{row.text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
