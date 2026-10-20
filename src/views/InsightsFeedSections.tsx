import { useMemo } from "react";
import InsightsCollapsibleSection from "../components/InsightsCollapsibleSection";
import { listSavedCalendarNotes } from "../lib/calendarNotes";
import { buildUpcomingExpenses } from "../lib/insightsUpcoming";
import { formatUsd } from "../lib/scheduleAmounts";
import type { FetyActionTarget } from "../types/analysis";
import type { FetyStore } from "../types/fety";

const UPCOMING_COLLAPSE_KEY = "fety-insights-upcoming-collapsed";
const NOTES_COLLAPSE_KEY = "fety-insights-notes-collapsed";

function formatNoteDay(dateISO: string): string {
  return new Date(`${dateISO}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDueDay(dateISO: string): string {
  const due = new Date(`${dateISO}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
  const label = due.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (diffDays === 0) return `Today · ${label}`;
  if (diffDays === 1) return `Tomorrow · ${label}`;
  if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days · ${label}`;
  return label;
}

export default function InsightsFeedSections({
  store,
  onAction,
}: {
  store: FetyStore;
  onAction: (action: FetyActionTarget) => void;
}) {
  const upcoming = useMemo(() => buildUpcomingExpenses(store), [store, store.bills, store.recurringTransactions]);
  const notes = useMemo(() => listSavedCalendarNotes(store.calendarNotes), [store.calendarNotes]);

  return (
    <>
      <InsightsCollapsibleSection
        storageKey={UPCOMING_COLLAPSE_KEY}
        title="Upcoming expenses"
        ariaLabel="Upcoming expenses"
        headerEnd={
          upcoming.length > 0 ? (
            <span className="fety-insights-feed-count">{upcoming.length}</span>
          ) : null
        }
      >
        {upcoming.length === 0 ? (
          <div className="fety-insights-feed-empty">
            <p>No upcoming expenses on file.</p>
            <button type="button" className="fety-insights-feed-link" onClick={() => onAction({ type: "bills" })}>
              Add bills in Budget
            </button>
          </div>
        ) : (
          <ul className="fety-insights-feed-list">
            {upcoming.map((row) => (
              <li key={row.id} className="fety-insights-feed-row">
                <span className="fety-insights-feed-icon" aria-hidden>
                  {row.icon || "📋"}
                </span>
                <div className="fety-insights-feed-main">
                  <p className="fety-insights-feed-title">{row.name}</p>
                  <p className="fety-insights-feed-meta">
                    {formatDueDay(row.dateISO)}
                    {row.category ? ` · ${row.category}` : ""}
                    {row.source === "recurring" ? " · Recurring" : ""}
                  </p>
                </div>
                <span className="fety-insights-feed-amount">{formatUsd(row.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </InsightsCollapsibleSection>

      <InsightsCollapsibleSection
        storageKey={NOTES_COLLAPSE_KEY}
        title="Your notes"
        ariaLabel="Calendar notes"
        headerEnd={
          notes.length > 0 ? <span className="fety-insights-feed-count">{notes.length}</span> : null
        }
      >
        {notes.length === 0 ? (
          <div className="fety-insights-feed-empty">
            <p>No calendar notes yet.</p>
            <button type="button" className="fety-insights-feed-link" onClick={() => onAction({ type: "calendar" })}>
              Add a note on Calendar
            </button>
          </div>
        ) : (
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
        )}
      </InsightsCollapsibleSection>
    </>
  );
}
