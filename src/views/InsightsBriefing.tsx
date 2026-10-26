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
import type { PieLabelRenderProps, TooltipProps } from "recharts";
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

const PIE_START_ANGLE = 90;
const PIE_END_ANGLE = -270;
const PIE_LABEL_RADIAN = Math.PI / 180;

const INCOME_SLICE_LABEL_SHORT: Record<string, string> = {
  Expenses: "Expenses",
  Goals: "Goals",
  Available: "Available",
};

const GOALS_SLICE_FILL = "#7B63E8";
const EXPENSES_SLICE_FILL = "#D14A34";
const AVAILABLE_SLICE_FILL = "#2E8F66";

function incomeSliceLabelColor(fill: string | undefined): string {
  const f = (fill ?? "").toLowerCase();
  if (
    f === "#111111" ||
    f === "#2e8f66" ||
    f === "#d14a34" ||
    f === "#b07000" ||
    f === "#7b63e8"
  )
    return "#ffffff";
  return "#111111";
}

function renderIncomeSliceLabel(props: PieLabelRenderProps) {
  const {
    cx = 0,
    cy = 0,
    midAngle = 0,
    innerRadius = 0,
    outerRadius = 0,
    percent = 0,
    name = "",
    fill,
  } = props;
  if (percent < 0.04) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + r * Math.cos(-midAngle * PIE_LABEL_RADIAN);
  const y = cy + r * Math.sin(-midAngle * PIE_LABEL_RADIAN);
  const pct = Math.round(percent * 100);
  const label = INCOME_SLICE_LABEL_SHORT[name] ?? name;
  const color = incomeSliceLabelColor(typeof fill === "string" ? fill : undefined);
  const subColor = color === "#ffffff" ? "rgba(255,255,255,0.92)" : "rgba(17,17,17,0.72)";

  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      className="fety-income-pie-label"
      pointerEvents="none"
    >
      <tspan x={x} dy="-0.35em" fill={color} fontSize={9} fontWeight={600}>
        {label}
      </tspan>
      <tspan x={x} dy="1.15em" fill={subColor} fontSize={9} fontWeight={600}>
        {pct}%
      </tspan>
    </text>
  );
}

function IncomeAllocationTooltip({
  active,
  payload,
  totalIncome,
}: TooltipProps<number, string> & { totalIncome: number }) {
  if (!active || !payload?.length) return null;
  const inner = payload.find((p) => p.name && p.name !== "Total income");
  if (!inner) return null;
  const amount = Number(inner.value ?? 0);
  const name = String(inner.name ?? "");
  const pct = totalIncome > 0 ? Math.round((amount / totalIncome) * 100) : 0;
  return (
    <div
      className="fety-income-allocation-tooltip"
      style={{
        fontSize: 11,
        borderRadius: 8,
        border: "1px solid var(--border)",
        background: "var(--surface)",
        padding: "8px 10px",
        boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
      }}
    >
      <p style={{ margin: 0, fontWeight: 600, color: "var(--ink)" }}>{name}</p>
      <p style={{ margin: "4px 0 0", color: "var(--ink-2)" }}>{formatUsd(amount)}</p>
      <p style={{ margin: "4px 0 0", color: "var(--ink-3)", lineHeight: 1.35 }}>
        {pct}% of total income ({formatUsd(totalIncome)} expected monthly).
      </p>
    </div>
  );
}

export function incomeAllocationSlices(analysis: FinancialAnalysis): Slice[] {
  const income = Math.max(0, analysis.expectedMonthlyIncome);
  if (income <= 0) return [];
  const goals = Math.min(Math.max(0, analysis.goalsMonthlyContributions), income);
  const expenses = Math.min(Math.max(0, analysis.regularObligations), Math.max(0, income - goals));
  const available = Math.max(0, income - expenses - goals);
  const parts: { name: string; amount: number; fill: string }[] = [
    { name: "Expenses", amount: expenses, fill: EXPENSES_SLICE_FILL },
    { name: "Goals", amount: goals, fill: GOALS_SLICE_FILL },
    { name: "Available", amount: available, fill: AVAILABLE_SLICE_FILL },
  ];
  return parts.filter((p) => p.amount > 0.005);
}

export type CategoryMixSlice = {
  name: string;
  amount: number;
  pct: number;
  fill: string;
};

export function categoryMixPieData(analysis: FinancialAnalysis): CategoryMixSlice[] {
  const categoryRows = analysis.budgetCategoryShares.map((d, i) => ({
    name: d.name,
    amount: d.monthly,
    fill: SLICE_COLORS[i % SLICE_COLORS.length],
  }));
  const goalsMonthly = Math.max(0, analysis.goalsMonthlyContributions);
  const grandTotal =
    categoryRows.reduce((s, r) => s + r.amount, 0) + goalsMonthly;
  const slices: CategoryMixSlice[] = categoryRows.map((r) => ({
    ...r,
    pct: grandTotal > 0 ? Math.round((r.amount / grandTotal) * 100) : 0,
  }));
  if (goalsMonthly > 0.005) {
    slices.push({
      name: "Goals",
      amount: goalsMonthly,
      pct: grandTotal > 0 ? Math.round((goalsMonthly / grandTotal) * 100) : 0,
      fill: GOALS_SLICE_FILL,
    });
  }
  return slices;
}

