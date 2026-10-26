import { useEffect, useMemo, useState } from "react";
import { resolveInsightTipSlots } from "../lib/insightTips";
import type { FinancialAnalysis, FetyActionTarget } from "../types/analysis";
import type { FetyStore } from "../types/fety";

export default function InboxView({
  store,
  analysis,
  focusTipId,
  onFocusTipConsumed,
  onAction,
  onMarkDone,
  onArchive,
}: {
  store: FetyStore;
  analysis: FinancialAnalysis;
  focusTipId: string | null;
  onFocusTipConsumed: () => void;
  onAction: (action: FetyActionTarget) => void;
  onMarkDone: (tipId: string) => void;
  onArchive: (tipId: string) => void;
}) {
  const slots = useMemo(
    () => resolveInsightTipSlots(store, analysis),
    [store, analysis, store.insightTipProgress],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (slots.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => {
      if (focusTipId && slots.some((s) => s.tip.id === focusTipId)) return focusTipId;
      if (prev && slots.some((s) => s.tip.id === prev)) return prev;
      return slots[0].tip.id;
    });
  }, [focusTipId, slots]);

  useEffect(() => {
    if (!focusTipId || !slots.some((s) => s.tip.id === focusTipId)) return;
    const t = window.setTimeout(() => {
      document.getElementById(`inbox-row-${focusTipId}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      document.getElementById(`inbox-message-${focusTipId}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 50);
    onFocusTipConsumed();
    return () => window.clearTimeout(t);
  }, [focusTipId, slots, onFocusTipConsumed]);

  const selected = slots.find((s) => s.tip.id === selectedId) ?? null;

  if (slots.length === 0) {
    return (
      <div className="fety-inbox-empty">
        <p>No messages yet. As you use Fety, tips and updates will show up here.</p>
      </div>
    );
  }

  return (
    <div className="fety-inbox">
      <ul className="fety-inbox-list" aria-label="Message list">
        {slots.map(({ tip, done }) => {
          const active = tip.id === selectedId;
          return (
            <li key={tip.id}>
              <button
                type="button"
                id={`inbox-row-${tip.id}`}
                className={`fety-inbox-list-item${active ? " fety-inbox-list-item-active" : ""}${done ? " fety-inbox-list-item--done" : ""}`}
                onClick={() => setSelectedId(tip.id)}
              >
                <span className="fety-inbox-list-item-title">{tip.title}</span>
                <span className="fety-inbox-list-item-preview">{tip.explanation}</span>
                {done ? <span className="fety-inbox-list-item-badge">Done</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
      {selected ? (
        <article
          id={`inbox-message-${selected.tip.id}`}
          className={`fety-inbox-detail${selected.done ? " fety-inbox-detail--done" : ""}`}
        >
          {selected.done ? <p className="fety-insights-try-badge">Done</p> : null}
          <h2>{selected.tip.title}</h2>
          <p className="fety-inbox-detail-body">{selected.tip.explanation}</p>
          <div className="fety-insights-try-actions">
            {selected.tip.actionLabel && selected.tip.action ? (
              <button
                type="button"
                className="fety-splash-btn-primary fety-inbox-detail-primary"
                onClick={() => onAction(selected.tip.action!)}
              >
                {selected.tip.actionLabel}
              </button>
            ) : null}
            {!selected.done ? (
              <button type="button" className="fety-insights-try-secondary" onClick={() => onMarkDone(selected.tip.id)}>
                Mark done
              </button>
            ) : null}
            <button type="button" className="fety-insights-try-secondary" onClick={() => onArchive(selected.tip.id)}>
              Archive
            </button>
          </div>
        </article>
      ) : null}
    </div>
  );
}
