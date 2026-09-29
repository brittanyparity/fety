import { Pie, PieChart, Cell, ResponsiveContainer } from "recharts";
import type { FinancialAnalysis, InsightActionTarget } from "../types/analysis";
import { formatUsd } from "../lib/scheduleAmounts";

const DONUT = ["#111111", "#2E8F66", "#B8A6FF", "#D14A34", "#B07000", "#6B6B6B"];

export default function AnalysisReportView({
  analysis,
  onExplore,
  onTakeTour,
  onSkip,
}: {
  analysis: FinancialAnalysis;
  onExplore: (page: InsightActionTarget) => void;
  onTakeTour: () => void;
  onSkip: () => void;
}) {
  const empty = analysis.missing.income && analysis.missing.obligations && analysis.missing.flexible;
  const pieData = analysis.categoryShares.length
    ? analysis.categoryShares
    : [{ name: "None yet", monthly: 0, value: 100 }];

  return (
    <div className="fety-analysis">
      <div className="fety-analysis-inner">
        <p className="fety-label">Your picture</p>
        <h1>Here's what I found.</h1>
        <p className="fety-analysis-lede">
          {analysis.qualifier}, here's a quick picture of how your money is working right now.
        </p>

        <section className="fety-analysis-card" aria-labelledby="fety-snapshot-heading">
          <h2 id="fety-snapshot-heading">Financial snapshot</h2>
          {empty ? (
            <p>I need a little more information before I can tell you where your money is going.</p>
          ) : (
            <>
              <p className="fety-analysis-headline">
                {analysis.estimatedAvailable >= 0
                  ? `You have about ${formatUsd(analysis.estimatedAvailable)} left after your regular expenses.`
                  : `Regular expenses are about ${formatUsd(Math.abs(analysis.estimatedAvailable))} more than income right now.`}
              </p>
              <dl className="fety-analysis-stats">
                <div>
                  <dt>Expected income</dt>
                  <dd>{formatUsd(analysis.expectedMonthlyIncome)}</dd>
                </div>
                <div>
                  <dt>Regular obligations</dt>
                  <dd>{formatUsd(analysis.regularObligations)}</dd>
                </div>
                <div>
                  <dt>Everyday spending</dt>
                  <dd>{formatUsd(analysis.flexibleSpending)}</dd>
                </div>
                <div>
                  <dt>Available now</dt>
                  <dd>{formatUsd(analysis.currentBalance)}</dd>
                </div>
              </dl>
            </>
          )}
        </section>

        {analysis.categoryShares.length > 0 && (
          <section className="fety-analysis-card" aria-labelledby="fety-where-heading">
            <h2 id="fety-where-heading">Where regular money goes</h2>
            <p className="fety-analysis-headline">
              {analysis.categoryShares[0]
                ? `Most of your regular spending goes toward ${analysis.categoryShares[0].name.toLowerCase()}.`
                : "Here's the mix of spending you entered."}
            </p>
            <div className="fety-analysis-viz">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" innerRadius={48} outerRadius={74} paddingAngle={2} startAngle={90} endAngle={-270}>
                    {pieData.map((d, i) => (
                      <Cell key={d.name} fill={DONUT[i % DONUT.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <ul className="fety-analysis-legend">
                {analysis.categoryShares.map((d, i) => (
                  <li key={d.name}>
                    <span className="fety-analysis-swatch" style={{ background: DONUT[i % DONUT.length] }} />
                    <span>{d.name}</span>
                    <strong>{d.value}% · {formatUsd(d.monthly)}</strong>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <section className="fety-analysis-card" aria-labelledby="fety-stands-heading">
          <h2 id="fety-stands-heading">What stands out</h2>
          <ol className="fety-analysis-insights">
            {analysis.insights.map((insight) => (
              <li key={insight.id}>
                <h3>{insight.title}</h3>
                <p>{insight.explanation}</p>
                {insight.actionLabel && insight.actionTarget ? (
                  <button
                    type="button"
                    className="fety-analysis-link"
                    onClick={() => onExplore(insight.actionTarget)}
                  >
                    {insight.actionLabel}
                  </button>
                ) : null}
              </li>
            ))}
          </ol>
        </section>

        <div className="fety-analysis-cta">
          <p>Want to see how this works?</p>
          <button type="button" className="fety-splash-btn-primary fety-splash-btn-lg" onClick={onTakeTour}>
            Take a tour
          </button>
          <button type="button" className="fety-talk-skip" onClick={onSkip}>
            Skip and explore
          </button>
        </div>
      </div>
    </div>
  );
}