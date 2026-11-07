import type { FinanceSummary, FetyStore } from "../types/fety";
import { incomeScheduledTotalInMonth } from "../lib/scheduleMonthTotals";

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export default function MobileBudgetTab({
  summary,
  incomeStreams,
}: {
  summary: FinanceSummary;
  incomeStreams: FetyStore["incomeStreams"];
  store: FetyStore;
}) {
  const monthRef = new Date();
  const monthlyIncome = incomeScheduledTotalInMonth(incomeStreams ?? [], monthRef);
  const categories = summary.categoriesWithSpent.filter((c) => c.name.trim().toLowerCase() !== "housing");
  const totalBudget = categories.reduce((s, c) => s + c.monthlyBudget, 0);
  const totalSpent = categories.reduce((s, c) => s + c.spent, 0);

  return (
    <div className="fety-mobile-budget">
      <h2 className="fety-mobile-section-title">This month</h2>
      <dl className="fety-mobile-stat-grid">
        <div>
          <dt>Income</dt>
          <dd>{usd(monthlyIncome)}</dd>
        </div>
        <div>
          <dt>Budgeted</dt>
          <dd>{usd(totalBudget)}</dd>
        </div>
        <div>
          <dt>Spent</dt>
          <dd>{usd(totalSpent)}</dd>
        </div>
      </dl>
      <h3 className="fety-mobile-subtitle">Categories</h3>
      <ul className="fety-mobile-budget-list">
        {categories.map((c) => {
          const pct = c.monthlyBudget > 0 ? Math.min(100, Math.round((c.spent / c.monthlyBudget) * 100)) : 0;
          const over = c.spent > c.monthlyBudget && c.monthlyBudget > 0;
          return (
            <li key={c.id} className="fety-mobile-budget-row">
              <div className="fety-mobile-budget-row-head">
                <span>
                  {c.icon} {c.name}
                </span>
                <span>
                  {usd(c.spent)} / {usd(c.monthlyBudget)}
                </span>
              </div>
              {c.monthlyBudget > 0 ? (
                <div className="fety-mobile-budget-track">
                  <div
                    className={`fety-mobile-budget-fill${over ? " fety-mobile-budget-fill--over" : ""}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              ) : (
                <p className="fety-mobile-muted">No monthly cap</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
