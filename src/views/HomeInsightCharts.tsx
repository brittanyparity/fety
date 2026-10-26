import { useMemo, useState } from "react";
import { formatDisplayDate } from "../lib/fetyCalculations";
import type { FinancialAnalysis } from "../types/analysis";
import type { FinanceSummary } from "../types/fety";
import { formatUsd } from "../lib/scheduleAmounts";
import {
  CategoryMixChart,
  IncomeAllocationBars,
  IncomeAllocationChart,
  categoryDonutData,
} from "./InsightsBriefing";

type InsightChartTab = "picture" | "mix";

export default function HomeInsightCharts({
  analysis,
  summary,
  focusDateISO,
}: {
  analysis: FinancialAnalysis;
  summary: FinanceSummary;
  focusDateISO: string;
}) {
  const [tab, setTab] = useState<InsightChartTab>("picture");
  const mixLegend = useMemo(() => categoryDonutData(analysis), [analysis]);
  const empty = analysis.missing.income && analysis.missing.obligations && analysis.missing.flexible;
  const dayLabel = formatDisplayDate(focusDateISO);

  const pictureLede = empty
    ? "Add income or regular expenses and this snapshot will fill in."
    : `As of ${dayLabel}: ${formatUsd(summary.balance)} ending balance. Monthly picture — about ${formatUsd(analysis.expectedMonthlyIncome)} income with ${formatUsd(analysis.regularObligations)} toward regular expenses.`;

  return (
    <div className="fety-home-insight-charts">
      <div className="fety-home-insight-tabs" role="tablist" aria-label="Insight charts">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "picture"}
          className={`fety-home-insight-tab${tab === "picture" ? " fety-home-insight-tab-active" : ""}`}
          onClick={() => setTab("picture")}
        >
          Your picture
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "mix"}
          className={`fety-home-insight-tab${tab === "mix" ? " fety-home-insight-tab-active" : ""}`}
          onClick={() => setTab("mix")}
        >
          Spending mix
        </button>
      </div>
      {tab === "picture" ? (
        <div className="fety-home-insight-panel" role="tabpanel">
          <p className="fety-home-insight-lede">{pictureLede}</p>
          <dl className="fety-analysis-stats fety-analysis-stats--compact">
            <div>
              <dt>Income</dt>
              <dd>{formatUsd(analysis.expectedMonthlyIncome)}</dd>
            </div>
            <div>
              <dt>Regular expenses</dt>
              <dd>{formatUsd(analysis.regularObligations)}</dd>
            </div>
            <div>
              <dt>Flexible</dt>
              <dd>{formatUsd(analysis.flexibleSpending)}</dd>
            </div>
            <div>
              <dt>Available</dt>
              <dd>{formatUsd(Math.max(0, analysis.estimatedAvailable))}</dd>
            </div>
          </dl>
          <div className="fety-home-insight-visual">
            <IncomeAllocationChart analysis={analysis} size={180} />
            <IncomeAllocationBars analysis={analysis} />
          </div>
        </div>
      ) : (
        <div className="fety-home-insight-panel" role="tabpanel">
          <p className="fety-home-insight-lede">
            {mixLegend.length === 0
              ? `Category budgets and spending logged through ${dayLabel} shape this mix.`
              : `Largest everyday categories by monthly budget (month containing ${dayLabel}).`}
          </p>
          <ul className="fety-analysis-legend fety-analysis-legend--compact">
            {mixLegend.map((d) => (
              <li key={d.name}>
                <span className="fety-analysis-swatch" style={{ background: d.fill }} />
                <span>{d.name}</span>
                <strong>
                  {d.value}% · {formatUsd(d.amount)}
                </strong>
              </li>
            ))}
          </ul>
          <div className="fety-home-insight-visual">
            <CategoryMixChart analysis={analysis} size={200} />
          </div>
        </div>
      )}
    </div>
  );
}
