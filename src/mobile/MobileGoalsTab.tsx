import { goalSavedTotal } from "../lib/ledger";
import type { FetyStore } from "../types/fety";

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export default function MobileGoalsTab({ store }: { store: FetyStore }) {
  const goals = store.goals;

  return (
    <div className="fety-mobile-goals">
      <h2 className="fety-mobile-section-title">Savings goals</h2>
      {goals.length === 0 ? (
        <p className="fety-mobile-empty">No goals yet. Add goals from desktop or complete setup to track savings here.</p>
      ) : (
        <ul className="fety-mobile-goal-list">
          {goals.map((g) => {
            const saved = goalSavedTotal(store, g);
            const target = g.target ?? 0;
            const pct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
            return (
              <li key={g.id} className="fety-mobile-goal-card">
                <div className="fety-mobile-goal-card-head">
                  <span className="fety-mobile-goal-icon" aria-hidden>
                    {g.icon}
                  </span>
                  <div>
                    <p className="fety-mobile-goal-name">{g.name}</p>
                    <p className="fety-mobile-goal-amt">
                      {usd(saved)}
                      {target > 0 ? ` · ${pct}% of ${usd(target)}` : ""}
                    </p>
                  </div>
                </div>
                {target > 0 ? (
                  <div className="fety-mobile-budget-track">
                    <div className="fety-mobile-budget-fill" style={{ width: `${pct}%` }} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
