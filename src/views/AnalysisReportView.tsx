import { useEffect } from "react";
import type { FinancialAnalysis, FetyActionTarget } from "../types/analysis";
import { formatUsd } from "../lib/scheduleAmounts";

const DONUT = ["#111111", "#2E8F66", "#B8A6FF", "#D14A34", "#B07000", "#6B6B6B"];

export default function DashboardBriefing({
  analysis,
  firstLook,
  highlightTarget,
  onAction,
}: {
  analysis: FinancialAnalysis;
  firstLook: boolean;
  highlightTarget?: string | null;
  onAction: (action: FetyActionTarget) => void;
}) {
  const empty = analysis.missing.income && analysis.missing.obligations && analysis.missing.flexible;
  const tip = analysis.tips[0];
  const ring = (id: string) => (highlightTarget === id ? " fety-tour-ring" : "");

  useEffect(() => {
    if (!highlightTarget) return;
    const el = document.querySelector(`[data-tour-id="${highlightTarget}"]`);
    if (el instanceof HTMLElement) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightTarget]);

  return (
    <div className="fety-briefing">
      <div className={`fety-briefing-hero${ring("snapshot")}`} data-tour-id="snapshot">
        <p className="fety-label">{firstLook ? "Your picture" : "What's happening"}</p>
        <h2>{firstLook ? "Here's what I found." : "Here's what's happening with your money."}</h2>
        <p className="fety-briefing-lede">
          {empty
            ? "Add a little income or a regular expense and this snapshot will fill in."
            : `You have about ${formatUsd(analysis.expectedMonthlyIncome)} coming in each month, with approximately ${formatUsd(analysis.regularObligations)} going toward regular expenses. That leaves about ${formatUsd(Math.max(0, analysis.expectedMonthlyIncome - analysis.regularObligations))} for flexible spending, saving, and other priorities.`}
        </p>
        <dl className="fety-analysis-stats">
          <div data-tour-id="snapshot-income" className={ring("snapshot-income").trim()}>
            <dt>Income</dt>
            <dd>{formatUsd(analysis.expectedMonthlyIncome)}</dd>
          </div>
          <div data-tour-id="snapshot-obligations" className={ring("snapshot-obligations").trim()}>
            <dt>Regular expenses</dt>
            <dd>{formatUsd(analysis.regularObligations)}</dd>
          </div>
          <div>
            <dt>Flexible spending</dt>
            <dd>{formatUsd(analysis.flexibleSpending)}</dd>
          </div>
          <div data-tour-id="snapshot-available" className={ring("snapshot-available").trim()}>
            <dt>Available after regulars</dt>
            <dd>{formatUsd(analysis.expectedMonthlyIncome - analysis.regularObligations)}</dd>
          </div>
        </dl>
      </div>

      {analysis.insights.length > 0 && (
        <section className="fety-briefing-card" aria-labelledby="fety-noticed-heading">
          <h3 id="fety-noticed-heading">What I noticed</h3>
          <ol className="fety-analysis-insights">
            {analysis.insights.slice(0, 3).map((insight) => (
              <li key={insight.id}>
                <h4>{insight.title}</h4>
                <p>{insight.explanation}</p>
                {insight.actionLabel && insight.action ? (
                  <button type="button" className="fety-analysis-link" onClick={() => onAction(insight.action!)}>
                    {insight.actionLabel}
                  </button>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      )}

      {analysis.categoryShares.length > 0 && (
        <section className="fety-briefing-card">
          <h3>Your spending mix</h3>
          <ul className="fety-analysis-legend">
            {analysis.categoryShares.slice(0, 5).map((d, i) => (
              <li key={d.name}>
                <span className="fety-analysis-swatch" style={{ background: DONUT[i % DONUT.length] }} />
                <span>{d.name}</span>
                <strong>
                  {d.value}% · {formatUsd(d.monthly)}
                </strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tip && (
        <section
          className={`fety-briefing-card fety-briefing-tip${ring("tip-card")}`}
          data-tour-id="tip-card"
          aria-labelledby="fety-try-heading"
        >
          <h3 id="fety-try-heading">One thing you can try</h3>
          <h4>{tip.title}</h4>
          <p>{tip.explanation}</p>
          {tip.actionLabel && tip.action ? (
            <button type="button" className="fety-splash-btn-primary" onClick={() => onAction(tip.action!)}>
              {tip.actionLabel}
            </button>
          ) : null}
        </section>
      )}
    </div>
  );
}