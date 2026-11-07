export type CalView = "monthly" | "weekly" | "biweekly" | "daily";

export const CALENDAR_VIEW_OPTIONS: { id: CalView; label: string }[] = [
  { id: "monthly", label: "Monthly" },
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "biweekly", label: "Bi-Weekly" },
];

/** Sunday-start week (matches month grid and DOW header). */
export function sundayOfWeekContaining(anchor: Date): Date {
  const sun = new Date(anchor);
  sun.setDate(anchor.getDate() - anchor.getDay());
  sun.setHours(12, 0, 0, 0);
  return sun;
}

/** @deprecated use sundayOfWeekContaining */
export function mondayOfWeekContaining(anchor: Date): Date {
  return sundayOfWeekContaining(anchor);
}

/** Calendar years that must be loaded for the current home calendar view. */
export function calendarYearsForHomeView(calView: CalView, focusDate: Date): number[] {
  const years = new Set<number>([focusDate.getFullYear()]);
  if (calView === "weekly" || calView === "biweekly") {
    const sunday = sundayOfWeekContaining(focusDate);
    const count = calView === "biweekly" ? 14 : 7;
    for (let i = 0; i < count; i++) {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
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
  if (calView === "monthly") {
    d.setMonth(d.getMonth() + delta);
    return d;
  }
  if (calView === "biweekly") {
    d.setDate(d.getDate() + delta * 14);
    return d;
  }
  d.setDate(d.getDate() + delta * 7);
  return d;
}