/** @deprecated Use categoryMixPieData */
export function categoryDonutData(analysis: FinancialAnalysis) {
  return categoryMixPieData(analysis);
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
  const income = Math.max(0, analysis.expectedMonthlyIncome);
  const data = incomeAllocationSlices(analysis);
  if (income <= 0 || data.length === 0) {
    return (
      <div className="fety-insights-chart-empty">
        <p>Add income or regular expenses in setup to see how money is allocated.</p>
      </div>
    );
  }

  const outerRing = [{ name: "Total income", amount: income, fill: "var(--fety-income-ring-fill, #3a3a3a)" }];
  const innerOuter = size * 0.34;
  const outerInner = size * 0.36;
  const outerOuter = size * 0.46;
  const innerPaddingAngle = 1;

  return (
    <div className="fety-income-allocation-chart">
      <ResponsiveContainer width="100%" height={size}>
        <PieChart>
          <Pie
            data={outerRing}
            dataKey="amount"
            nameKey="name"
            innerRadius={outerInner}
            outerRadius={outerOuter}
            startAngle={PIE_START_ANGLE}
            endAngle={PIE_END_ANGLE}
            stroke="none"
            isAnimationActive={false}
          >
            <Cell fill={outerRing[0].fill} stroke="none" />
          </Pie>
          <Pie
            data={data}
            dataKey="amount"
            nameKey="name"
            innerRadius={0}
            outerRadius={innerOuter}
            startAngle={PIE_START_ANGLE}
            endAngle={PIE_END_ANGLE}
            paddingAngle={innerPaddingAngle}
            stroke="var(--surface, #fff)"
            strokeWidth={2}
            label={renderIncomeSliceLabel}
            labelLine={false}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip
            content={(props) => (
              <IncomeAllocationTooltip {...props} totalIncome={income} />
            )}
          />
        </PieChart>
      </ResponsiveContainer>
      <p className="fety-income-allocation-chart-caption">Total income · {formatUsd(income)}</p>
    </div>
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
  const legend = categoryMixPieData(analysis);
  const data = legend.filter((d) => d.amount > 0.005);
  if (legend.length === 0 || data.length === 0) {
    return (
      <div className="fety-insights-chart-empty">
        <p>Add budget categories with monthly amounts to see how your plan is divided.</p>
      </div>
    );
  }
  const budgetTotal = data.reduce((s, d) => s + d.amount, 0);
  return (
    <div className="fety-category-mix-chart">
      <ResponsiveContainer width="100%" height={size}>
        <PieChart>
          <Pie
            data={data}
            dataKey="amount"
            nameKey="name"
            innerRadius={0}
            outerRadius={size * 0.42}
            paddingAngle={1}
            stroke="var(--surface, #fff)"
            strokeWidth={2}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v: unknown, _n, item) => {
              const row = item?.payload as CategoryMixSlice | undefined;
              const amt = Number(v);
              const pct = budgetTotal > 0 ? Math.round((amt / budgetTotal) * 100) : 0;
              return [`${pct}% · ${formatUsd(amt)}`, row?.name ?? ""];
            }}
            contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid var(--border)" }}
          />
        </PieChart>
      </ResponsiveContainer>
      <p className="fety-category-mix-chart-caption">Monthly budget · {formatUsd(budgetTotal)}</p>
    </div>
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
  const mixLegend = categoryMixPieData(analysis);
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
          <dl className="fety-analysis-stats fety-analysis-stats--picture-grid">
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
              <dd>{formatUsd(analysis.goalsMonthlyContributions)}</dd>
            </div>
            <div>
              <dt>Available</dt>
              <dd>
                {formatUsd(
                  Math.max(
                    0,
                    analysis.expectedMonthlyIncome -
                      analysis.regularObligations -
                      analysis.goalsMonthlyContributions,
                  ),
                )}
              </dd>
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
  mixLegend: CategoryMixSlice[];
  isPinned: (id: string) => boolean;
  onPinWidget: (id: string) => void;
}) {
  return (
    <div className="fety-insights-row">
      <div className="fety-insights-copy">
        <h2>Where everyday money is aimed</h2>
        <p>
          {mixLegend.length === 0
            ? "Category budgets from setup will shape this mix."
            : "Every budget category you set up — each slice is that category's share of your total monthly budget."}
        </p>
        <ul className="fety-analysis-legend fety-analysis-legend--two-col">
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
