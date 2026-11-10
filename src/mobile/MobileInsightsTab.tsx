import { useMemo } from "react";
import { computeSummary } from "../lib/fetyCalculations";
import { analyzeStore } from "../lib/financialAnalysis";
import type { FetyStore } from "../types/fety";
import HomeInsightCharts from "../views/HomeInsightCharts";

export default function MobileInsightsTab({
  store,
  focusDateISO,
}: {
  store: FetyStore;
  focusDateISO: string;
}) {
  const focusDate = useMemo(() => new Date(`${focusDateISO}T12:00:00`), [focusDateISO]);
  const summary = useMemo(() => computeSummary(store, focusDate), [store, focusDate]);
  const analysis = useMemo(() => analyzeStore(store, focusDate), [store, focusDate]);

  return (
    <div className="fety-mobile-insights">
      <p className="fety-mobile-insights-lede">Cash flow, spending mix, and affordability — tuned for quick review on the go.</p>
      <HomeInsightCharts analysis={analysis} summary={summary} store={store} focusDateISO={focusDateISO} layout="tiles" />
    </div>
  );
}
