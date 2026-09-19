import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../types/fety";

const SUGGESTED_PROMPTS = [
  "What's my Spending Power?",
  "Can I afford $150?",
  "What bills are coming up?",
  "Where did my money go this month?",
  "I spent $43 at Target yesterday",
];

function ChatCollapseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 4.5h7a2 2 0 012 2v3.5H5.5A2.5 2.5 0 003 11.5V4.5z" stroke="var(--ink-3)" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M12 6.5v4M10.5 8.5L12 6.5l1.5 2" stroke="var(--ink-3)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChatPanel({
  messages,
  processing,
  onSend,
  onCollapse,
  onConfirm,
  onCancelConfirm,
}: {
  messages: ChatMessage[];
  processing?: boolean;
  onSend: (text: string) => void;
  onCollapse: () => void;
  onConfirm: (confirmationId: string) => void;
  onCancelConfirm: (confirmationId: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const feedRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [messages, processing]);

  const send = (text?: string) => {
    const t = (text ?? draft).trim();
    if (!t || processing) return;
    onSend(t);
    setDraft("");
    inputRef.current?.focus();
  };

  return (
    <div className="fety-chat-panel">
      <button type="button" className="fety-chat-toggle" onClick={onCollapse} title="Collapse chat" aria-label="Collapse chat">
        <ChatCollapseIcon />
      </button>

      <div ref={feedRef} style={{ flex: 1, overflowY: "auto", padding: "36px 14px 6px" }}>
        {messages.length <= 2 && (
          <div style={{ marginBottom: 14 }}>
            <p className="fety-label" style={{ marginBottom: 8, fontSize: 9 }}>
              Try asking
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => send(p)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 99,
                    border: "1px solid var(--border)",
                    background: "var(--bg)",
                    fontSize: 10,
                    color: "var(--ink-2)",
                    cursor: "pointer",
                    textAlign: "left",
                    lineHeight: 1.35,
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <ChatBubble key={msg.id} msg={msg} onConfirm={onConfirm} onCancelConfirm={onCancelConfirm} />
        ))}
        {processing && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: "var(--radius-marker)", background: "var(--ink-3)", opacity: 0.5 }} />
            <span style={{ fontSize: 11, color: "var(--ink-3)" }}>Thinking…</span>
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px solid var(--border)", padding: "10px 12px", flexShrink: 0 }}>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-end",
            background: "var(--bg)",
            borderRadius: 14,
            padding: "8px 10px 8px 14px",
            border: "1px solid var(--border)",
          }}
        >
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask or tell Fety what happened…"
            rows={1}
            disabled={processing}
            aria-label="Message Fety"
            style={{
              flex: 1,
              resize: "none",
              border: "none",
              background: "transparent",
              fontSize: 12,
              color: "var(--ink)",
              fontFamily: "inherit",
              outline: "none",
              lineHeight: 1.5,
              maxHeight: 80,
              overflowY: "auto",
            }}
          />
          <button
            type="button"
            onClick={() => send()}
            disabled={!draft.trim() || processing}
            style={{
              width: 30,
              height: 30,
              borderRadius: 99,
              border: "none",
              cursor: draft.trim() && !processing ? "pointer" : "default",
              background: draft.trim() && !processing ? "var(--ink)" : "var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path
                d="M6.5 11V2M2.5 6L6.5 2l4 4"
                stroke={draft.trim() && !processing ? "#fff" : "var(--ink-3)"}
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({
  msg,
  onConfirm,
  onCancelConfirm,
}: {
  msg: ChatMessage;
  onConfirm: (id: string) => void;
  onCancelConfirm: (id: string) => void;
}) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", marginBottom: 12 }}>
      {!isUser && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 9, fontFamily: "var(--font-sans)", color: "var(--ink-3)" }}>{msg.time}</span>
        </div>
      )}
      {isUser && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 9, color: "var(--ink-3)" }}>{msg.time}</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: "var(--ink-2)" }}>You</span>
        </div>
      )}
      <div
        style={{
          maxWidth: "92%",
          background: isUser ? "var(--ink)" : "var(--paper)",
          color: isUser ? "#fff" : "var(--ink)",
          borderRadius: isUser ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
          padding: "10px 12px",
          fontSize: 13,
          lineHeight: 1.55,
          border: isUser ? "none" : "1px solid var(--border)",
        }}
      >
        {msg.text}
        {msg.resultCard && (
          <div
            style={{
              marginTop: 10,
              padding: "10px 12px",
              background: "var(--surface)",
              borderRadius: 10,
              border: "1px solid var(--border)",
            }}
          >
            <p style={{ fontSize: 10, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>{msg.resultCard.title}</p>
            {msg.resultCard.lines.map((line, i) => (
              <p key={i} style={{ fontSize: 11, color: "var(--ink-2)", margin: i > 0 ? "4px 0 0" : 0, lineHeight: 1.45 }}>
                {line}
              </p>
            ))}
          </div>
        )}
        {msg.confirmationId && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {msg.confirmationTitle && (
              <p style={{ fontSize: 11, fontWeight: 600, color: "var(--ink)" }}>{msg.confirmationTitle}</p>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => onConfirm(msg.confirmationId!)}
                style={{
                  flex: 1,
                  padding: "7px 0",
                  borderRadius: 8,
                  border: "none",
                  background: "var(--ink)",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => onCancelConfirm(msg.confirmationId!)}
                style={{
                  flex: 1,
                  padding: "7px 0",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      {msg.tag && (
        <div
          style={{
            marginTop: 4,
            fontSize: 9,
            fontWeight: 600,
            color: "var(--lime-dk)",
            background: "#E8F5EE",
            padding: "2px 8px",
            borderRadius: 99,
          }}
        >
          ✓ {msg.tag}
        </div>
      )}
    </div>
  );
}

function ChatExpandIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4 4.5h7a2 2 0 012 2v3.5H6.5A2.5 2.5 0 004 11.5V4.5z" stroke="var(--ink-3)" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M2.5 8L4 6.5 5.5 8" stroke="var(--ink-3)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export { ChatCollapseIcon, ChatExpandIcon };
