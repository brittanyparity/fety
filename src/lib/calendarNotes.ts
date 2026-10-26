import type { CalendarDayNote, FetyStore } from "../types/fety";

type LegacyNoteValue = string | CalendarDayNote | CalendarDayNote[];

export function newCalendarNoteId(): string {
  return `cn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeOneNote(value: string | CalendarDayNote, dateISO: string): CalendarDayNote | null {
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return null;
    return { id: newCalendarNoteId(), text, createdISO: dateISO };
  }
  const text = (value.text ?? "").trim();
  if (!text) return null;
  return {
    id: value.id?.trim() || newCalendarNoteId(),
    text: value.text,
    createdISO: value.createdISO || dateISO,
  };
}

/** Migrate legacy single-note-per-day storage to arrays. */
export function normalizeCalendarNotes(
  raw: Record<string, LegacyNoteValue> | FetyStore["calendarNotes"] | undefined,
): Record<string, CalendarDayNote[]> {
  if (!raw) return {};
  const out: Record<string, CalendarDayNote[]> = {};
  for (const [dateISO, value] of Object.entries(raw)) {
    if (Array.isArray(value)) {
      const rows = value
        .map((n) => normalizeOneNote(n, dateISO))
        .filter((n): n is CalendarDayNote => n !== null);
      if (rows.length > 0) out[dateISO] = rows;
      continue;
    }
    const one = normalizeOneNote(value, dateISO);
    if (one) out[dateISO] = [one];
  }
  return out;
}

export function notesForCalendarDay(
  notes: FetyStore["calendarNotes"] | Record<string, LegacyNoteValue> | undefined,
  dateISO: string,
): CalendarDayNote[] {
  return normalizeCalendarNotes(notes)[dateISO] ?? [];
}

export function calendarNoteText(
  notes: FetyStore["calendarNotes"] | Record<string, LegacyNoteValue> | undefined,
  dateISO: string,
): string {
  return notesForCalendarDay(notes, dateISO)
    .map((n) => n.text.trim())
    .filter(Boolean)
    .join("\n\n");
}

/** @deprecated Prefer notesForCalendarDay */
export function noteForCalendarDay(
  notes: FetyStore["calendarNotes"] | Record<string, LegacyNoteValue> | undefined,
  dateISO: string,
): CalendarDayNote | null {
  const list = notesForCalendarDay(notes, dateISO);
  return list.length > 0 ? list[0] : null;
}

export function hasCalendarNote(
  notes: FetyStore["calendarNotes"] | Record<string, LegacyNoteValue> | undefined,
  dateISO: string,
): boolean {
  return notesForCalendarDay(notes, dateISO).length > 0;
}

export type SavedCalendarNoteRow = {
  id: string;
  dateISO: string;
  createdISO: string;
  text: string;
};

/** All saved notes, newest calendar days first. */
export function listSavedCalendarNotes(
  notes: FetyStore["calendarNotes"] | Record<string, LegacyNoteValue> | undefined,
  limit = 24,
): SavedCalendarNoteRow[] {
  const normalized = normalizeCalendarNotes(notes);
  const rows: SavedCalendarNoteRow[] = [];
  for (const [dateISO, dayNotes] of Object.entries(normalized)) {
    for (const note of dayNotes) {
      rows.push({
        id: note.id,
        dateISO,
        createdISO: note.createdISO || dateISO,
        text: note.text.trim(),
      });
    }
  }
  return rows
    .filter((row) => row.text.length > 0)
    .sort((a, b) => b.dateISO.localeCompare(a.dateISO))
    .slice(0, limit);
}

export function calendarNotePreview(
  notes: FetyStore["calendarNotes"] | Record<string, LegacyNoteValue> | undefined,
  dateISO: string,
  max = 36,
): string {
  const list = notesForCalendarDay(notes, dateISO);
  if (list.length === 0) return "";
  if (list.length === 1) {
    const text = list[0].text.trim();
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1)}…`;
  }
  const first = list[0].text.trim();
  const head = first.length > 22 ? `${first.slice(0, 21)}…` : first;
  return `${head} (+${list.length - 1} more)`;
}
