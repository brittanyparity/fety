import type { FinanceSummary } from "../types/fety";

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

const usdSigned = (n: number, sign: "+" | "-" | "") => {
  if (sign === "+") return `+${usd(Math.abs(n))}`;
  if (sign === "-") return `-${usd(Math.abs(n))}`;
  return usd(n);
};

export function DashboardHero({ summary }: { summary: FinanceSummary }) {
  const barPct = summary.weeklyUsedPct;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 18 }}>
      <div
        style={{
          background: "var(--amber)",
          borderRadius: "var(--radius-card)",
          padding: "22px 24px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 20,
        }}
      >
        <div>
          <p className="fety-label" style={{ color: "var(--ink)", marginBottom: 10 }}>
            Spending power · this week
          </p>
          <p className="fety-figure" style={{ fontSize: 56, letterSpacing: "-0.03em" }}>
            {usd(summary.weeklySpendingPower)}
          </p>
          <p style={{ fontSize: 14, color: "var(--ink-2)", marginTop: 8 }}>
            Safe to spend through Sunday
          </p>
        </div>
        <div style={{ minWidth: 200, flex: "1 1 200px", maxWidth: 320 }}>
          <div
            style={{
              height: 8,
              background: "rgba(17,17,17,0.2)",
              borderRadius: "var(--radius-track)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${barPct}%`,
                height: "100%",
                background: "var(--ink)",
                borderRadius: "var(--radius-track)",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 8,
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "var(--ink)",
            }}
          >
            <span>
              {usd(summary.weeklySpent)} of {usd(summary.weeklyBudget)}
            </span>
            <span>{barPct}%</span>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
        }}
      >
        {[
          { label: "Balance", value: usd(summary.balanceThroughToday), accent: "var(--clear-dk)", dot: "var(--clear)" },
          { label: "In today", value: usdSigned(summary.moneyInToday, "+"), accent: "var(--clear-dk)", dot: "var(--clear)" },
          { label: "Out today", value: usdSigned(summary.moneyOutToday, "-"), accent: "var(--trouble-dk)", dot: "var(--trouble)" },
          { label: "Savings", value: usd(summary.savingsTotal), accent: "var(--later-dk)", dot: "var(--later)" },
        ].map((c) => (
          <div
            key={c.label}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-card)",
              padding: "14px 16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "var(--radius-marker)",
                  background: c.dot,
                  flexShrink: 0,
                }}
              />
              <span className="fety-label" style={{ fontSize: 9 }}>
                {c.label}
              </span>
            </div>
            <p style={{ fontSize: 22, fontWeight: 400, color: c.accent, letterSpacing: "-0.02em" }}>{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
