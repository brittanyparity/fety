import type { CalendarDayNote, FetyStore } from "../types/fety";

export function normalizeCalendarNotes(
  raw: Record<string, string | CalendarDayNote> | undefined,
): Record<string, CalendarDayNote> {
  if (!raw) return {};
  const out: Record<string, CalendarDayNote> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") {
      const text = value.trim();
      if (text) out[key] = { text: value, createdISO: key };
    } else if (value && typeof value.text === "string") {
      const text = value.text.trim();
      if (text) {
        out[key] = {
          text: value.text,
          createdISO: value.createdISO || key,
        };
      }
    }
  }
  return out;
}

export function calendarNoteText(
  notes: FetyStore["calendarNotes"] | Record<string, string | CalendarDayNote> | undefined,
  dateISO: string,
): string {
  const n = notes?.[dateISO];
  if (!n) return "";
  if (typeof n === "string") return n;
  return n.text ?? "";
}

export function noteForCalendarDay(
  notes: FetyStore["calendarNotes"] | Record<string, string | CalendarDayNote> | undefined,
  dateISO: string,
): CalendarDayNote | null {
  const direct = notes?.[dateISO];
  if (direct) {
    if (typeof direct === "string") {
      const text = direct.trim();
      return text ? { text: direct, createdISO: dateISO } : null;
    }
    return direct.text.trim() ? direct : null;
  }
  if (!notes) return null;
  for (const value of Object.values(notes)) {
    const note = typeof value === "string" ? { text: value, createdISO: "" } : value;
    if (note.createdISO === dateISO && note.text.trim()) return note;
  }
  return null;
}

export function hasCalendarNote(
  notes: FetyStore["calendarNotes"] | Record<string, string | CalendarDayNote> | undefined,
  dateISO: string,
): boolean {
  return noteForCalendarDay(notes, dateISO) !== null;
}

export type SavedCalendarNoteRow = {
  dateISO: string;
  createdISO: string;
  text: string;
};

/** All saved notes, newest calendar days first. */
export function listSavedCalendarNotes(
  notes: FetyStore["calendarNotes"] | Record<string, string | CalendarDayNote> | undefined,
  limit = 24,
): SavedCalendarNoteRow[] {
  const normalized = normalizeCalendarNotes(notes);
  return Object.entries(normalized)
    .map(([dateISO, note]) => ({
      dateISO,
      createdISO: note.createdISO || dateISO,
      text: note.text.trim(),
    }))
    .filter((row) => row.text.length > 0)
    .sort((a, b) => b.dateISO.localeCompare(a.dateISO))
    .slice(0, limit);
}

export function calendarNotePreview(
  notes: FetyStore["calendarNotes"] | Record<string, string | CalendarDayNote> | undefined,
  dateISO: string,
  max = 36,
): string {
  const text = (noteForCalendarDay(notes, dateISO)?.text ?? "").trim();
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
