import { useMemo } from "react";
import { resolveInsightTipSlots } from "../lib/insightTips";
import type { FinancialAnalysis, FetyActionTarget } from "../types/analysis";
import type { FetyStore } from "../types/fety";

export default function HomeThingsToTry({
  store,
  analysis,
  onAction,
  onMarkDone,
  onArchive,
}: {
  store: FetyStore;
  analysis: FinancialAnalysis;
  onAction: (action: FetyActionTarget) => void;
  onMarkDone: (tipId: string) => void;
  onArchive: (tipId: string) => void;
}) {
  const slots = useMemo(
    () => resolveInsightTipSlots(store, analysis),
    [store, analysis, store.insightTipProgress],
  );

  return (
    <div className="fety-insights-try-grid fety-insights-try-grid--home">
      {slots.map(({ tip, done }) => (
        <article key={tip.id} className={`fety-insights-try-card${done ? " fety-insights-try-card--done" : ""}`}>
          {done ? <p className="fety-insights-try-badge">Done</p> : null}
          <h3>{tip.title}</h3>
          <p>{tip.explanation}</p>
          <div className="fety-insights-try-actions">
            {tip.actionLabel && tip.action ? (
              <button type="button" className="fety-analysis-link" onClick={() => onAction(tip.action!)}>
                {tip.actionLabel}
              </button>
            ) : null}
            {!done ? (
              <button type="button" className="fety-insights-try-secondary" onClick={() => onMarkDone(tip.id)}>
                Mark done
              </button>
            ) : null}
            <button type="button" className="fety-insights-try-secondary" onClick={() => onArchive(tip.id)}>
              Archive
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
