import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Bill } from "../types/fety";
import { scheduledAmountInCalendarMonth } from "./scheduleMonthTotals";

describe("scheduleMonthTotals", () => {
  it("counts weekly bill occurrences in a 31-day month", () => {
    const bill: Bill = {
      id: "b1",
      name: "Gym",
      amount: 100,
      dueDay: 1,
      frequency: "weekly",
      category: "Health",
      icon: "🏋",
    };
    const ref = new Date("2026-10-15T12:00:00");
    const total = scheduledAmountInCalendarMonth(bill, ref);
    assert.ok(total >= 400 && total <= 500, `expected ~4-5 weeks, got ${total}`);
  });
});
