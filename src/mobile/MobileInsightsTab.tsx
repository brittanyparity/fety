import { useMemo } from "react";
import { computeSummary } from "../lib/fetyCalculations";
import { analyzeStore } from "../lib/financialAnalysis";
import type { FetyStore } from "../types/fety";
import { HomeAtAGlance } from "../views/HomeView";
import HomeInsightCharts from "../views/HomeInsightCharts";

export default function MobileInsightsTab({
  store,
  rangeStartISO,
  rangeEndISO,
}: {
  store: FetyStore;
  rangeStartISO: string;
  rangeEndISO: string;
}) {
  const focusDateISO = rangeEndISO >= rangeStartISO ? rangeEndISO : rangeStartISO;
  const focusDate = useMemo(() => new Date(`${focusDateISO}T12:00:00`), [focusDateISO]);
  const summary = useMemo(() => computeSummary(store, focusDate), [store, focusDate]);
  const glanceSummary = summary;
  const analysis = useMemo(() => analyzeStore(store, focusDate), [store, focusDate]);

  return (
    <div className="fety-mobile-insights">
      <section className="fety-mobile-insight-tile fety-mobile-insight-tile--glance" aria-labelledby="fety-mobile-glance-title">
        <h2 id="fety-mobile-glance-title" className="fety-mobile-insight-tile-title">
          At a glance
        </h2>
        <HomeAtAGlance
          store={store}
          summary={glanceSummary}
          rangeStartISO={rangeStartISO}
          rangeEndISO={rangeEndISO}
        />
      </section>
      <HomeInsightCharts
        analysis={analysis}
        summary={summary}
        store={store}
        focusDateISO={focusDateISO}
        rangeStartISO={rangeStartISO}
        rangeEndISO={rangeEndISO}
        layout="tiles"
      />
    </div>
  );
}
