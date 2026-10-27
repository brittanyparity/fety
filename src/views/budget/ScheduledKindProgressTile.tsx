import type { ScheduledKindProgressRow } from "../../lib/scheduledKindProgress";

type BarState = {
  over: boolean;
  pct: number;
  variant: "default" | "tight" | "over";
  left: number;
};

function barState(actual: number, scheduled: number): BarState {
  const over = scheduled > 0 && actual > scheduled;
  const pct = scheduled > 0 ? Math.min(100, (actual / scheduled) * 100) : actual > 0 ? 100 : 0;
  const left = scheduled - actual;
  const tight = !over && scheduled > 0 && left <= 10;
  if (over) return { over: true, pct: 100, variant: "over", left };
  if (tight) return { over: false, pct, variant: "tight", left };
  return { over: false, pct, variant: "default", left };
}

function footCopy(row: ScheduledKindProgressRow, bar: BarState, usd: (n: number) => string): string {
  if (row.monthlyScheduled <= 0 && row.monthActual <= 0) return "Nothing scheduled";
  if (row.monthlyScheduled <= 0) return `${usd(row.monthActual)} this month`;
  if (bar.over) {
    return row.kind === "income" ? `${usd(row.monthActual - row.monthlyScheduled)} over plan` : `${usd(row.monthActual - row.monthlyScheduled)} over`;
  }
  if (row.kind === "income") return `${usd(Math.max(0, bar.left))} left to earn`;
  return `${usd(Math.max(0, bar.left))} left to allocate`;
}

export default function ScheduledKindProgressTile({
  row,
  usd,
}: {
  row: ScheduledKindProgressRow;
  usd: (n: number) => string;
}) {
  const bar = barState(row.monthActual, row.monthlyScheduled);

  return (
    <div className="fety-budget-category-tile fety-budget-scheduled-kind-tile">
      <div className="fety-budget-category-tile-top">
        <h3 className="fety-budget-category-name">
          <span className="fety-budget-category-icon" aria-hidden>
            {row.icon}
          </span>
          <span className="fety-budget-category-name-text">{row.label}</span>
        </h3>
      </div>
      <div className="fety-budget-category-amounts">
        <span className="fety-budget-category-spent">{usd(row.monthActual)}</span>
        <span className="fety-budget-category-cap">{usd(row.monthlyScheduled)}</span>
      </div>
      <div
        className="fety-budget-category-bar"
        role="progressbar"
        aria-valuenow={Math.round(bar.pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${row.label} progress this month`}
      >
        <div
          className={`fety-budget-category-bar-fill fety-budget-category-bar-fill--${bar.variant}`}
          style={{ width: `${bar.pct}%` }}
        />
      </div>
      <p className={`fety-budget-category-foot${bar.over ? " fety-budget-category-foot--over" : ""}`}>
        {footCopy(row, bar, usd)}
      </p>
    </div>
  );
}
