import { describe, expect, it } from "vitest";
import { applyBillScheduleToStore } from "./billScheduling";
import { computeScheduledKindProgress } from "./scheduledKindProgress";
import { monthlyFromFrequency } from "./scheduleAmounts";
import type { FetyStore } from "../types/fety";

describe("computeScheduledKindProgress", () => {
  it("includes scheduled bill and income on the selected due day (not the next day)", () => {
    const dueDay = 15;
    const focusISO = "2026-10-15";
    const ref = new Date(`${focusISO}T12:00:00`);

    const base: FetyStore = {
      profile: {
        startingBalance: 1000,
        balanceAsOfISO: "2026-01-01",
      },
      categories: [],
      goals: [],
      bills: [
        {
          id: "bill-electric",
          name: "Electric",
          amount: 120,
          dueDay,
          frequency: "monthly",
          icon: "⚡",
          category: "Electric",
        },
      ],
      incomeStreams: [
        {
          id: "inc-pay",
          name: "Paycheck",
          amount: 2000,
          dueDay,
          frequency: "monthly",
          icon: "💵",
          category: "Paycheck",
        },
      ],
      recurringTransactions: [],
      transactions: [],
      calendarNotes: [],
    };

    const store = applyBillScheduleToStore(base, ref);
    const rows = computeScheduledKindProgress(store, ref);

    const bills = rows.find((r) => r.kind === "bill")!;
    const income = rows.find((r) => r.kind === "income")!;

    expect(bills.monthlyScheduled).toBe(120);
    expect(bills.monthActual).toBe(120);
    expect(income.monthlyScheduled).toBe(2000);
    expect(income.monthActual).toBe(2000);
  });

  it("uses full monthly planned totals while actuals only count through the selected day", () => {
    const ref = new Date("2026-10-05T12:00:00");
    const perCheck = 2800;
    const store: FetyStore = {
      profile: { startingBalance: 0, balanceAsOfISO: "2026-01-01" },
      categories: [],
      goals: [],
      bills: [],
      incomeStreams: [
        {
          id: "inc-biweekly",
          name: "Salary",
          amount: perCheck,
          dueDay: 5,
          frequency: "biweekly",
          icon: "💵",
          category: "Salary",
        },
      ],
      recurringTransactions: [],
      transactions: [],
      calendarNotes: [],
    };

    const rows = computeScheduledKindProgress(store, ref);
    const income = rows.find((r) => r.kind === "income")!;

    expect(income.monthlyScheduled).toBe(monthlyFromFrequency(perCheck, "biweekly"));
    expect(income.monthActual).toBe(0);
  });
});
