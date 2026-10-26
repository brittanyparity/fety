import type { InsightTipSlot } from "../lib/insightTips";
import type { FetyActionTarget } from "../types/analysis";

export default function ThingsToTryList({
  slots,
  layout,
  onSelectMessage,
  onAction,
  onMarkDone,
  onArchive,
}: {
  slots: InsightTipSlot[];
  layout: "grid" | "menu";
  onSelectMessage?: (tipId: string) => void;
  onAction: (action: FetyActionTarget) => void;
  onMarkDone: (tipId: string) => void;
  onArchive: (tipId: string) => void;
}) {
  if (layout === "menu") {
    return (
      <ul className="fety-nav-suggestions-list">
        {slots.map(({ tip, done }) => (
          <li key={tip.id} className={`fety-nav-suggestions-item${done ? " fety-nav-suggestions-item--done" : ""}`}>
            <div className="fety-nav-suggestions-item-body">
              {done ? <p className="fety-insights-try-badge">Done</p> : null}
              <button
                type="button"
                className="fety-nav-suggestions-item-open"
                onClick={() => onSelectMessage?.(tip.id)}
              >
                <span className="fety-nav-suggestions-item-title">{tip.title}</span>
                <span className="fety-nav-suggestions-item-text">{tip.explanation}</span>
              </button>
              <div className="fety-insights-try-actions fety-nav-suggestions-item-actions">
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
            </div>
          </li>
        ))}
      </ul>
    );
  }

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
