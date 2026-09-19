import type { CSSProperties } from "react";
import type { BillFrequency } from "../types/fety";
import { BILL_FREQUENCY_LABELS } from "../lib/billScheduling";

const WEEKDAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

type BillScheduleFieldsProps = {
  frequency: BillFrequency;
  dueDay: number;
  onFrequencyChange: (f: BillFrequency) => void;
  onDueDayChange: (day: number) => void;
  inputStyle?: CSSProperties;
  compact?: boolean;
};

export default function BillScheduleFields({
  frequency,
  dueDay,
  onFrequencyChange,
  onDueDayChange,
  inputStyle,
  compact,
}: BillScheduleFieldsProps) {
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

  return (
    <div style={{ display: "flex", flexDirection: compact ? "column" : "row", gap: compact ? 8 : 10, flexWrap: "wrap", gridColumn: compact ? undefined : "1 / -1" }}>
      <div style={{ flex: compact ? undefined : "1 1 160px", minWidth: 140 }}>
        <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>
          How often is it due?
        </label>
        <select
          value={frequency}
          onChange={(e) => onFrequencyChange(e.target.value as BillFrequency)}
          style={baseInput}
        >
          {(Object.keys(BILL_FREQUENCY_LABELS) as BillFrequency[]).map((f) => (
            <option key={f} value={f}>
              {BILL_FREQUENCY_LABELS[f]}
            </option>
          ))}
        </select>
        <p style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 4, lineHeight: 1.35 }}>
          We use this to place the bill on your calendar and transaction list.
        </p>
      </div>
      <div style={{ flex: compact ? undefined : "1 1 120px", minWidth: 120 }}>
        <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>
          {isWeekBased ? "Due on (weekday)" : "Due on (day of month)"}
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
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}
        <p style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 4, lineHeight: 1.35 }}>
          {isWeekBased
            ? "Pick which day of the week this bill repeats."
            : "Pick which calendar date each cycle is due (e.g. 1 = 1st of the month)."}
        </p>
      </div>
    </div>
  );
}
