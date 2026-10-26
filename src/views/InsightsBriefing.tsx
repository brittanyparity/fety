import { useCallback, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { resolveInsightTipSlots, type InsightTipSlot } from "../lib/insightTips";
import type { FinancialAnalysis, FetyActionTarget } from "../types/analysis";
import type { FetyStore } from "../types/fety";
import { formatUsd } from "../lib/scheduleAmounts";

const SLICE_COLORS = ["#111111", "#2E8F66", "#B8A6FF", "#D14A34", "#B07000", "#6B6B6B"];

export const INSIGHT_WIDGET_PINS = {
  pictureChart: "income-allocation",
  pictureBars: "budget-remaining",
  spendingMix: "spending-breakdown",
} as const;

type InsightTab = "picture" | "mix" | "try";

const INSIGHT_TABS: { id: InsightTab; label: string }[] = [
  { id: "picture", label: "Your picture" },
  { id: "mix", label: "Your spending mix" },
  { id: "try", label: "Things to try" },
];

type Slice = { name: string; amount: number; fill: string };

export function incomeAllocationSlices(analysis: FinancialAnalysis): Slice[] {
  const income = Math.max(0, analysis.expectedMonthlyIncome);
  if (income <= 0) return [];
  const obligations = Math.min(Math.max(0, analysis.regularObligations), income);
  const afterObl = income - obligations;
  const flexible = Math.min(Math.max(0, analysis.flexibleSpending), afterObl);
  const remaining = Math.max(0, afterObl - flexible);
  const parts: { name: string; amount: number }[] = [
    { name: "Regular expenses", amount: obligations },
    { name: "Everyday budgets", amount: flexible },
    { name: "Unallocated", amount: remaining },
  ];
  return parts
    .filter((p) => p.amount > 0.005)
    .map((p, i) => ({ ...p, fill: SLICE_COLORS[i % SLICE_COLORS.length] }));
}

export function categoryDonutData(analysis: FinancialAnalysis) {
  return analysis.categoryShares.slice(0, 6).map((d, i) => ({
    name: d.name,
    value: d.value,
    amount: d.monthly,
    fill: SLICE_COLORS[i % SLICE_COLORS.length],
  }));
}

function PinChartButton({
  widgetId,
  label,
  pinned,
  onPin,
}: {
  widgetId: string;
  label: string;
  pinned: boolean;
  onPin: (widgetId: string) => void;
}) {
  return (
    <button
      type="button"
      className="fety-insights-pin"
      aria-pressed={pinned}
      onClick={() => onPin(widgetId)}
    >
      {pinned ? "Pinned to dashboard" : `Pin ${label} to dashboard`}
    </button>
  );
}

export function IncomeAllocationChart({
  analysis,
  size = 200,
}: {
  analysis: FinancialAnalysis;
  size?: number;
}) {
  const data = incomeAllocationSlices(analysis);
  if (data.length === 0) {
    return (
      <div className="fety-insights-chart-empty">
        <p>Add income or regular expenses in setup to see how money is allocated.</p>
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={size}>
      <PieChart>
        <Pie data={data} dataKey="amount" nameKey="name" innerRadius={size * 0.32} outerRadius={size * 0.42} paddingAngle={2}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v: unknown) => formatUsd(Number(v))}
          contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid var(--border)" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function IncomeAllocationBars({ analysis }: { analysis: FinancialAnalysis }) {
  const data = incomeAllocationSlices(analysis);
  if (data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 8, top: 4, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" width={108} tick={{ fontSize: 11, fill: "var(--ink-2)" }} axisLine={false} tickLine={false} />
        <Tooltip formatter={(v: unknown) => formatUsd(Number(v))} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
        <Bar dataKey="amount" radius={[0, 6, 6, 0]}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CategoryMixChart({ analysis, size = 200 }: { analysis: FinancialAnalysis; size?: number }) {
  const data = categoryDonutData(analysis);
  if (data.length === 0) {
    return (
      <div className="fety-insights-chart-empty">
        <p>Everyday spending categories will show up here once you add budgets or transactions.</p>
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={size}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={size * 0.32} outerRadius={size * 0.42} paddingAngle={2}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v: unknown, _n, item) => {
            const row = item?.payload as { amount?: number; name?: string } | undefined;
            return [`${Number(v)}% · ${formatUsd(row?.amount ?? 0)}`, row?.name ?? ""];
          }}
          contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid var(--border)" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

const COLLAPSE_KEY = "fety-insights-panel-collapsed";
const TAB_KEY = "fety-insights-tab";

function readPanelCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function readActiveTab(): InsightTab {
  if (typeof window === "undefined") return "picture";
  try {
    const raw = localStorage.getItem(TAB_KEY);
    if (raw === "mix" || raw === "try" || raw === "picture") return raw;
  } catch {
    /* ignore */
  }
  return "picture";
}

export default function InsightsBriefing({
  store,
  analysis,
  onAction,
  pinnedWidgets,
  onPinWidget,
  onMarkTipDone,
  onArchiveTip,
}: {
  store: FetyStore;
  analysis: FinancialAnalysis;
  onAction: (action: FetyActionTarget) => void;
  pinnedWidgets: string[];
  onPinWidget: (widgetId: string) => void;
  onMarkTipDone: (tipId: string) => void;
  onArchiveTip: (tipId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(readPanelCollapsed);
  const [activeTab, setActiveTab] = useState<InsightTab>(readActiveTab);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const selectTab = useCallback((tab: InsightTab) => {
    setActiveTab(tab);
    setCollapsed(false);
    try {
      localStorage.setItem(TAB_KEY, tab);
      localStorage.setItem(COLLAPSE_KEY, "0");
    } catch {
      /* ignore */
    }
  }, []);

  const empty = analysis.missing.income && analysis.missing.obligations && analysis.missing.flexible;
  const tipSlots = useMemo(
    () => resolveInsightTipSlots(store, analysis),
    [store, analysis, store.insightTipProgress],
  );
  const mixLegend = categoryDonutData(analysis);
  const isPinned = (id: string) => pinnedWidgets.includes(id);

  const pictureLede = empty
    ? "Add a little income or a regular expense and this snapshot will fill in."
    : `You have about ${formatUsd(analysis.expectedMonthlyIncome)} coming in each month, with approximately ${formatUsd(analysis.regularObligations)} going toward regular expenses. That leaves about ${formatUsd(Math.max(0, analysis.expectedMonthlyIncome - analysis.regularObligations))} for flexible spending, saving, and other priorities.`;

  const barsLede = empty
    ? "Once income and bills are on file, you'll see how each dollar is spoken for."
    : `About ${formatUsd(analysis.flexibleSpending)} is budgeted for everyday categories, with ${formatUsd(Math.max(0, analysis.estimatedAvailable))} estimated available after regulars and those budgets.`;

  const tabPanelId = `fety-insights-panel-${activeTab}`;

  return (
    <div className="fety-insights-briefing">
      <section className="fety-insights-section" aria-label="Financial insights">
        <div className="fety-insights-header">
          <button
            type="button"
            className="fety-insights-collapse"
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand insights" : "Collapse insights"}
            onClick={toggleCollapsed}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              className={collapsed ? "fety-insights-chevron" : "fety-insights-chevron fety-insights-chevron-open"}
              aria-hidden
            >
              <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div
            className="fety-insights-tabs"
            role="tablist"
            aria-label="Insight sections"
            data-collapsed={collapsed ? "true" : undefined}
          >
            {INSIGHT_TABS.map((tab) => {
              const selected = !collapsed && activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`fety-insights-tab-${tab.id}`}
                  aria-selected={selected}
                  aria-controls={collapsed ? undefined : tabPanelId}
                  className={`fety-insights-tab${selected ? " fety-insights-tab-active" : ""}`}
                  onClick={() => selectTab(tab.id)}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {!collapsed ? (
          <div
            className="fety-insights-section-body"
            role="tabpanel"
            id={tabPanelId}
            aria-labelledby={`fety-insights-tab-${activeTab}`}
          >
            {activeTab === "picture" ? (
              <PictureTabContent
                analysis={analysis}
                pictureLede={pictureLede}
                barsLede={barsLede}
                isPinned={isPinned}
                onPinWidget={onPinWidget}
              />
            ) : null}
            {activeTab === "mix" ? (
              <MixTabContent
                analysis={analysis}
                mixLegend={mixLegend}
                isPinned={isPinned}
                onPinWidget={onPinWidget}
              />
            ) : null}
            {activeTab === "try" ? (
              <TryTabContent
                slots={tipSlots}
                onAction={onAction}
                onMarkDone={onMarkTipDone}
                onArchive={onArchiveTip}
              />
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function PictureTabContent({
  analysis,
  pictureLede,
  barsLede,
  isPinned,
  onPinWidget,
}: {
  analysis: FinancialAnalysis;
  pictureLede: string;
  barsLede: string;
  isPinned: (id: string) => boolean;
  onPinWidget: (id: string) => void;
}) {
  return (
    <>
      <div className="fety-insights-row">
        <div className="fety-insights-copy">
          <h2>Here&apos;s what I found.</h2>
          <p>{pictureLede}</p>
          <dl className="fety-analysis-stats">
            <div>
              <dt>Income</dt>
              <dd>{formatUsd(analysis.expectedMonthlyIncome)}</dd>
            </div>
            <div>
              <dt>Regular expenses</dt>
              <dd>{formatUsd(analysis.regularObligations)}</dd>
            </div>
            <div>
              <dt>Flexible spending</dt>
              <dd>{formatUsd(analysis.flexibleSpending)}</dd>
            </div>
            <div>
              <dt>Available after regulars</dt>
              <dd>{formatUsd(analysis.expectedMonthlyIncome - analysis.regularObligations)}</dd>
            </div>
          </dl>
        </div>
        <div className="fety-insights-visual">
          <IncomeAllocationChart analysis={analysis} />
          <PinChartButton
            widgetId={INSIGHT_WIDGET_PINS.pictureChart}
            label="this chart"
            pinned={isPinned(INSIGHT_WIDGET_PINS.pictureChart)}
            onPin={onPinWidget}
          />
        </div>
      </div>
      <div className="fety-insights-row fety-insights-row-secondary">
        <div className="fety-insights-copy">
          <h3>How income is allocated</h3>
          <p>{barsLede}</p>
        </div>
        <div className="fety-insights-visual">
          <IncomeAllocationBars analysis={analysis} />
          <PinChartButton
            widgetId={INSIGHT_WIDGET_PINS.pictureBars}
            label="budget health"
            pinned={isPinned(INSIGHT_WIDGET_PINS.pictureBars)}
            onPin={onPinWidget}
          />
        </div>
      </div>
    </>
  );
}

function MixTabContent({
  analysis,
  mixLegend,
  isPinned,
  onPinWidget,
}: {
  analysis: FinancialAnalysis;
  mixLegend: ReturnType<typeof categoryDonutData>;
  isPinned: (id: string) => boolean;
  onPinWidget: (id: string) => void;
}) {
  return (
    <div className="fety-insights-row">
      <div className="fety-insights-copy">
        <h2>Where everyday money is aimed</h2>
        <p>
          {mixLegend.length === 0
            ? "Category budgets from setup and spending you log will shape this mix."
            : "These are your largest everyday categories by monthly budget — the same view you can keep on the dashboard as a widget."}
        </p>
        <ul className="fety-analysis-legend">
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
      </div>
      <div className="fety-insights-visual">
        <CategoryMixChart analysis={analysis} />
        <PinChartButton
          widgetId={INSIGHT_WIDGET_PINS.spendingMix}
          label="spending breakdown"
          pinned={isPinned(INSIGHT_WIDGET_PINS.spendingMix)}
          onPin={onPinWidget}
        />
      </div>
    </div>
  );
}

function TryTabContent({
  slots,
  onAction,
  onMarkDone,
  onArchive,
}: {
  slots: InsightTipSlot[];
  onAction: (action: FetyActionTarget) => void;
  onMarkDone: (tipId: string) => void;
  onArchive: (tipId: string) => void;
}) {
  return (
    <div className="fety-insights-try-grid">
      {slots.map(({ tip, done }) => (
        <TryCard
          key={tip.id}
          tip={tip}
          done={done}
          onAction={onAction}
          onMarkDone={() => onMarkDone(tip.id)}
          onArchive={() => onArchive(tip.id)}
        />
      ))}
    </div>
  );
}

function TryCard({
  tip,
  done,
  onAction,
  onMarkDone,
  onArchive,
}: {
  tip: InsightTipSlot["tip"];
  done: boolean;
  onAction: (a: FetyActionTarget) => void;
  onMarkDone: () => void;
  onArchive: () => void;
}) {
  return (
    <article className={`fety-insights-try-card${done ? " fety-insights-try-card--done" : ""}`}>
      {done ? <p className="fety-insights-try-badge">Done</p> : null}
      <h3>{tip.title}</h3>
      <p>{tip.explanation}</p>
      <div className="fety-insights-try-actions">
        {tip.actionLabel && tip.action ? (
          <button type="button" className="fety-analysis-link" onClick={() => onAction(tip.action!)}>
            {tip.actionLabel}
          </button>
        ) : null}
        {!done ? (
          <button type="button" className="fety-insights-try-secondary" onClick={onMarkDone}>
            Mark done
          </button>
        ) : null}
        <button type="button" className="fety-insights-try-secondary" onClick={onArchive}>
          Archive
        </button>
      </div>
    </article>
  );
}
