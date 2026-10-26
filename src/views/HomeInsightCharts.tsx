import { useMemo, useState } from "react";
import WidgetPeriodFilter from "../components/WidgetPeriodFilter";
import { formatDisplayDate } from "../lib/fetyCalculations";
import {
  computeSpendingMixInsight,
  goalsContributionForPeriod,
  spendingMixPeriodAdverb,
  spendingMixPeriodLabel,
  spendingPowerBalanceBar,
  type SpendingMixPeriod,
} from "../lib/spendingMixInsight";
import type { FinancialAnalysis } from "../types/analysis";
import type { FinanceSummary, FetyStore } from "../types/fety";
import { formatUsd } from "../lib/scheduleAmounts";
import { CategoryMixChart, IncomeAllocationChart, categoryMixPieData } from "./InsightsBriefing";

type InsightChartTab = "picture" | "mix" | "power";

const POWER_PERIOD_OPTIONS: { id: SpendingMixPeriod; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

function SpendingPowerPanel({
  analysis,
  summary,
  store,
  focusDateISO,
}: {
  analysis: FinancialAnalysis;
  summary: FinanceSummary;
  store: FetyStore;
  focusDateISO: string;
}) {
  const [period, setPeriod] = useState<SpendingMixPeriod>("weekly");
  const ref = useMemo(() => new Date(`${focusDateISO}T12:00:00`), [focusDateISO]);
  const insight = useMemo(
    () => computeSpendingMixInsight(analysis, summary, ref, period),
    [analysis, summary, ref, period],
  );
  const periodWord = spendingMixPeriodLabel(period);
  const periodAdverb = spendingMixPeriodAdverb(period);
  const goalsPeriodAmount = useMemo(
    () => goalsContributionForPeriod(store, period),
    [store, period],
  );
  const balanceBar = spendingPowerBalanceBar(insight, analysis.regularObligations, goalsPeriodAmount);

  return (
    <div className="fety-home-spending-mix">
      <div className="fety-home-spending-mix-head">
        <p className="fety-home-spending-mix-explainer">
          About <strong>{formatUsd(insight.periodPower)}</strong> per {periodWord} is what you can spend on a{" "}
          {periodAdverb} basis before your balance would go negative — spreading what&apos;s left through the rest of
          this month.
        </p>
        <WidgetPeriodFilter
          options={POWER_PERIOD_OPTIONS}
          value={period}
          onChange={setPeriod}
          ariaLabel="Spending power period"
        />
      </div>

      <div className="fety-home-spending-mix-hero">
        <p className="fety-home-spending-mix-amount">{formatUsd(insight.periodPower)}</p>
        <p className="fety-home-spending-mix-hero-label">Available per {periodWord}</p>
      </div>

      <div className="fety-home-spending-power-balance">
        <div className="fety-home-spending-power-balance-head">
          <span className="fety-home-spending-power-balance-title">Your balance</span>
          <span className="fety-home-spending-power-balance-total">{formatUsd(balanceBar.balance)}</span>
        </div>
        {balanceBar.balance <= 0 ? (
          <p className="fety-home-insight-lede">Add a balance in setup to see how it splits between expenses and spending power.</p>
        ) : (
          <>
            <div
              className="fety-home-spending-power-balance-track"
              role="img"
              aria-label={`Balance ${formatUsd(balanceBar.balance)}: ${formatUsd(balanceBar.budgetedExpenses)} budgeted expenses, ${formatUsd(balanceBar.goalsAmount)} ${periodAdverb} goal allocation, ${formatUsd(balanceBar.spendingPowerAmount)} ${periodAdverb} spending power, ${formatUsd(balanceBar.remainder)} unallocated`}
            >
              {balanceBar.budgetedPct > 0 ? (
                <div
                  className="fety-home-spending-power-balance-seg fety-home-spending-power-balance-seg--expenses"
                  style={{ width: `${balanceBar.budgetedPct}%` }}
                  title={`Budgeted expenses ${formatUsd(balanceBar.budgetedExpenses)}`}
                />
              ) : null}
              {balanceBar.goalsPct > 0 ? (
                <div
                  className="fety-home-spending-power-balance-seg fety-home-spending-power-balance-seg--goals"
                  style={{ width: `${balanceBar.goalsPct}%` }}
                  title={`Goal allocation ${formatUsd(balanceBar.goalsAmount)} per ${periodWord}`}
                />
              ) : null}
              {balanceBar.powerPct > 0 ? (
                <div
                  className="fety-home-spending-power-balance-seg fety-home-spending-power-balance-seg--power"
                  style={{ width: `${balanceBar.powerPct}%` }}
                  title={`Spending power ${formatUsd(balanceBar.spendingPowerAmount)}`}
                />
              ) : null}
              {balanceBar.remainderPct > 0 ? (
                <div
                  className="fety-home-spending-power-balance-seg fety-home-spending-power-balance-seg--rest"
                  style={{ width: `${balanceBar.remainderPct}%` }}
                  title={`Unallocated ${formatUsd(balanceBar.remainder)}`}
                />
              ) : null}
            </div>
            <div className="fety-home-spending-power-balance-legend">
              <span>
                <i className="fety-home-spending-power-balance-swatch fety-home-spending-power-balance-swatch--expenses" />
                Budgeted expenses · {formatUsd(balanceBar.budgetedExpenses)}
              </span>
              {balanceBar.goalsAmount > 0.005 ? (
                <span>
                  <i className="fety-home-spending-power-balance-swatch fety-home-spending-power-balance-swatch--goals" />
                  {periodAdverb.charAt(0).toUpperCase() + periodAdverb.slice(1)} goals ·{" "}
                  {formatUsd(balanceBar.goalsAmount)}
                </span>
              ) : null}
              <span>
                <i className="fety-home-spending-power-balance-swatch fety-home-spending-power-balance-swatch--power" />
                {periodAdverb.charAt(0).toUpperCase() + periodAdverb.slice(1)} spending power ·{" "}
                {formatUsd(balanceBar.spendingPowerAmount)}
              </span>
              {balanceBar.remainder > 0.005 ? (
                <span>
                  <i className="fety-home-spending-power-balance-swatch fety-home-spending-power-balance-swatch--rest" />
                  Unallocated · {formatUsd(balanceBar.remainder)}
                </span>
              ) : null}
            </div>
            <p className="fety-home-spending-mix-bar-caption">
              The full bar is your current balance. Dark gray is regular budgeted expenses (
              {formatUsd(analysis.regularObligations)}/month on file).
              {balanceBar.goalsAmount > 0.005
                ? ` Purple is your planned goal contribution (${formatUsd(goalsPeriodAmount)} per ${periodWord}).`
                : ""}{" "}
              Green is your {formatUsd(insight.periodPower)} per-{periodWord} spending power before going negative.
              Light gray is unallocated cash.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function HomeInsightCharts({
  analysis,
  summary,
  store,
  focusDateISO,
}: {
  analysis: FinancialAnalysis;
  summary: FinanceSummary;
  store: FetyStore;
  focusDateISO: string;
}) {
  const [tab, setTab] = useState<InsightChartTab>("picture");
  const mixLegend = useMemo(() => categoryMixPieData(analysis), [analysis]);
  const empty = analysis.missing.income && analysis.missing.obligations && analysis.missing.flexible;
  const dayLabel = formatDisplayDate(focusDateISO);

  const goalsMonthly = analysis.goalsMonthlyContributions;
  const incomeAvailable = Math.max(
    0,
    analysis.expectedMonthlyIncome - analysis.regularObligations - goalsMonthly,
  );

  const pictureLede = empty
    ? "Add income or regular expenses and this snapshot will fill in."
    : `As of ${dayLabel}: ${formatUsd(summary.balance)} ending balance. Monthly picture — about ${formatUsd(analysis.expectedMonthlyIncome)} income with ${formatUsd(analysis.regularObligations)} toward regular expenses${goalsMonthly > 0 ? ` and ${formatUsd(goalsMonthly)} toward goals` : ""}.`;

  const mixBudgetTotal = useMemo(
    () => mixLegend.reduce((s, d) => s + d.amount, 0),
    [mixLegend],
  );
  const mixLede =
    mixLegend.length === 0
      ? "Add budget categories with monthly amounts to see how your plan is divided."
      : mixBudgetTotal > 0
        ? `All ${mixLegend.length} budget categories — ${formatUsd(mixBudgetTotal)} planned per month as of ${dayLabel}.`
        : "Set monthly amounts on your budget categories to fill in this mix.";

  return (
    <div className="fety-home-insight-charts">
      <div className="fety-home-insight-tabs" role="tablist" aria-label="Insight sections">
        <button
          type="button"
          role="tab"
          id="fety-home-insight-tab-picture"
          aria-selected={tab === "picture"}
          aria-controls="fety-home-insight-panel-picture"
          className={`fety-home-insight-tab${tab === "picture" ? " fety-home-insight-tab-active" : ""}`}
          onClick={() => setTab("picture")}
        >
          Income
        </button>
        <button
          type="button"
          role="tab"
          id="fety-home-insight-tab-mix"
          aria-selected={tab === "mix"}
          aria-controls="fety-home-insight-panel-mix"
          className={`fety-home-insight-tab${tab === "mix" ? " fety-home-insight-tab-active" : ""}`}
          onClick={() => setTab("mix")}
        >
          Budget mix
        </button>
        <button
          type="button"
          role="tab"
          id="fety-home-insight-tab-power"
          aria-selected={tab === "power"}
          aria-controls="fety-home-insight-panel-power"
          className={`fety-home-insight-tab${tab === "power" ? " fety-home-insight-tab-active" : ""}`}
          onClick={() => setTab("power")}
        >
          Spending power
        </button>
      </div>

      {tab === "picture" ? (
        <div
          id="fety-home-insight-panel-picture"
          className="fety-home-insight-panel fety-home-insight-panel--vcenter"
          role="tabpanel"
          aria-labelledby="fety-home-insight-tab-picture"
        >
          <div className="fety-home-insight-split">
            <div className="fety-home-insight-copy">
              <p className="fety-home-insight-lede">{pictureLede}</p>
              <dl className="fety-analysis-stats fety-analysis-stats--compact fety-analysis-stats--picture-grid">
                <div>
                  <dt>Income</dt>
                  <dd>{formatUsd(analysis.expectedMonthlyIncome)}</dd>
                </div>
                <div>
                  <dt>Expenses</dt>
                  <dd>{formatUsd(analysis.regularObligations)}</dd>
                </div>
                <div>
                  <dt>Goals</dt>
                  <dd>{formatUsd(goalsMonthly)}</dd>
                </div>
                <div>
                  <dt>Available</dt>
                  <dd>{formatUsd(incomeAvailable)}</dd>
                </div>
              </dl>
            </div>
            <div className="fety-home-insight-visual">
              <IncomeAllocationChart analysis={analysis} size={180} />
            </div>
          </div>
        </div>
      ) : null}

      {tab === "mix" ? (
        <div
          id="fety-home-insight-panel-mix"
          className="fety-home-insight-panel fety-home-insight-panel--vcenter"
          role="tabpanel"
          aria-labelledby="fety-home-insight-tab-mix"
        >
          <div className="fety-home-insight-split">
            <div className="fety-home-insight-copy">
              <p className="fety-home-insight-lede">{mixLede}</p>
              <ul className="fety-analysis-legend fety-analysis-legend--compact fety-analysis-legend--two-col">
                {mixLegend.map((d) => (
                  <li key={d.name}>
                    <span className="fety-analysis-swatch" style={{ background: d.fill }} />
                    <span>{d.name}</span>
                    <strong>
                      {d.pct}% · {formatUsd(d.amount)}
                    </strong>
                  </li>
                ))}
              </ul>
            </div>
            <div className="fety-home-insight-visual fety-home-insight-visual--center">
              <CategoryMixChart analysis={analysis} size={200} />
            </div>
          </div>
        </div>
      ) : null}

      {tab === "power" ? (
        <div
          id="fety-home-insight-panel-power"
          className="fety-home-insight-panel"
          role="tabpanel"
          aria-labelledby="fety-home-insight-tab-power"
        >
          <SpendingPowerPanel
            analysis={analysis}
            summary={summary}
            store={store}
            focusDateISO={focusDateISO}
          />
        </div>
      ) : null}
    </div>
  );
}
