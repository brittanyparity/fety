import { useEffect, useRef, useState } from "react";
import type { CalendarDayNote } from "../types/fety";

export default function DayNotesPanel({
  dateISO,
  notes,
  onAddNote,
  onDeleteNote,
  compact,
}: {
  dateISO: string;
  notes: CalendarDayNote[];
  onAddNote: (dateISO: string, text: string) => void;
  onDeleteNote?: (dateISO: string, noteId: string) => void;
  /** Tighter layout for home card */
  compact?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const savedNoticeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setDraft("");
    setSavedNotice(null);
  }, [dateISO]);

  useEffect(
    () => () => {
      if (savedNoticeTimerRef.current != null) window.clearTimeout(savedNoticeTimerRef.current);
    },
    [],
  );

  const dateLabel = new Date(`${dateISO}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const flashSaved = (message: string) => {
    setSavedNotice(message);
    if (savedNoticeTimerRef.current != null) window.clearTimeout(savedNoticeTimerRef.current);
    savedNoticeTimerRef.current = window.setTimeout(() => {
      setSavedNotice(null);
      savedNoticeTimerRef.current = null;
    }, 4000);
  };

  const add = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onAddNote(dateISO, trimmed);
    setDraft("");
    flashSaved(`Note added for ${dateLabel}.`);
  };

  return (
    <div className={`fety-day-notes${compact ? " fety-day-notes--compact" : ""}`}>
      {savedNotice ? (
        <div className="fety-cal-note-toast" role="status" aria-live="polite">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
            <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{savedNotice}</span>
        </div>
      ) : null}

      {notes.length > 0 ? (
        <ul className="fety-day-notes-list" aria-label={`Notes for ${dateLabel}`}>
          {notes.map((note) => (
            <li key={note.id} className="fety-day-notes-row">
              <p className="fety-day-notes-row-text">{note.text}</p>
              {onDeleteNote ? (
                <button
                  type="button"
                  className="fety-day-notes-row-remove"
                  aria-label="Remove note"
                  onClick={() => onDeleteNote(dateISO, note.id)}
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="fety-day-notes-empty">No notes yet for this day.</p>
      )}

      <label className="fety-day-notes-compose">
        <span className="fety-label">Add a note</span>
        <textarea
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setSavedNotice(null);
          }}
          placeholder="What should you remember about this day?"
          rows={compact ? 3 : 4}
        />
      </label>
      <div className="fety-cal-note-footer">
        <span className="fety-cal-note-meta">Each save adds another note for this calendar day.</span>
        <button type="button" className="fety-cal-note-save" disabled={!draft.trim()} onClick={add}>
          Add note
        </button>
      </div>
    </div>
  );
}
