export type CalView = "monthly" | "weekly" | "biweekly" | "daily";

export const CALENDAR_VIEW_OPTIONS: { id: CalView; label: string }[] = [
  { id: "monthly", label: "Monthly" },
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "biweekly", label: "Bi-Weekly" },
];

export function mondayOfWeekContaining(anchor: Date): Date {
  const mon = new Date(anchor);
  mon.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7));
  mon.setHours(12, 0, 0, 0);
  return mon;
}

/** Calendar years that must be loaded for the current home calendar view. */
export function calendarYearsForHomeView(calView: CalView, focusDate: Date): number[] {
  const years = new Set<number>([focusDate.getFullYear()]);
  if (calView === "weekly" || calView === "biweekly") {
    const monday = mondayOfWeekContaining(focusDate);
    const count = calView === "biweekly" ? 14 : 7;
    for (let i = 0; i < count; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      years.add(d.getFullYear());
    }
  }
  return [...years].sort((a, b) => a - b);
}

export function shiftFocusDate(calView: CalView, focusDate: Date, delta: -1 | 1): Date {
  const d = new Date(focusDate);
  d.setHours(12, 0, 0, 0);
  if (calView === "daily") {
    d.setDate(d.getDate() + delta);
    return d;
  }
  if (calView === "monthly" || calView === "biweekly") {
    d.setMonth(d.getMonth() + delta);
    return d;
  }
  d.setDate(d.getDate() + delta * 7);
  return d;
}
