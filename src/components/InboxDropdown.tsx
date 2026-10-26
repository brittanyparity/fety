import { useEffect, useMemo, useRef, useState } from "react";
import { resolveInsightTipSlots } from "../lib/insightTips";
import ThingsToTryList from "./ThingsToTryList";
import type { FinancialAnalysis, FetyActionTarget } from "../types/analysis";
import type { FetyStore } from "../types/fety";

function InboxIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M3.25 5.25h11.5a.75.75 0 0 1 .75.75v7.5a.75.75 0 0 1-.75.75H3.25a.75.75 0 0 1-.75-.75V6a.75.75 0 0 1 .75-.75z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M3.25 5.25 7.5 9h3L14.75 5.25"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function InboxDropdown({
  store,
  analysis,
  onOpenInbox,
  onAction,
  onMarkDone,
  onArchive,
}: {
  store: FetyStore;
  analysis: FinancialAnalysis;
  onOpenInbox: (tipId?: string) => void;
  onAction: (action: FetyActionTarget) => void;
  onMarkDone: (tipId: string) => void;
  onArchive: (tipId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);

  const slots = useMemo(
    () => resolveInsightTipSlots(store, analysis),
    [store, analysis, store.insightTipProgress],
  );

  const pendingCount = useMemo(() => slots.filter((s) => !s.done).length, [slots]);

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 180);
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => () => clearCloseTimer(), []);

  const handleAction = (action: FetyActionTarget) => {
    onAction(action);
    setOpen(false);
  };

  const openMessage = (tipId: string) => {
    onOpenInbox(tipId);
    setOpen(false);
  };

  return (
    <div
      className="fety-nav-suggestions-wrap"
      ref={wrapRef}
      onMouseEnter={() => {
        clearCloseTimer();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        title="Inbox"
        aria-label={pendingCount > 0 ? `Inbox, ${pendingCount} unread` : "Inbox"}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          clearCloseTimer();
          onOpenInbox();
          setOpen(false);
        }}
        className={`fety-nav-suggestions${open ? " fety-nav-suggestions-open" : ""}`}
      >
        <InboxIcon />
        {pendingCount > 0 ? <span className="fety-nav-suggestions-dot" aria-hidden /> : null}
      </button>
      {open ? (
        <div
          className="fety-nav-suggestions-menu"
          role="dialog"
          aria-label="Inbox preview"
          onMouseEnter={clearCloseTimer}
          onMouseLeave={scheduleClose}
        >
          <div className="fety-nav-suggestions-menu-head">
            <p className="fety-nav-suggestions-menu-title">Inbox</p>
            <button
              type="button"
              className="fety-nav-suggestions-menu-all"
              onClick={() => {
                onOpenInbox();
                setOpen(false);
              }}
            >
              View all
            </button>
          </div>
          {slots.length === 0 ? (
            <p className="fety-nav-suggestions-empty">No messages right now — check back after you add more money details.</p>
          ) : (
            <ThingsToTryList
              layout="menu"
              slots={slots}
              onSelectMessage={openMessage}
              onAction={handleAction}
              onMarkDone={onMarkDone}
              onArchive={onArchive}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
