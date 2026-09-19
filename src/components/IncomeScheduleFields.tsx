import type { CSSProperties } from "react";
import type { IncomeFrequency } from "../types/fety";
import { INCOME_FREQUENCY_LABELS } from "../lib/billScheduling";

const WEEKDAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

type IncomeScheduleFieldsProps = {
  frequency: IncomeFrequency;
  dueDay: number;
  semiMonthlyDays: [number, number];
  startDateISO: string;
  endDateISO: string;
  onFrequencyChange: (f: IncomeFrequency) => void;
  onDueDayChange: (day: number) => void;
  onSemiMonthlyDaysChange: (days: [number, number]) => void;
  onStartDateISOChange: (iso: string) => void;
  onEndDateISOChange: (iso: string) => void;
  inputStyle?: CSSProperties;
  compact?: boolean;
};

export default function IncomeScheduleFields({
  frequency,
  dueDay,
  semiMonthlyDays,
  startDateISO,
  endDateISO,
  onFrequencyChange,
  onDueDayChange,
  onSemiMonthlyDaysChange,
  onStartDateISOChange,
  onEndDateISOChange,
  inputStyle,
  compact,
}: IncomeScheduleFieldsProps) {
  const baseInput: CSSProperties = inputStyle ?? {
    width: "100%",
    padding: "8px 10px",
    borderRadius: "var(--radius-ctrl)",
    border: "1px solid var(--border)",
    fontSize: 13,
    fontFamily: "inherit",
    background: "var(--surface)",
  };

  const isWeekBased = frequency === "weekly" || frequency === "biweekly";
  const isSemiMonthly = frequency === "semimonthly";

  const dayOptions = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 8 : 10 }}>
      <div
        style={{
          display: "flex",
          flexDirection: compact ? "column" : "row",
          gap: compact ? 8 : 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: compact ? undefined : "1 1 160px", minWidth: 140 }}>
          <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>
            How often is it paid?
          </label>
          <select
            value={frequency}
            onChange={(e) => onFrequencyChange(e.target.value as IncomeFrequency)}
            style={baseInput}
          >
            {(Object.keys(INCOME_FREQUENCY_LABELS) as IncomeFrequency[]).map((f) => (
              <option key={f} value={f}>
                {INCOME_FREQUENCY_LABELS[f]}
              </option>
            ))}
          </select>
        </div>

        {!isSemiMonthly && (
          <div style={{ flex: compact ? undefined : "1 1 120px", minWidth: 120 }}>
            <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>
              {isWeekBased ? "Paid on (weekday)" : "Paid on (day of month)"}
            </label>
            {isWeekBased ? (
              <select value={dueDay} onChange={(e) => onDueDayChange(parseInt(e.target.value, 10))} style={baseInput}>
                {WEEKDAYS.map((w) => (
                  <option key={w.value} value={w.value}>
                    {w.label}
                  </option>
                ))}
              </select>
            ) : (
              <select value={dueDay} onChange={(e) => onDueDayChange(parseInt(e.target.value, 10))} style={baseInput}>
                {dayOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {isSemiMonthly && (
          <div style={{ flex: compact ? undefined : "1 1 200px", minWidth: 160 }}>
            <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>
              Paid on (days of month)
            </label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select
                value={semiMonthlyDays[0]}
                onChange={(e) =>
                  onSemiMonthlyDaysChange([parseInt(e.target.value, 10), semiMonthlyDays[1]])
                }
                style={baseInput}
                aria-label="First pay day of month"
              >
                {dayOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: 12, color: "var(--ink-3)" }}>and</span>
              <select
                value={semiMonthlyDays[1]}
                onChange={(e) =>
                  onSemiMonthlyDaysChange([semiMonthlyDays[0], parseInt(e.target.value, 10)])
                }
                style={baseInput}
                aria-label="Second pay day of month"
              >
                {dayOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: compact ? 8 : 10 }}>
        <div style={{ flex: "1 1 140px", minWidth: 130 }}>
          <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>
            Start date (optional)
          </label>
          <input
            type="date"
            value={startDateISO}
            onChange={(e) => onStartDateISOChange(e.target.value)}
            style={baseInput}
          />
        </div>
        <div style={{ flex: "1 1 140px", minWidth: 130 }}>
          <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>
            End date (optional)
          </label>
          <input
            type="date"
            value={endDateISO}
            onChange={(e) => onEndDateISOChange(e.target.value)}
            style={baseInput}
          />
        </div>
      </div>
      <p style={{ fontSize: 10, color: "var(--ink-3)", margin: 0, lineHeight: 1.35 }}>
        Leave dates blank for no limit. We project payments onto your calendar and transaction list within this range.
      </p>
    </div>
  );
}
