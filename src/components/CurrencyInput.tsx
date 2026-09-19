import type { CSSProperties } from "react";

export function sanitizeDecimalInput(raw: string): string {
  if (raw === "") return "";
  let v = raw.replace(/[^\d.]/g, "");
  const dot = v.indexOf(".");
  if (dot !== -1) {
    v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, "");
  }
  return v;
}

type CurrencyInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  style?: CSSProperties;
  compact?: boolean;
  id?: string;
  "aria-label"?: string;
};

export default function CurrencyInput({
  value,
  onChange,
  placeholder = "0.00",
  style,
  compact,
  id,
  "aria-label": ariaLabel,
}: CurrencyInputProps) {
  const wrapStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    width: "100%",
    borderRadius: "var(--radius-ctrl)",
    border: "1px solid var(--border)",
    background: "var(--surface)",
    ...style,
  };

  const prefixStyle: CSSProperties = {
    padding: compact ? "7px 0 7px 9px" : "8px 0 8px 10px",
    fontSize: compact ? 11 : 13,
    color: "var(--ink-2)",
    flexShrink: 0,
    userSelect: "none",
  };

  const fieldStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
    border: "none",
    outline: "none",
    padding: compact ? "7px 9px 7px 0" : "8px 10px 8px 0",
    fontSize: compact ? 11 : 13,
    fontFamily: "inherit",
    background: "transparent",
  };

  return (
    <div style={wrapStyle}>
      <span style={prefixStyle} aria-hidden>
        $
      </span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-label={ariaLabel ?? "Amount in dollars"}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(sanitizeDecimalInput(e.target.value))}
        style={fieldStyle}
      />
    </div>
  );
}

/** Format stored number for editing (empty when zero so the field is clear). */
export function amountToEditString(amount: number): string {
  const n = Math.abs(amount);
  if (!Number.isFinite(n) || n === 0) return "";
  return String(n);
}
