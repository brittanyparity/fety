import { useEffect, useState } from "react";

const editBtnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  color: "var(--ink-3)",
};

function EditIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M8.2 1.8l2 2M3.5 10.5H1.5v-2L8.2 1.8l2 2L3.5 10.5z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const fieldInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: "var(--radius-ctrl)",
  border: "1px solid var(--border)",
  fontSize: 13,
  fontFamily: "inherit",
  background: "var(--surface)",
};

type EditableNumberProps = {
  label: string;
  value: number;
  format?: (n: number) => string;
  onSave: (n: number) => void;
  min?: number;
  step?: number;
  valueStyle?: React.CSSProperties;
};

export function EditableNumber({
  label,
  value,
  format,
  onSave,
  min = 0,
  step = 1,
  valueStyle,
}: EditableNumberProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  const display = format ? format(value) : String(value);

  const commit = () => {
    const n = parseFloat(draft);
    if (Number.isFinite(n)) onSave(n);
    setEditing(false);
  };

  if (editing) {
    return (
      <div>
        <p className="fety-label" style={{ marginBottom: 6 }}>
          {label}
        </p>
        <input
          type="number"
          min={min}
          step={step}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          style={fieldInputStyle}
          autoFocus
        />
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <button
            type="button"
            onClick={commit}
            style={{
              padding: "6px 12px",
              borderRadius: "var(--radius-ctrl)",
              border: "none",
              background: "var(--ink)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            style={{
              padding: "6px 12px",
              borderRadius: "var(--radius-ctrl)",
              border: "1px solid var(--border)",
              background: "transparent",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
      <div style={{ minWidth: 0 }}>
        <p className="fety-label" style={{ marginBottom: 4 }}>
          {label}
        </p>
        <p style={{ fontSize: 22, fontWeight: 400, color: "var(--ink)", letterSpacing: "-0.02em", ...valueStyle }}>{display}</p>
      </div>
      <button type="button" onClick={() => setEditing(true)} style={editBtnStyle} title={`Edit ${label}`} aria-label={`Edit ${label}`}>
        <EditIcon />
      </button>
    </div>
  );
}

type EditableTextProps = {
  label: string;
  value: string;
  onSave: (v: string) => void;
  type?: "text" | "email";
  valueStyle?: React.CSSProperties;
};

export function EditableText({ label, value, onSave, type = "text", valueStyle }: EditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const commit = () => {
    const t = draft.trim();
    if (t) onSave(t);
    setEditing(false);
  };

  if (editing) {
    return (
      <div style={{ marginBottom: 4 }}>
        <p className="fety-label" style={{ marginBottom: 6 }}>
          {label}
        </p>
        <input type={type} value={draft} onChange={(e) => setDraft(e.target.value)} style={fieldInputStyle} autoFocus />
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <button type="button" onClick={commit} style={{ padding: "6px 12px", borderRadius: "var(--radius-ctrl)", border: "none", background: "var(--ink)", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            Save
          </button>
          <button type="button" onClick={() => setEditing(false)} style={{ padding: "6px 12px", borderRadius: "var(--radius-ctrl)", border: "1px solid var(--border)", background: "transparent", fontSize: 11, cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p className="fety-label" style={{ marginBottom: 4 }}>
          {label}
        </p>
        <p style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)", ...valueStyle }}>{value || "—"}</p>
      </div>
      <button type="button" onClick={() => setEditing(true)} style={editBtnStyle} title={`Edit ${label}`} aria-label={`Edit ${label}`}>
        <EditIcon />
      </button>
    </div>
  );
}
