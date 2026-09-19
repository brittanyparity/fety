import { useEffect, useRef, useState } from "react";

export const TRANSACTION_EMOJI_OPTIONS = [
  "💵",
  "💼",
  "🛒",
  "⛽",
  "🏠",
  "⚡",
  "📋",
  "🏦",
  "📦",
  "🍽️",
  "🚗",
  "✈️",
  "🎬",
  "💳",
  "🛍️",
  "💆",
  "📱",
  "🌐",
  "🎯",
  "💰",
  "🏧",
  "🧾",
  "☕",
  "🎁",
  "🐾",
  "💊",
  "🚌",
  "🎓",
  "👶",
  "🔧",
];

type EmojiIconPickerProps = {
  value: string;
  defaultEmoji: string;
  onChange: (emoji: string) => void;
  compact?: boolean;
};

export default function EmojiIconPicker({ value, defaultEmoji, onChange, compact }: EmojiIconPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const display = value.trim() || defaultEmoji;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const pick = (emoji: string) => {
    onChange(emoji);
    setOpen(false);
  };

  const options = Array.from(new Set([defaultEmoji, ...TRANSACTION_EMOJI_OPTIONS]));

  return (
    <div ref={rootRef} style={{ position: "relative", alignSelf: compact ? "flex-start" : undefined }}>
      <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>
        Icon
      </label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Choose transaction icon"
        aria-expanded={open}
        style={{
          width: compact ? 40 : 44,
          height: compact ? 40 : 44,
          borderRadius: 11,
          border: open ? "2px solid var(--ink)" : "1px solid var(--border)",
          background: "var(--paper)",
          fontSize: compact ? 18 : 22,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 1,
        }}
      >
        {display}
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Emoji menu"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 30,
            width: 240,
            maxHeight: 220,
            overflowY: "auto",
            padding: 10,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            boxShadow: "0 10px 28px rgba(0,0,0,0.1)",
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: 4,
          }}
        >
          {options.map((emoji) => (
            <button
              key={emoji}
              type="button"
              role="option"
              aria-selected={emoji === display}
              onClick={() => pick(emoji)}
              style={{
                width: "100%",
                aspectRatio: "1",
                border: emoji === display ? "2px solid var(--ink)" : "1px solid var(--border-soft)",
                borderRadius: 8,
                background: emoji === display ? "var(--bg)" : "transparent",
                fontSize: 20,
                cursor: "pointer",
                lineHeight: 1,
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
