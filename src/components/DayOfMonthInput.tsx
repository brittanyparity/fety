import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

type DayOfMonthInputProps = {
  value: number;
  onChange: (day: number) => void;
  id?: string;
  "aria-label"?: string;
  placeholder?: string;
  style?: CSSProperties;
};

function clampDay(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(31, Math.max(1, Math.round(n)));
}

export default function DayOfMonthInput({
  value,
  onChange,
  id,
  "aria-label": ariaLabel,
  placeholder = "15",
  style,
}: DayOfMonthInputProps) {
  const [text, setText] = useState(String(clampDay(value)));

  useEffect(() => {
    setText(String(clampDay(value)));
  }, [value]);

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      aria-label={ariaLabel ?? "Day of month"}
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
        setText(raw);
        if (raw === "") return;
        const n = parseInt(raw, 10);
        if (Number.isFinite(n) && n >= 1 && n <= 31) onChange(n);
      }}
      onBlur={() => {
        const next = clampDay(parseInt(text, 10));
        setText(String(next));
        if (next !== value) onChange(next);
      }}
      style={style}
    />
  );
}
