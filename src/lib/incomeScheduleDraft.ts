import type { IncomeFrequency, IncomeStream } from "../types/fety";

export function incomeScheduleFromDraft(d: {
  frequency: IncomeFrequency;
  dueDay: number;
  semiMonthlyDays: [number, number];
  startDateISO?: string;
  endDateISO?: string;
}): Pick<IncomeStream, "frequency" | "dueDay" | "semiMonthlyDays" | "startDateISO" | "endDateISO"> {
  return {
    frequency: d.frequency,
    dueDay: d.dueDay,
    semiMonthlyDays: d.frequency === "semimonthly" ? d.semiMonthlyDays : undefined,
    startDateISO: d.startDateISO?.trim() || undefined,
    endDateISO: d.endDateISO?.trim() || undefined,
  };
}
