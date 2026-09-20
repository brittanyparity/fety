import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { FetyLogo } from "./FetyLogo";
import { useFetyData } from "./hooks/useFetyData";
import { buildCalendarMap, endingBalanceOnDate, formatNavDate, last6MonthsSpending, last7DayEndingBalances, categorySpendShares, todayISO } from "./lib/fetyCalculations";
import { getTransactionTypes } from "./lib/transactionTypes";
import { calendarDailyBalanceBg, calendarDailyBalanceBgStrong, calendarEndingBalanceBg, calendarEndingBalanceBgStrong, calBalanceColor, calSignedColor } from "./lib/calendarUi";
import { CalendarPeriodMenu } from "./components/CalendarPeriodMenu";
import EmojiIconPicker from "./components/EmojiIconPicker";
import CurrencyInput, { amountToEditString } from "./components/CurrencyInput";
import { flattenRowsAfterMoveRespectingLocks, isWidgetInFirstRow, isWidgetPositionLocked, packWidgetsIntoRows, pruneWidgetLocksToFirstRow, reorderWidgetRespectingLocks, toggleWidgetOnDashboard, unpinWidget } from "./lib/widgetLayout";
import { ChatPanel, ChatExpandIcon } from "./components/ChatPanel";
import { confirmAssistantAction, handleAssistantMessageWithDeps } from "./assistant/router";
import type { ToolAction } from "./assistant/types";
import type { BudgetCategory, CalDay, CalendarMap, ChatMessage, FetyStore, FetyTransactionType, FinanceSummary, Transaction, TransactionType } from "./types/fety";
import {
  BudgetManageView,
  TransactionsManageView,
  GoalsManageView,
  SettingsManageView,
} from "./views/ManageViews";
import { OnboardingView } from "./views/OnboardingView";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { nextBillOccurrenceOnOrAfter } from "./lib/billScheduling";
import WidgetPinIcon from "./components/WidgetPinIcon";

// ─── Types ─────────────────────────────────────────────────────────────────────
type Page = "dashboard" | "budget" | "spending" | "goals" | "settings" | "calendar";
type ViewMode = "cards" | "list";
type CalView = "monthly" | "weekly" | "biweekly" | "daily" | "yearly";

function WidgetDashboardToggleIcon({ onDashboard }: { onDashboard: boolean }) {
  const stroke = "var(--ink)";
  if (onDashboard) {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
        <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="4.75" stroke={stroke} strokeWidth="1.75" />
    </svg>
  );
}

const CAL_KEY = (d: Date) => d.toISOString().slice(0, 10);

const compactUsd = (n: number) => {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 10000) return `${sign}$${(abs / 1000).toFixed(0)}k`;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return (
    sign +
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(abs)
  );
};

// ─── Static demo chart data (dashboard widgets) ───────────────────────────────
const cashFlow = [
  { d: "Mon", bal: 1820 }, { d: "Tue", bal: 2170 }, { d: "Wed", bal: 1950 },
  { d: "Thu", bal: 3960 }, { d: "Fri", bal: 3410 }, { d: "Sat", bal: 2680 }, { d: "Sun", bal: 2612 },
];
const monthlySpend = [
  { m: "Apr", v: 3200 }, { m: "May", v: 3800 }, { m: "Jun", v: 3100 },
  { m: "Jul", v: 4200 }, { m: "Aug", v: 3650 }, { m: "Sep", v: 1972 },
];
const donutData = [
  { name: "Housing", value: 44 }, { name: "Food",     value: 14 },
  { name: "Bills",   value: 20 }, { name: "Shopping", value:  9 }, { name: "Other", value: 13 },
];
const DONUT_COLORS = ["#111111", "#6B6B6B", "#B8A6FF", "#E4FF3F", "#EDEDED"];

const budgetCategories = [
  { name: "Housing",        icon: "🏠", budget: 2000, spent: 2000, color: "var(--ink)" },
  { name: "Groceries",      icon: "🛒", budget:  500, spent:  320, color: "var(--ink)" },
  { name: "Dining Out",     icon: "🍽️", budget:  200, spent:  148, color: "var(--ink)" },
  { name: "Transportation", icon: "🚗", budget:  250, spent:  180, color: "var(--ink)" },
  { name: "Shopping",       icon: "🛍️", budget:  400, spent:  425, color: "var(--trouble-dk)" },
  { name: "Entertainment",  icon: "🎬", budget:  150, spent:   98, color: "var(--ink)" },
  { name: "Bills",          icon: "⚡", budget:  900, spent:  890, color: "var(--ink)" },
  { name: "Personal",       icon: "💆", budget:  200, spent:   62, color: "var(--ink)" },
];

const INIT_TRANSACTIONS = [
  { date: "Today",     desc: "Whole Foods Market",  category: "Groceries",      amount:  -52.40, type: "expense"  as const, icon: "🛒" },
  { date: "Today",     desc: "Freelance Invoice",   category: "Income",         amount:  350.00, type: "income"   as const, icon: "💼" },
  { date: "Yesterday", desc: "Electric Bill",       category: "Bills",          amount: -142.00, type: "expense"  as const, icon: "⚡" },
  { date: "Yesterday", desc: "Amazon",              category: "Shopping",       amount:  -89.99, type: "expense"  as const, icon: "📦" },
  { date: "Sep 1",     desc: "Employer Paycheck",   category: "Income",         amount: 2800.00, type: "income"   as const, icon: "💵" },
  { date: "Sep 1",     desc: "Gas Station",         category: "Transportation", amount:  -48.00, type: "expense"  as const, icon: "⛽" },
  { date: "Aug 30",    desc: "Trader Joe's",        category: "Groceries",      amount:  -87.32, type: "expense"  as const, icon: "🛒" },
  { date: "Aug 30",    desc: "Savings Transfer",    category: "Savings",        amount: -200.00, type: "transfer" as const, icon: "🏦" },
];

const goals = [
  { name: "Emergency Fund", icon: "🛡️", target:  5000, saved: 3250, color: "var(--later)", date: "Dec 2026", monthly: 250 },
  { name: "Vacation",       icon: "✈️", target:  2500, saved: 1200, color: "var(--later)", date: "Jun 2026", monthly: 200 },
  { name: "Debt Payoff",    icon: "💳", target: 10000, saved: 6750, color: "var(--later)", date: "Mar 2027", monthly: 400 },
  { name: "New Car",        icon: "🚗", target: 20000, saved: 4000, color: "var(--later)", date: "Jan 2028", monthly: 500 },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────
const usd  = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const usdF = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const NAV_ITEMS: { id: Page; label: string }[] = [
  { id: "dashboard", label: "Dashboard"    },
  { id: "calendar",  label: "Calendar"     },
  { id: "spending",  label: "Transactions" },
  { id: "budget",    label: "Budget"       },
  { id: "goals",     label: "Goals"        },
];

type LiveWidgetBundle = { store: FetyStore; summary: FinanceSummary };
let liveWidgets: LiveWidgetBundle | null = null;
function widgetLive(): LiveWidgetBundle {
  if (!liveWidgets) {
    throw new Error("Dashboard widgets not initialized");
  }
  return liveWidgets;
}

function TopNav({
  page,
  setPage,
  navDate,
  profileInitial,
  onOpenSettings,
}: {
  page: Page;
  setPage: (p: Page) => void;
  navDate: string;
  profileInitial: string;
  onOpenSettings: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const go = (p: Page) => {
    setPage(p);
    setMenuOpen(false);
  };

  return (
    <header className="fety-nav">
      <FetyLogo />
      <div className="fety-nav-links">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => go(item.id)}
            className={`fety-nav-link${page === item.id ? " fety-nav-link-active" : ""}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="fety-nav-actions">
        <span className="fety-nav-date">{navDate}</span>
        <button
          type="button"
          title="Settings"
          aria-label="Open settings"
          onClick={onOpenSettings}
          className="fety-nav-profile"
        >
          {profileInitial}
        </button>
      </div>
      <button
        type="button"
        className="fety-nav-hamburger"
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((o) => !o)}
      >
        {menuOpen ? (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
            <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
            <path d="M2.5 5h13M2.5 9h13M2.5 13h13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        )}
      </button>
      {menuOpen && (
        <>
          <button type="button" className="fety-nav-backdrop" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
          <nav className="fety-nav-drawer" aria-label="Main">
            <p className="fety-nav-drawer-date">{navDate}</p>
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => go(item.id)}
                className={`fety-nav-drawer-link${page === item.id ? " fety-nav-drawer-link-active" : ""}`}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              className="fety-nav-drawer-link"
              onClick={() => {
                onOpenSettings();
                setMenuOpen(false);
              }}
            >
              Settings
            </button>
          </nav>
        </>
      )}
    </header>
  );
}

// ─── Widget System ─────────────────────────────────────────────────────────────
interface WidgetDef {
  id: string;
  label: string;
  color: string;
  size: "small" | "half" | "full";
  render: () => React.ReactNode;
  preview: () => React.ReactNode;
}

// Helper: small stat card preview (used in picker panel)
const statPreview = (dot: string, label: string, value: string, sub?: string): React.ReactNode => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--bg)", borderRadius: 10, border: "1px solid var(--border)" }}>
    <div style={{ width: 9, height: 9, borderRadius: "var(--radius-marker)", background: dot, flexShrink: 0 }} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ fontSize: 10, fontWeight: 400, color: "var(--ink-3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 400, color: "var(--ink)", letterSpacing: "-0.5px", fontFamily: "var(--font-sans)", lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 9, color: "var(--ink-3)", marginTop: 2 }}>{sub}</p>}
    </div>
  </div>
);

const ALL_WIDGETS: WidgetDef[] = [
  {
    id: "spending-power-hero",
    label: "Spending power · this week",
    color: "var(--amber)",
    size: "full",
    preview: () => statPreview("var(--amber-dk)", "Spending power", "$140", "Full-width banner"),
    render: () => {
      const { summary: s } = widgetLive();
      const barPct = s.weeklyUsedPct;
      return (
        <div
          style={{
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
              {usd(s.weeklySpendingPower)}
            </p>
            <p style={{ fontSize: 14, color: "var(--ink-2)", marginTop: 8 }}>Safe to spend through Sunday</p>
          </div>
          <div style={{ minWidth: 200, flex: "1 1 200px", maxWidth: 320 }}>
            <div style={{ height: 8, background: "rgba(17,17,17,0.2)", borderRadius: "var(--radius-track)", overflow: "hidden" }}>
              <div style={{ width: `${barPct}%`, height: "100%", background: "var(--ink)", borderRadius: "var(--radius-track)" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--ink)" }}>
              <span>{usd(s.weeklySpent)} of {usd(s.weeklyBudget)}</span>
              <span>{barPct}%</span>
            </div>
          </div>
        </div>
      );
    },
  },
  // ── Small stat cards ──────────────────────────────────────────────────────────
  {
    id: "stat-balance", label: "Balance", color: "var(--surface)", size: "small",
    preview: () => statPreview("var(--clear)", "Balance", "$2,612", "All accounts"),
    render: () => {
      const { summary: s } = widgetLive();
      return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, height: "100%" }}>
        <div style={{ width: 9, height: 9, borderRadius: "var(--radius-marker)", background: "var(--clear)", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 400, color: "var(--ink-3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: 4 }}>Balance</p>
          <p style={{ fontSize: 22, fontWeight: 400, color: "var(--ink)", letterSpacing: "-0.8px", fontFamily: "var(--font-sans)", lineHeight: 1 }}>{usd(s.balance)}</p>
        </div>
      </div>
      );
    },
  },
  {
    id: "stat-money-in", label: "In today", color: "var(--surface)", size: "small",
    preview: () => statPreview("var(--clear)", "In today", "+$350", "Income today"),
    render: () => {
      const { summary: s } = widgetLive();
      return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, height: "100%" }}>
        <div style={{ width: 9, height: 9, borderRadius: "var(--radius-marker)", background: "var(--clear)", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 400, color: "var(--ink-3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: 4 }}>In today</p>
          <p style={{ fontSize: 22, fontWeight: 400, color: "var(--lime-dk)", letterSpacing: "-0.8px", fontFamily: "var(--font-sans)", lineHeight: 1 }}>+{usd(s.moneyInToday)}</p>
        </div>
      </div>
      );
    },
  },
  {
    id: "stat-money-out", label: "Out today", color: "var(--surface)", size: "small",
    preview: () => statPreview("var(--trouble)", "Out today", "-$52", "Expenses today"),
    render: () => {
      const { summary: s } = widgetLive();
      return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, height: "100%" }}>
        <div style={{ width: 9, height: 9, borderRadius: "var(--radius-marker)", background: "var(--trouble)", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 400, color: "var(--ink-3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: 4 }}>Out today</p>
          <p style={{ fontSize: 22, fontWeight: 400, color: "var(--peach-dk)", letterSpacing: "-0.8px", fontFamily: "var(--font-sans)", lineHeight: 1 }}>-{usd(s.moneyOutToday)}</p>
        </div>
      </div>
      );
    },
  },
  {
    id: "stat-savings", label: "Savings", color: "var(--surface)", size: "small",
    preview: () => statPreview("var(--later)", "Savings", "$5,200", "Goals saved total"),
    render: () => {
      const { summary: s } = widgetLive();
      return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, height: "100%" }}>
        <div style={{ width: 9, height: 9, borderRadius: "var(--radius-marker)", background: "var(--later)", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 400, color: "var(--ink-3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: 4 }}>Savings</p>
          <p style={{ fontSize: 22, fontWeight: 400, color: "var(--later-dk)", letterSpacing: "-0.8px", fontFamily: "var(--font-sans)", lineHeight: 1 }}>{usd(s.savingsTotal)}</p>
        </div>
      </div>
      );
    },
  },
  {
    id: "stat-monthly-net", label: "Monthly Net", color: "var(--surface)", size: "small",
    preview: () => statPreview("var(--clear)", "Monthly Net", "+$2,450", "September"),
    render: () => (
      <div style={{ display: "flex", alignItems: "center", gap: 8, height: "100%" }}>
        <div style={{ width: 9, height: 9, borderRadius: "var(--radius-marker)", background: "var(--clear)", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 400, color: "var(--ink-3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: 4 }}>Monthly Net</p>
          <p style={{ fontSize: 22, fontWeight: 400, color: "var(--lime-dk)", letterSpacing: "-0.8px", fontFamily: "var(--font-sans)", lineHeight: 1 }}>+$2,450</p>
        </div>
      </div>
    ),
  },
  {
    id: "stat-weekly-spend", label: "Weekly Spend", color: "var(--surface)", size: "small",
    preview: () => statPreview("var(--ink)", "Weekly Spend", "$634", "This week"),
    render: () => (
      <div style={{ display: "flex", alignItems: "center", gap: 8, height: "100%" }}>
        <div style={{ width: 9, height: 9, borderRadius: "var(--radius-marker)", background: "var(--ink)", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 400, color: "var(--ink-3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: 4 }}>Weekly Spend</p>
          <p style={{ fontSize: 22, fontWeight: 400, color: "var(--ink)", letterSpacing: "-0.8px", fontFamily: "var(--font-sans)", lineHeight: 1 }}>$634</p>
        </div>
      </div>
    ),
  },
  {
    id: "stat-remaining", label: "Budget Remaining", color: "var(--surface)", size: "small",
    preview: () => statPreview("var(--ink-3)", "Budget Remaining", "$2,028", "This month"),
    render: () => (
      <div style={{ display: "flex", alignItems: "center", gap: 8, height: "100%" }}>
        <div style={{ width: 9, height: 9, borderRadius: "var(--radius-marker)", background: "var(--ink-3)", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 400, color: "var(--ink-3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: 4 }}>Budget Remaining</p>
          <p style={{ fontSize: 22, fontWeight: 400, color: "var(--ink)", letterSpacing: "-0.8px", fontFamily: "var(--font-sans)", lineHeight: 1 }}>$2,028</p>
        </div>
      </div>
    ),
  },

  // ── Half-width detailed widgets ────────────────────────────────────────────────
  {
    id: "weekly-power", label: "Weekly spending power", color: "var(--amber)", size: "half",
    preview: () => statPreview("var(--amber-dk)", "Spending power", "$140", "22% of $640 budget"),
    render: () => {
      const { summary: s } = widgetLive();
      return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <p className="fety-label" style={{ marginBottom: 8 }}>Spending power · this week</p>
        <p className="fety-figure" style={{ fontSize: 48 }}>{usd(s.weeklySpendingPower)}</p>
        <p style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 8 }}>Available after bills you have on file</p>
        <div style={{ marginTop: 16, height: 6, background: "rgba(17,17,17,0.12)", borderRadius: "var(--radius-track)" }}>
          <div style={{ width: `${s.weeklyUsedPct}%`, height: "100%", background: "var(--amber-dk)", borderRadius: "var(--radius-track)" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          <span style={{ fontSize: 10, fontFamily: "var(--font-sans)", color: "var(--ink-3)" }}>{usd(s.weeklySpendingPower)} of {usd(s.weeklyBudget)} weekly budget</span>
          <span style={{ fontSize: 10, fontFamily: "var(--font-sans)", color: "var(--ink-2)" }}>{s.weeklyUsedPct}%</span>
        </div>
      </div>
      );
    },
  },
  {
    id: "daily-limit", label: "Daily spending limit", color: "var(--surface)", size: "half",
    preview: () => statPreview("var(--chart-dk)", "Daily Spending Limit", "$20", "Stay on budget today"),
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.5)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.16em" }}>Daily Limit</p>
        <p style={{ fontSize: 42, fontWeight: 400, color: "var(--ink)", letterSpacing: "-2px", lineHeight: 1 }}>$20</p>
        <p style={{ fontSize: 12, color: "rgba(0,0,0,0.5)", marginTop: 6 }}>Remaining today to stay on track</p>
        <div style={{ marginTop: 16, display: "flex", gap: 4 }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} style={{ flex: 1, height: 28, borderRadius: 6, background: i < 5 ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.07)", display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 4 }}>
              <span style={{ fontSize: 8, color: "rgba(0,0,0,0.4)", fontWeight: 600 }}>{["M","T","W","T","F","S","S"][i]}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 10, color: "rgba(0,0,0,0.4)", marginTop: 6 }}>5 days spent · 2 days left</p>
      </div>
    ),
  },
  {
    id: "balance-chart", label: "Balance This Week", color: "var(--surface)", size: "full",
    preview: () => statPreview("var(--clear-dk)", "Balance This Week", "$2,612", "Daily ending balance · area chart"),
    render: () => {
      const { store, summary: s } = widgetLive();
      const weekData = last7DayEndingBalances(store);
      const endBal = weekData[weekData.length - 1]?.bal ?? s.balance;
      return (
      <div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>Balance This Week</p>
            <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>Daily ending balance</p>
          </div>
          <p style={{ fontSize: 22, fontWeight: 400, color: "var(--ink)", letterSpacing: "-0.8px", fontFamily: "var(--font-sans)" }}>{usd(endBal)}</p>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={weekData}>
            <defs><linearGradient id="wg1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--clear)" stopOpacity={0.45}/><stop offset="95%" stopColor="var(--clear)" stopOpacity={0}/></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false}/>
            <XAxis dataKey="d" tick={{ fontSize: 10, fill: "var(--ink-3)", fontFamily: "var(--font-sans)" }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fontSize: 10, fill: "var(--ink-3)", fontFamily: "var(--font-sans)" }} axisLine={false} tickLine={false} tickFormatter={v => `$${Number(v)/1000}k`} width={36}/>
            <Tooltip formatter={(v: unknown) => [usdF(Number(v)), "Balance"]} contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid var(--border)", fontFamily: "var(--font-sans)" }}/>
            <Area type="monotone" dataKey="bal" stroke="var(--clear-dk)" strokeWidth={2.5} fill="url(#wg1)" dot={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
      );
    },
  },
  {
    id: "monthly-spend-chart", label: "Monthly Spending Trend", color: "var(--surface)", size: "half",
    preview: () => statPreview("var(--ink)", "Monthly Spending Trend", "$3,650", "Bar chart · last 6 months"),
    render: () => {
      const { store } = widgetLive();
      const monthlySpendLive = last6MonthsSpending(store);
      return (
      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 2 }}>Monthly Spending</p>
        <p style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 16 }}>Last 6 months</p>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={monthlySpendLive} barSize={20}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false}/>
            <XAxis dataKey="m" tick={{ fontSize: 10, fill: "var(--ink-3)", fontFamily: "var(--font-sans)" }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fontSize: 10, fill: "var(--ink-3)", fontFamily: "var(--font-sans)" }} axisLine={false} tickLine={false} tickFormatter={v => `$${Number(v)/1000}k`} width={36}/>
            <Tooltip formatter={(v: unknown) => [usd(Number(v)), "Spent"]} contentStyle={{ fontSize: 11, borderRadius: 9, border: "1px solid var(--border)", fontFamily: "var(--font-sans)" }}/>
            <Bar dataKey="v" fill="var(--ink)" radius={[4,4,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>
      );
    },
  },
  {
    id: "spending-breakdown", label: "Spending Breakdown", color: "var(--surface)", size: "half",
    preview: () => statPreview("var(--ink-3)", "Spending Breakdown", "5 categories", "Donut chart · where money goes"),
    render: () => {
      const { store } = widgetLive();
      const donutLive = categorySpendShares(store);
      return (
      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 16 }}>Where Your Money Is Going</p>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <ResponsiveContainer width={110} height={110}>
            <PieChart><Pie data={donutLive.length ? donutLive : [{ name: "None", value: 100 }]} dataKey="value" innerRadius={32} outerRadius={52} paddingAngle={2} startAngle={90} endAngle={-270}>{(donutLive.length ? donutLive : [{ name: "None", value: 100 }]).map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]}/>)}</Pie></PieChart>
          </ResponsiveContainer>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
            {(donutLive.length ? donutLive : [{ name: "No spend yet", value: 0 }]).map((d, i) => (
              <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ width: 7, height: 7, borderRadius: 2, background: DONUT_COLORS[i % DONUT_COLORS.length], flexShrink: 0 }}/>
                <span style={{ fontSize: 11, color: "var(--ink-2)", flex: 1 }}>{d.name}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink)", fontFamily: "var(--font-sans)" }}>{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      );
    },
  },
  {
    id: "today-balance", label: "Today's Balance (Card)", color: "var(--sky)", size: "half",
    preview: () => statPreview("var(--sky-dk)", "Today's Balance", "$2,612", "Checking $1,812 · Savings $800"),
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.5)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.16em" }}>Today's Balance</p>
        <p style={{ fontSize: 42, fontWeight: 400, color: "var(--ink)", letterSpacing: "-2px", lineHeight: 1 }}>$2,612</p>
        <p style={{ fontSize: 12, color: "rgba(0,0,0,0.5)", marginTop: 6 }}>All accounts combined</p>
        <div style={{ marginTop: "auto", paddingTop: 16, display: "flex", gap: 10 }}>
          <div style={{ flex: 1, background: "rgba(255,255,255,0.5)", borderRadius: 10, padding: "10px 12px" }}>
            <p style={{ fontSize: 10, color: "rgba(0,0,0,0.5)", marginBottom: 3 }}>Checking</p>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", fontFamily: "var(--font-sans)" }}>$1,812</p>
          </div>
          <div style={{ flex: 1, background: "rgba(255,255,255,0.5)", borderRadius: 10, padding: "10px 12px" }}>
            <p style={{ fontSize: 10, color: "rgba(0,0,0,0.5)", marginBottom: 3 }}>Savings</p>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", fontFamily: "var(--font-sans)" }}>$800</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "money-in", label: "Money In Today (Card)", color: "var(--clear)", size: "half",
    preview: () => statPreview("var(--mint-dk)", "Money In Today", "+$350", "Freelance Invoice"),
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.5)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.16em" }}>Money In Today</p>
        <p style={{ fontSize: 42, fontWeight: 400, color: "var(--mint-dk)", letterSpacing: "-2px", lineHeight: 1 }}>+$350</p>
        <p style={{ fontSize: 12, color: "rgba(0,0,0,0.5)", marginTop: 6 }}>Income received today</p>
        <div style={{ marginTop: "auto", paddingTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: "1px solid rgba(0,0,0,0.08)" }}>
            <span style={{ fontSize: 16 }}>💼</span>
            <div style={{ flex: 1 }}><p style={{ fontSize: 12, fontWeight: 500, color: "var(--ink)" }}>Freelance Invoice</p><p style={{ fontSize: 10, color: "rgba(0,0,0,0.4)" }}>Today · Income</p></div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--mint-dk)", fontFamily: "var(--font-sans)" }}>+$350</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "money-out", label: "Money Out Today (Card)", color: "var(--surface)", size: "half",
    preview: () => statPreview("var(--peach-dk)", "Money Out Today", "-$52", "Whole Foods Market"),
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.5)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.16em" }}>Money Out Today</p>
        <p style={{ fontSize: 42, fontWeight: 400, color: "var(--peach-dk)", letterSpacing: "-2px", lineHeight: 1 }}>-$52</p>
        <p style={{ fontSize: 12, color: "rgba(0,0,0,0.5)", marginTop: 6 }}>Expenses paid today</p>
        <div style={{ marginTop: "auto", paddingTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: "1px solid rgba(0,0,0,0.08)" }}>
            <span style={{ fontSize: 16 }}>🛒</span>
            <div style={{ flex: 1 }}><p style={{ fontSize: 12, fontWeight: 500, color: "var(--ink)" }}>Whole Foods Market</p><p style={{ fontSize: 10, color: "rgba(0,0,0,0.4)" }}>Today · Groceries</p></div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--peach-dk)", fontFamily: "var(--font-sans)" }}>-$52</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "monthly-net", label: "Monthly Net Cash Flow", color: "var(--clear)", size: "half",
    preview: () => statPreview("var(--lime-dk)", "Monthly Net Cash Flow", "+$2,450", "In $3,150 · Out $700"),
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.5)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.16em" }}>Monthly Net Cash Flow</p>
        <p style={{ fontSize: 42, fontWeight: 400, color: "var(--lime-dk)", letterSpacing: "-2px", lineHeight: 1 }}>+$2,450</p>
        <p style={{ fontSize: 12, color: "rgba(0,0,0,0.5)", marginTop: 6 }}>September net so far</p>
        <div style={{ marginTop: "auto", paddingTop: 16, display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 10, color: "rgba(0,0,0,0.45)", marginBottom: 3 }}>Income</p>
            <p style={{ fontSize: 16, fontWeight: 400, color: "var(--lime-dk)", fontFamily: "var(--font-sans)" }}>+$3,150</p>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 10, color: "rgba(0,0,0,0.45)", marginBottom: 3 }}>Expenses</p>
            <p style={{ fontSize: 16, fontWeight: 400, color: "var(--peach-dk)", fontFamily: "var(--font-sans)" }}>-$700</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "budget-remaining", label: "Budget Health", color: "var(--surface)", size: "half",
    preview: () => statPreview("var(--ink)", "Budget Health", "$477 left", "Progress bars · top 4 categories"),
    render: () => {
      const { summary: s } = widgetLive();
      const cats = s.categoriesWithSpent.slice().sort((a, b) => b.spent / Math.max(b.monthlyBudget, 1) - a.spent / Math.max(a.monthlyBudget, 1)).slice(0, 4);
      const totalBudget = s.categoriesWithSpent.reduce((acc, c) => acc + c.monthlyBudget, 0);
      const totalSpent = s.categoriesWithSpent.reduce((acc, c) => acc + c.spent, 0);
      const left = Math.max(0, totalBudget - totalSpent);
      return (
      <div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>Budget Health</p>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--lime-dk)", background: "var(--lime)", borderRadius: 99, padding: "2px 9px" }}>{usd(left)} left</span>
        </div>
        {cats.map(c => {
          const pct = Math.min(100, Math.round((c.spent / Math.max(c.monthlyBudget, 1)) * 100));
          return (
            <div key={c.id} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: "var(--ink-2)" }}>{c.icon} {c.name}</span>
                <span style={{ fontSize: 10, fontFamily: "var(--font-sans)", color: pct >= 100 ? "var(--peach-dk)" : "var(--ink-3)" }}>{usd(c.spent)} / {usd(c.monthlyBudget)}</span>
              </div>
              <div style={{ height: 5, background: "var(--bg)", borderRadius: 99 }}>
                <div style={{ width: `${pct}%`, height: "100%", background: pct >= 100 ? "var(--trouble-dk)" : pct >= 80 ? "var(--amber-dk)" : "var(--ink)", borderRadius: "var(--radius-track)" }} />
              </div>
            </div>
          );
        })}
      </div>
      );
    },
  },
  {
    id: "next-paycheck", label: "Next Paycheck", color: "var(--later)", size: "half",
    preview: () => statPreview("var(--lav-dk)", "Next Paycheck", "Sept 15", "$2,800 · 2 days away"),
    render: () => {
      const { store } = widgetLive();
      const nextIncome = store.transactions
        .filter((t) => t.type === "income" && t.dateISO >= todayISO())
        .sort((a, b) => a.dateISO.localeCompare(b.dateISO))[0];
      const payDate = nextIncome ? new Date(`${nextIncome.dateISO}T12:00:00`) : null;
      const payLabel = payDate ? payDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";
      const payAmt = nextIncome ? Math.abs(nextIncome.amount) : 0;
      const balanceAfterPay = nextIncome
        ? endingBalanceOnDate(store, nextIncome.dateISO)
        : endingBalanceOnDate(store, todayISO());
      return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.5)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.16em" }}>Next Paycheck</p>
        <p style={{ fontSize: 36, fontWeight: 400, color: "var(--ink)", letterSpacing: "-1.5px", lineHeight: 1 }}>{payLabel}</p>
        <p style={{ fontSize: 28, fontWeight: 400, color: "var(--lav-dk)", letterSpacing: "-1px", lineHeight: 1, marginTop: 4 }}>{nextIncome ? usd(payAmt) : "—"}</p>
        <p style={{ fontSize: 12, color: "rgba(0,0,0,0.5)", marginTop: 8 }}>{nextIncome ? nextIncome.desc : "No upcoming income on file"}</p>
        <div style={{ background: "rgba(255,255,255,0.4)", borderRadius: 10, padding: "10px 12px", marginTop: 16 }}>
          <p style={{ fontSize: 10, color: "rgba(0,0,0,0.5)", marginBottom: 2 }}>Balance after next income</p>
          <p style={{ fontSize: 18, fontWeight: 400, color: "var(--lav-dk)", fontFamily: "var(--font-sans)" }}>{usd(balanceAfterPay)}</p>
        </div>
      </div>
      );
    },
  },
  {
    id: "savings-goal", label: "Savings Goals", color: "var(--surface)", size: "full",
    preview: () => statPreview("var(--mint-dk)", "Savings Goals", "4 goals", "Emergency 65% · Vacation 48%"),
    render: () => {
      const { store } = widgetLive();
      const goalRows = store.goals;
      return (
      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 16 }}>Savings Goals</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          {goalRows.map(g => {
            const pct = g.target > 0 ? Math.round((g.saved / g.target) * 100) : 0;
            return (
              <div key={g.id} style={{ background: "var(--bg)", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 18 }}>{g.icon}</span>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>{g.name}</p>
                    <p style={{ fontSize: 10, color: "var(--ink-3)" }}>Target: {g.targetDate}</p>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 400, color: "var(--ink)", fontFamily: "var(--font-sans)" }}>{usd(g.saved)}</span>
                  <span style={{ fontSize: 10, color: "var(--ink-3)", alignSelf: "flex-end" }}>of {usd(g.target)}</span>
                </div>
                <div style={{ height: 5, background: "var(--border)", borderRadius: 99 }}>
                  <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: "var(--later)", borderRadius: 99 }} />
                </div>
                <p style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 4 }}>{pct}% complete</p>
              </div>
            );
          })}
        </div>
      </div>
      );
    },
  },
  {
    id: "biggest-bill", label: "Largest Upcoming Bill", color: "var(--peach)", size: "half",
    preview: () => statPreview("var(--peach-dk)", "Largest Upcoming Bill", "$2,000", "Rent · due Oct 1"),
    render: () => {
      const { store } = widgetLive();
      const now = new Date();
      const upcoming = store.bills
        .map((b) => {
          const next = nextBillOccurrenceOnOrAfter(b, now);
          return { ...b, due: next ? new Date(`${next}T12:00:00`) : null };
        })
        .filter((b): b is typeof b & { due: Date } => b.due != null)
        .sort((a, b) => a.due.getTime() - b.due.getTime());
      const top = upcoming[0];
      const list = upcoming.slice(0, 3);
      return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.5)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.16em" }}>Largest Upcoming Bill</p>
        <p style={{ fontSize: 42, fontWeight: 400, color: "var(--ink)", letterSpacing: "-2px", lineHeight: 1 }}>{top ? usd(top.amount) : "—"}</p>
        <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(0,0,0,0.6)", marginTop: 6 }}>{top?.name ?? "No bills"}</p>
        <p style={{ fontSize: 12, color: "rgba(0,0,0,0.45)", marginTop: 2 }}>{top ? `Due ${top.due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "Add bills in Budget"}</p>
        <div style={{ marginTop: "auto", paddingTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
          {list.map(b => (
            <div key={b.id} style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 6 }}>
              <span style={{ fontSize: 11, color: "rgba(0,0,0,0.6)" }}>{b.name}</span>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink)", fontFamily: "var(--font-sans)" }}>{usd(b.amount)}</span>
                <span style={{ fontSize: 10, color: "rgba(0,0,0,0.4)", marginLeft: 6 }}>{b.due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      );
    },
  },
];

// ─── Widget Picker Panel (push sidebar) ─────────────────────────────────────────
const SIZE_GROUPS: { label: string; sizes: WidgetDef["size"][] }[] = [
  { label: "Stat Cards", sizes: ["small"] },
  { label: "Detail Cards", sizes: ["half"] },
  { label: "Full-Width", sizes: ["full"] },
];

function WidgetPicker({
  pinned, onDashboardToggle, onClose,
}: {
  pinned: string[]; onDashboardToggle: (id: string) => void; onClose: () => void;
}) {
  return (
    <div style={{
      width: 300, flexShrink: 0, borderLeft: "1px solid var(--border)",
      background: "var(--surface)", display: "flex", flexDirection: "column",
      height: "100%", overflow: "hidden",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Customize Dashboard</p>
          <p style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}>{pinned.length} widget{pinned.length !== 1 ? "s" : ""} active</p>
        </div>
        <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 2l7 7M9 2l-7 7" stroke="var(--ink-3)" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
        {SIZE_GROUPS.map(group => {
          const groupWidgets = ALL_WIDGETS.filter(w => group.sizes.includes(w.size));
          return (
            <div key={group.label} style={{ marginBottom: 18 }}>
              <p style={{ fontSize: 10, fontWeight: 400, color: "var(--ink-3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{group.label}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {groupWidgets.map(w => {
                  const active = pinned.includes(w.id);
                  return (
                    <div key={w.id} style={{ borderRadius: 12, border: `1.5px solid ${active ? "var(--ink)" : "var(--border)"}`, overflow: "hidden", background: active ? "var(--bg)" : "var(--surface)", transition: "all 0.13s" }}>
                      {/* Preview thumbnail */}
                      <div style={{ padding: "10px 12px", borderBottom: `1px solid ${active ? "rgba(0,0,0,0.08)" : "var(--border)"}` }}>
                        {w.preview()}
                      </div>
                      {/* Action row */}
                      <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", gap: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--ink)" }}>{w.label}</p>
                          <p style={{ fontSize: 9, color: "var(--ink-3)", marginTop: 1 }}>{w.size === "full" ? "Full width" : w.size === "half" ? "Half width" : "Stat card"}</p>
                        </div>
                        <button
                          type="button"
                          title={active ? "Remove from dashboard" : "Add to dashboard"}
                          onClick={() => onDashboardToggle(w.id)}
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 8,
                            border: "1px solid var(--ink)",
                            background: "var(--surface)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <WidgetDashboardToggleIcon onDashboard={active} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ─── Right Icon Panel ──────────────────────────────────────────────────────────
function RightPanel({
  viewMode, setViewMode, chatCollapsed, setChatCollapsed, onCalendar,
}: {
  viewMode: ViewMode; setViewMode: (v: ViewMode) => void;
  chatCollapsed: boolean; setChatCollapsed: (v: boolean) => void;
  onCalendar: () => void;
}) {
  const [activeFilter, setActiveFilter] = useState(false);
  const [chartType,    setChartType   ] = useState<"area" | "bar">("area");

  const ic = (active: boolean) => active ? "#fff" : "var(--ink-3)";

  const Btn = ({ title, active, onClick, children }: { title: string; active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button title={title} onClick={onClick} style={{ width: 36, height: 36, borderRadius: 10, border: "none", cursor: "pointer", background: active ? "var(--ink)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.14s" }}>
      {children}
    </button>
  );

  return (
    <div style={{ width: 52, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", padding: "14px 0", gap: 4, background: "var(--surface)", borderLeft: "1px solid var(--border)" }}>

      {/* View mode */}
      <Btn title={viewMode === "cards" ? "Switch to list" : "Switch to cards"} active={viewMode === "list"} onClick={() => setViewMode(viewMode === "cards" ? "list" : "cards")}>
        {viewMode === "cards"
          ? <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1" y="1" width="5.5" height="5.5" rx="1.5" stroke={ic(false)} strokeWidth="1.4"/><rect x="8.5" y="1" width="5.5" height="5.5" rx="1.5" stroke={ic(false)} strokeWidth="1.4"/><rect x="1" y="8.5" width="5.5" height="5.5" rx="1.5" stroke={ic(false)} strokeWidth="1.4"/><rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.5" stroke={ic(false)} strokeWidth="1.4"/></svg>
          : <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 4h11M2 7.5h11M2 11h11" stroke={ic(viewMode === "list")} strokeWidth="1.4" strokeLinecap="round"/></svg>
        }
      </Btn>

      {/* Chart type */}
      <Btn title="Toggle chart style" active={chartType === "bar"} onClick={() => setChartType(chartType === "area" ? "bar" : "area")}>
        {(() => {
          const isBar = chartType === "bar";
          const c = ic(isBar);
          return isBar
            ? <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1" y="6" width="3" height="7" rx="1" fill={c}/><rect x="6" y="3" width="3" height="10" rx="1" fill={c}/><rect x="11" y="8" width="3" height="5" rx="1" fill={c}/></svg>
            : <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M1 11l3.5-4 3 2L11 4l3 2" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>;
        })()}
      </Btn>

      {/* Filter */}
      <Btn title="Filter data" active={activeFilter} onClick={() => setActiveFilter(!activeFilter)}>
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
          <path d="M1.5 3.5h12M4 7.5h7M6.5 11.5h2" stroke={ic(activeFilter)} strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </Btn>

      {/* Calendar — opens calendar page */}
      <Btn title="Financial calendar" active={false} onClick={onCalendar}>
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
          <rect x="1.5" y="2.5" width="12" height="11" rx="2" stroke={ic(false)} strokeWidth="1.4"/>
          <path d="M1.5 6h12M5 1.5v2M10 1.5v2" stroke={ic(false)} strokeWidth="1.4" strokeLinecap="round"/>
          <circle cx="5" cy="9.5" r="0.8" fill={ic(false)}/>
          <circle cx="7.5" cy="9.5" r="0.8" fill={ic(false)}/>
          <circle cx="10" cy="9.5" r="0.8" fill={ic(false)}/>
        </svg>
      </Btn>

      <div style={{ flex: 1 }} />

      {/* Refresh */}
      <Btn title="Refresh data" active={false} onClick={() => {}}>
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
          <path d="M13 7.5A5.5 5.5 0 012.5 10" stroke={ic(false)} strokeWidth="1.4" strokeLinecap="round"/>
          <path d="M2 7.5A5.5 5.5 0 0112.5 5" stroke={ic(false)} strokeWidth="1.4" strokeLinecap="round"/>
          <path d="M10.5 5h2.5V2.5" stroke={ic(false)} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M4.5 10H2v2.5" stroke={ic(false)} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </Btn>

    </div>
  );
}

// ─── Calendar View ─────────────────────────────────────────────────────────────
function CalendarView({
  store,
  transactionTypes,
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
}: {
  store: FetyStore;
  transactionTypes: FetyTransactionType[];
  onAddTransaction: ReturnType<typeof useFetyData>["addTransaction"];
  onUpdateTransaction: ReturnType<typeof useFetyData>["updateTransaction"];
  onDeleteTransaction: ReturnType<typeof useFetyData>["deleteTransaction"];
}) {
  const [calView, setCalView] = useState<CalView>("monthly");
  const [focusDate, setFocusDate] = useState(() => new Date());
  const [selected, setSelected] = useState<string | null>(() => CAL_KEY(new Date()));
  const [scrollToKey, setScrollToKey] = useState<string | null>(null);
  const dayCellRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const registerDayRef = useCallback((key: string, el: HTMLButtonElement | null) => {
    if (el) dayCellRefs.current.set(key, el);
    else dayCellRefs.current.delete(key);
  }, []);

  const fmt = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  const year = focusDate.getFullYear();
  const calendarMap = useMemo(() => buildCalendarMap(store, year), [store, year]);

  useEffect(() => {
    if (!scrollToKey || calView !== "yearly") return;
    const timer = window.setTimeout(() => {
      dayCellRefs.current.get(scrollToKey)?.scrollIntoView({ block: "center", behavior: "smooth" });
      setScrollToKey(null);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [scrollToKey, calView, calendarMap]);

  const jumpToDateISO = useCallback(
    (iso: string) => {
      const d = new Date(`${iso}T12:00:00`);
      if (!Number.isNaN(d.getTime())) {
        if (d.getFullYear() !== year) setFocusDate(d);
        setSelected(iso);
        if (calView === "yearly") setScrollToKey(iso);
      }
    },
    [calView, year],
  );

  const addMonth = (n: number) => setFocusDate((p) => { const d = new Date(p); d.setMonth(d.getMonth() + n); return d; });
  const addWeek = (n: number) => setFocusDate((p) => { const d = new Date(p); d.setDate(d.getDate() + n * 7); return d; });
  const addDay = (n: number) => setFocusDate((p) => { const d = new Date(p); d.setDate(d.getDate() + n); return d; });
  const addYear = (n: number) => setFocusDate((p) => { const d = new Date(p); d.setFullYear(d.getFullYear() + n); return d; });

  const selectedDay = selected ? calendarMap.get(selected) ?? null : null;
  const panelISO = calView === "daily" ? CAL_KEY(focusDate) : selected;
  const panelDay = panelISO ? calendarMap.get(panelISO) ?? null : null;

  useEffect(() => {
    if (calView === "daily") setSelected(CAL_KEY(focusDate));
  }, [calView, focusDate]);

  const VIEWS: { id: CalView; label: string }[] = [
    { id: "monthly", label: "Monthly" },
    { id: "weekly", label: "Weekly" },
    { id: "biweekly", label: "Bi-Weekly" },
    { id: "daily", label: "Daily" },
    { id: "yearly", label: "Yearly" },
  ];

  const navBack = () => {
    if (calView === "daily") addDay(-1);
    else if (calView === "yearly") addYear(-1);
    else if (calView === "monthly" || calView === "biweekly") addMonth(-1);
    else addWeek(-1);
  };
  const navForward = () => {
    if (calView === "daily") addDay(1);
    else if (calView === "yearly") addYear(1);
    else if (calView === "monthly" || calView === "biweekly") addMonth(1);
    else addWeek(1);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, width: 0, height: "100%", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 24px", borderBottom: "1px solid var(--border)", background: "var(--surface)", flexShrink: 0, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.3px" }}>Financial Calendar</h2>
        <div style={{ flex: 1 }}/>
        <div style={{ display: "inline-flex", background: "var(--bg)", borderRadius: 99, padding: 3, border: "1px solid var(--border)", gap: 2, flexWrap: "wrap" }}>
          {VIEWS.map((v) => (
            <button key={v.id} onClick={() => setCalView(v.id)} style={{ padding: "5px 14px", borderRadius: 99, fontSize: 11.5, fontWeight: 500, border: "none", cursor: "pointer", transition: "all 0.15s", background: calView === v.id ? "var(--ink)" : "transparent", color: calView === v.id ? "#fff" : "var(--ink-2)" }}>
              {v.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button onClick={navBack} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M8 2.5L5 6.5L8 10.5" stroke="#5A5A55" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", minWidth: 140, textAlign: "center" }}>
            <CalendarPeriodMenu
              calView={calView}
              focusDate={focusDate}
              year={year}
              onFocusDate={(d) => {
                setFocusDate(d);
                if (calView === "daily" || calView === "monthly") setSelected(CAL_KEY(d));
              }}
            />
          </span>
          <button onClick={navForward} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M5 2.5L8 6.5L5 10.5" stroke="#5A5A55" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>

      <div className="fety-calendar-body" style={{ flex: 1, overflow: "hidden", display: "flex", minHeight: 0 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0 }}>
          {calView === "yearly" && <YearlyWeekdayBar />}
          <div
            className={calView === "yearly" ? "fety-yearly-scroll" : undefined}
            style={{ flex: 1, overflowY: "auto", padding: calView === "yearly" ? "8px 16px 0" : "16px 20px", minHeight: 0 }}
          >
            {calView === "monthly" && <MonthlyCalGrid month={focusDate} calendarMap={calendarMap} selected={selected} onSelect={setSelected} />}
            {calView === "weekly" && <WeeklyCalGrid anchor={focusDate} days={7} calendarMap={calendarMap} selected={selected} onSelect={setSelected} />}
            {calView === "biweekly" && <WeeklyCalGrid anchor={focusDate} days={14} calendarMap={calendarMap} selected={selected} onSelect={setSelected} />}
            {calView === "daily" && <DailyCalView date={focusDate} calendarMap={calendarMap} />}
            {calView === "yearly" && (
              <YearlyCalGrid
                year={year}
                calendarMap={calendarMap}
                selected={selected}
                onSelect={setSelected}
                registerDayRef={registerDayRef}
              />
            )}
          </div>
          {calView === "yearly" && <YearlyCalLegend />}
        </div>

        {(calView === "yearly" || calView === "daily" || (selected && selectedDay)) && (
          <CalendarSidePanel
            calView={calView}
            year={year}
            selectedISO={panelISO}
            day={panelDay}
            categories={store.categories}
            transactionTypes={transactionTypes}
            onJumpToDate={jumpToDateISO}
            onClose={() => setSelected(null)}
            onAddTransaction={onAddTransaction}
            onUpdateTransaction={onUpdateTransaction}
            onDeleteTransaction={onDeleteTransaction}
          />
        )}
      </div>
    </div>
  );
}

// ─── Yearly Calendar Grid ──────────────────────────────────────────────────────
function YearlyCalGrid({
  year,
  calendarMap,
  selected,
  onSelect,
  registerDayRef,
}: {
  year: number;
  calendarMap: CalendarMap;
  selected: string | null;
  onSelect: (k: string) => void;
  registerDayRef?: (key: string, el: HTMLButtonElement | null) => void;
}) {
  const cells: (Date | null)[] = [];
  const jan1 = new Date(year, 0, 1);
  for (let i = 0; i < jan1.getDay(); i++) cells.push(null);
  for (let month = 0; month < 12; month++) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {cells.map((date, i) => {
          if (!date) return <div key={`pad-${i}`} style={{ minHeight: 46, borderRadius: 8, background: "transparent" }} />;
          const key = CAL_KEY(date);
          const data = calendarMap.get(key);
          const net = data ? data.endBal - data.startBal : 0;
          const isSelected = selected === key;
          const isToday = date.toDateString() === today.toDateString();
          const isFirstOfMonth = date.getDate() === 1;
          const tileBg = data ? calendarEndingBalanceBg(data.endBal, isSelected) : calendarEndingBalanceBg(0, false);

          return (
            <button
              key={key}
              type="button"
              ref={(el) => registerDayRef?.(key, el)}
              onClick={() => onSelect(key)}
              title={data ? `${date.toLocaleDateString("en-US")} · ${compactUsd(data.startBal)} → ${compactUsd(data.endBal)}` : undefined}
              style={{
                borderRadius: 8,
                padding: "4px 5px",
                border: isSelected ? "2px solid var(--ink)" : isToday ? "1px solid var(--clear-dk)" : "1px solid var(--border)",
                background: tileBg,
                cursor: "pointer",
                textAlign: "left",
                minHeight: 46,
                display: "flex",
                flexDirection: "column",
                gap: 2,
                transition: "border-color 0.12s, box-shadow 0.12s",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, lineHeight: 1 }}>
                {isFirstOfMonth && (
                  <span style={{ fontSize: 7, fontWeight: 700, color: isSelected ? "rgba(255,255,255,0.55)" : "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {MONTHS[date.getMonth()].slice(0, 3)}
                  </span>
                )}
                <span style={{ fontSize: 10, fontWeight: 600, color: isSelected ? calSignedColor(net, true) : isToday ? "var(--clear-dk)" : "var(--ink)" }}>
                  {date.getDate()}
                </span>
              </div>
              {data && (
                <div style={{ display: "flex", flexDirection: "column", gap: 1, marginTop: "auto" }}>
                  <div style={{ fontSize: 7.5, lineHeight: 1.2, color: isSelected ? "rgba(255,255,255,0.55)" : "var(--ink-3)" }}>
                    S{" "}
                    <span style={{ fontFamily: "var(--font-sans)", fontWeight: 600, color: calSignedColor(data.startBal) }}>
                      {compactUsd(data.startBal)}
                    </span>
                  </div>
                  <div style={{ fontSize: 7.5, lineHeight: 1.2, color: isSelected ? "rgba(255,255,255,0.55)" : "var(--ink-3)" }}>
                    E{" "}
                    <span style={{ fontFamily: "var(--font-sans)", fontWeight: 700, color: calBalanceColor(data.endBal, isSelected) }}>
                      {compactUsd(data.endBal)}
                    </span>
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function YearlyWeekdayBar() {
  return (
    <div className="fety-yearly-dow-wrap">
      <div className="fety-yearly-dow">
        {DAYS_SHORT.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
    </div>
  );
}

function YearlyCalLegend() {
  return (
    <div className="fety-yearly-legend">
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: "var(--ink-2)" }}>Ending balance</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "var(--ink-3)" }}>
          <div style={{ width: 14, height: 14, borderRadius: 4, background: "rgba(145, 216, 182, 0.55)", border: "1px solid var(--border)" }} />
          Positive
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "var(--ink-3)" }}>
          <div style={{ width: 14, height: 14, borderRadius: 4, background: "rgba(255, 217, 107, 0.58)", border: "1px solid var(--border)" }} />
          Zero
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "var(--ink-3)" }}>
          <div style={{ width: 14, height: 14, borderRadius: 4, background: "rgba(255, 111, 94, 0.5)", border: "1px solid var(--border)" }} />
          Negative
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "var(--ink-3)" }}>
          <div style={{ width: 14, height: 14, borderRadius: 4, background: "var(--ink)", border: "1px solid var(--border)" }} />
          Selected
        </div>
      </div>
    </div>
  );
}

// ─── Monthly Calendar Grid ─────────────────────────────────────────────────────
function MonthlyCalGrid({ month, calendarMap, selected, onSelect }: { month: Date; calendarMap: CalendarMap; selected: string | null; onSelect: (k: string) => void }) {
  const y = month.getFullYear(), m = month.getMonth();
  const firstDay = new Date(y, m, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d));

  const today = new Date();

  return (
    <div>
      {/* Day headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 3 }}>
        {DAYS_SHORT.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.16em", padding: "4px 0" }}>{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
        {cells.map((date, i) => {
          if (!date) return <div key={i} />;
          const key  = CAL_KEY(date);
          const data = calendarMap.get(key);
          const isSelected = selected === key;
          const isToday    = date.toDateString() === today.toDateString();
          const hasItems   = (data?.items.length ?? 0) > 0;
          const net = data ? data.endBal - data.startBal : 0;
          const hasBill    = data?.items.some(i => i.type === "bill") ?? false;
          const hasPayday  = data?.items.some(i => i.type === "paycheck") ?? false;

          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              style={{
                borderRadius: 10, padding: "7px 6px",
                border: isSelected ? "2px solid var(--ink)" : "1px solid var(--border)",
                background: data ? calendarEndingBalanceBg(data.endBal, isSelected) : "var(--surface)",
                cursor: "pointer", textAlign: "left", minHeight: 82,
                display: "flex", flexDirection: "column", gap: 3,
                transition: "all 0.12s",
              }}
            >
              {/* Date number */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: isSelected ? calSignedColor(net, true) : isToday ? "var(--lime-dk)" : "var(--ink)", lineHeight: 1 }}>
                  {date.getDate()}
                </span>
                <div style={{ display: "flex", gap: 2 }}>
                  {hasPayday && <span style={{ fontSize: 9, background: isSelected ? "rgba(255,255,255,0.2)" : "#E8F5EE", color: isSelected ? "#fff" : "var(--clear-dk)", borderRadius: 4, padding: "1px 4px", fontWeight: 600 }}>💵</span>}
                  {hasBill   && <span style={{ fontSize: 9, background: isSelected ? "rgba(255,255,255,0.2)" : "#FFECE8", color: isSelected ? "#fff" : "var(--trouble-dk)", borderRadius: 4, padding: "1px 4px", fontWeight: 600 }}>📋</span>}
                </div>
              </div>

              {/* Balance mini sheet */}
              {data && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 1 }}>
                  <div style={{ fontSize: 9, color: isSelected ? "rgba(255,255,255,0.6)" : "var(--ink-3)" }}>
                    Start <span style={{ fontFamily: "var(--font-sans)", fontWeight: 600, color: calSignedColor(data.startBal, isSelected) }}>{usd(data.startBal)}</span>
                  </div>
                  <div style={{ fontSize: 9, color: isSelected ? "rgba(255,255,255,0.6)" : "var(--ink-3)" }}>
                    End <span style={{ fontFamily: "var(--font-sans)", fontWeight: 600, color: calBalanceColor(data.endBal, isSelected) }}>{usd(data.endBal)}</span>
                  </div>
                  {/* Mini dots for transactions */}
                  {hasItems && (
                    <div style={{ display: "flex", gap: 2, flexWrap: "wrap", marginTop: 2 }}>
                      {data.items.slice(0, 4).map((item, ii) => (
                        <div key={ii} title={`${item.desc}: ${item.amount >= 0 ? "+" : ""}${usd(item.amount)}`}
                          style={{ width: 6, height: 6, borderRadius: "var(--radius-marker)", background: item.amount >= 0 ? "var(--clear-dk)" : item.type === "bill" ? "var(--trouble-dk)" : "#D97706", opacity: isSelected ? 0.8 : 1 }} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 14, flexWrap: "wrap" }}>
        {[
          { color: "var(--clear-dk)", label: "Income" },
          { color: "#D97706", label: "Expense" },
          { color: "var(--trouble-dk)", label: "Bill" },
        ].map(l => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "var(--ink-3)" }}>
            <div style={{ width: 7, height: 7, borderRadius: "var(--radius-marker)", background: l.color }}/>
            {l.label}
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "var(--ink-3)" }}>
          <span>💵</span> Paycheck
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "var(--ink-3)" }}>
          <span>📋</span> Bill due
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "var(--ink-3)", marginLeft: 4 }}>
          <div style={{ width: 14, height: 14, borderRadius: 4, background: "rgba(145, 216, 182, 0.55)", border: "1px solid var(--border)" }} />
          Ending balance +
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "var(--ink-3)" }}>
          <div style={{ width: 14, height: 14, borderRadius: 4, background: "rgba(255, 217, 107, 0.58)", border: "1px solid var(--border)" }} />
          Zero
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "var(--ink-3)" }}>
          <div style={{ width: 14, height: 14, borderRadius: 4, background: "rgba(255, 111, 94, 0.5)", border: "1px solid var(--border)" }} />
          Ending balance −
        </div>
      </div>
    </div>
  );
}

// ─── Weekly / Bi-Weekly Grid ───────────────────────────────────────────────────
function WeeklyCalGrid({ anchor, days, calendarMap, selected, onSelect }: { anchor: Date; days: number; calendarMap: CalendarMap; selected: string | null; onSelect: (k: string) => void }) {
  // Start from Monday of anchor's week
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7));

  const cols: Date[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    cols.push(d);
  }

  const today = new Date();
  const isBiweekly = days === 14;

  // For bi-weekly, split into two rows of 7
  const rows: Date[][] = isBiweekly
    ? [cols.slice(0, 7), cols.slice(7, 14)]
    : [cols];

  const DayCell = (date: Date) => {
    const key  = CAL_KEY(date);
    const data = calendarMap.get(key);
    const isSelected  = selected === key;
    const isToday     = date.toDateString() === today.toDateString();
    const net = data ? data.endBal - data.startBal : 0;
    return (
      <button key={key} onClick={() => onSelect(key)} style={{ background: data ? calendarEndingBalanceBg(data.endBal, isSelected) : "var(--surface)", border: isSelected ? "2px solid var(--ink)" : "1px solid var(--border)", borderRadius: 12, padding: "12px 10px", cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: 8 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 600, color: isSelected ? "rgba(255,255,255,0.6)" : "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.16em" }}>{DAYS_SHORT[date.getDay()]}</p>
          <p style={{ fontSize: 18, fontWeight: 400, color: isSelected ? calSignedColor(net, true) : isToday ? "var(--lime-dk)" : "var(--ink)", letterSpacing: "-0.5px", lineHeight: 1.1 }}>{date.getDate()}</p>
        </div>
        {data ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 3, borderTop: `1px solid ${isSelected ? "rgba(255,255,255,0.15)" : "var(--border)"}`, paddingTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 9, color: isSelected ? "rgba(255,255,255,0.55)" : "var(--ink-3)" }}>Start</span>
              <span style={{ fontSize: 10, fontWeight: 600, fontFamily: "var(--font-sans)", color: calSignedColor(data.startBal, isSelected) }}>{usd(data.startBal)}</span>
            </div>
            {data.income > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 9, color: isSelected ? "rgba(255,255,255,0.55)" : "var(--ink-3)" }}>In</span>
                <span style={{ fontSize: 10, fontWeight: 600, fontFamily: "var(--font-sans)", color: calSignedColor(data.income, isSelected) }}>+{usd(data.income)}</span>
              </div>
            )}
            {data.expenses < 0 && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 9, color: isSelected ? "rgba(255,255,255,0.55)" : "var(--ink-3)" }}>Out</span>
                <span style={{ fontSize: 10, fontWeight: 600, fontFamily: "var(--font-sans)", color: calSignedColor(data.expenses, isSelected) }}>{usd(data.expenses)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${isSelected ? "rgba(255,255,255,0.12)" : "var(--border)"}`, paddingTop: 3 }}>
              <span style={{ fontSize: 9, fontWeight: 600, color: isSelected ? "rgba(255,255,255,0.7)" : "var(--ink-2)" }}>End</span>
              <span style={{ fontSize: 10, fontWeight: 400, fontFamily: "var(--font-sans)", color: calBalanceColor(data.endBal, isSelected) }}>{usd(data.endBal)}</span>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 9, color: isSelected ? "rgba(255,255,255,0.4)" : "var(--ink-3)", borderTop: `1px solid ${isSelected ? "rgba(255,255,255,0.1)" : "var(--border)"}`, paddingTop: 8 }}>No activity</div>
        )}
        {data && data.items.length > 0 && (
          <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            {data.items.map((item, ii) => (
              <span key={ii} title={`${item.desc} ${usd(item.amount)}`} style={{ fontSize: 12 }}>{item.icon}</span>
            ))}
          </div>
        )}
      </button>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {rows.map((row, ri) => (
        <div key={ri} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
          {row.map(date => DayCell(date))}
        </div>
      ))}
    </div>
  );
}

// ─── Daily Calendar View ───────────────────────────────────────────────────────
function DailyCalView({ date, calendarMap }: { date: Date; calendarMap: CalendarMap }) {
  const key = CAL_KEY(date);
  const data = calendarMap.get(key);

  const net = data ? data.endBal - data.startBal : 0;

  return (
    <div style={{ maxWidth: 680, width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[
          { label: "Starting Balance", value: data ? usd(data.startBal) : "—", bg: "var(--surface)", colorAmount: data?.startBal ?? 0 },
          { label: "Ending Balance", value: data ? usd(data.endBal) : "—", bg: data ? calendarEndingBalanceBgStrong(data.endBal) : "var(--surface)", colorAmount: data?.endBal ?? 0 },
          { label: "Net Cash Flow", value: data ? (net > 0 ? `+${usd(net)}` : usd(net)) : "—", bg: calendarDailyBalanceBgStrong(net), colorAmount: net },
        ].map(card => (
          <div key={card.label} style={{ background: card.bg, borderRadius: 16, padding: "18px 20px", border: "1px solid var(--border)" }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: "var(--ink-3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.16em" }}>{card.label}</p>
            <p style={{ fontSize: 24, fontWeight: 400, color: card.label.endsWith("Balance") ? calBalanceColor(card.colorAmount) : calSignedColor(card.colorAmount), letterSpacing: "-0.8px", fontFamily: "var(--font-sans)" }}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Income / Expenses sub-totals */}
      {data && (data.income > 0 || data.expenses < 0) && (
        <div style={{ display: "flex", gap: 10 }}>
          {data.income > 0 && (
            <div style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-2)" }}>Total In</span>
              <span style={{ fontFamily: "var(--font-sans)", fontWeight: 600, color: "var(--clear-dk)", fontSize: 16 }}>+{usd(data.income)}</span>
            </div>
          )}
          {data.expenses < 0 && (
            <div style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-2)" }}>Total Out</span>
              <span style={{ fontFamily: "var(--font-sans)", fontWeight: 600, color: "var(--trouble-dk)", fontSize: 16 }}>{usd(data.expenses)}</span>
            </div>
          )}
        </div>
      )}

      {/* Transaction list */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.16em" }}>
            {date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · Transactions
          </p>
        </div>
        {data && data.items.length > 0 ? data.items.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", padding: "13px 16px", borderTop: i > 0 ? "1px solid var(--border)" : undefined, gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: item.amount >= 0 ? "#E8F5EE" : item.type === "bill" ? "#FFECE8" : "#FFF8EC", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>{item.icon}</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{item.desc}</p>
              <p style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 1, textTransform: "capitalize" }}>{item.type}</p>
            </div>
            <span style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 13, color: item.amount >= 0 ? "var(--clear-dk)" : item.type === "bill" ? "var(--trouble-dk)" : "var(--trouble-dk)" }}>
              {item.amount >= 0 ? "+" : ""}{usdF(item.amount)}
            </span>
          </div>
        )) : (
          <div style={{ padding: "24px", textAlign: "center", color: "var(--ink-3)", fontSize: 12 }}>No transactions on this day.</div>
        )}
      </div>

      {/* Hour-by-hour balance bar */}
      {data && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px" }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 14 }}>Balance Timeline</p>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 60 }}>
            {(() => {
              const points = [data.startBal];
              let running = data.startBal;
              data.items.forEach(item => { running += item.amount; points.push(running); });
              const min = Math.min(...points) * 0.98;
              const max = Math.max(...points) * 1.02;
              return points.map((v, i) => {
                const h = Math.max(4, ((v - min) / (max - min)) * 56);
                const color = i === 0 ? "var(--ink-3)" : v > points[i - 1] ? "var(--clear)" : "var(--trouble)";
                return (
                  <div key={i} title={`${i === 0 ? "Start" : data.items[i-1].desc}: ${usd(v)}`}
                    style={{ flex: 1, height: h, background: color, borderRadius: 4, transition: "height 0.3s", cursor: "default" }} />
                );
              });
            })()}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 9, color: "var(--ink-3)" }}>
            <span>Start · <span style={{ color: calSignedColor(data.startBal) }}>{usd(data.startBal)}</span></span>
            <span>End · <span style={{ color: calBalanceColor(data.endBal) }}>{usd(data.endBal)}</span></span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Calendar side panel (day detail + yearly jump + transactions) ─────────────
function CalendarSidePanel({
  calView,
  year,
  selectedISO,
  day,
  categories,
  transactionTypes,
  onJumpToDate,
  onClose,
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
}: {
  calView: CalView;
  year: number;
  selectedISO: string | null;
  day: CalDay | null;
  categories: BudgetCategory[];
  transactionTypes: import("./types/fety").FetyTransactionType[];
  onJumpToDate: (iso: string) => void;
  onClose: () => void;
  onAddTransaction: (input: {
    desc: string;
    amount: number;
    type: TransactionType;
    category: string;
    dateISO?: string;
    icon?: string;
  }) => void;
  onUpdateTransaction: (
    id: string,
    updates: Partial<{ desc: string; amount: number; type: TransactionType; category: string; icon: string }>,
  ) => void;
  onDeleteTransaction: (id: string) => void;
}) {
  const defaultTypeId = transactionTypes.find((t) => t.id === "expense")?.id ?? transactionTypes[0]?.id ?? "expense";
  const iconForType = (typeId: string) => transactionTypes.find((t) => t.id === typeId)?.icon ?? "💬";
  const [jumpISO, setJumpISO] = useState(selectedISO ?? todayISO());
  const [showAdd, setShowAdd] = useState(false);
  const [addDesc, setAddDesc] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addType, setAddType] = useState<TransactionType>(defaultTypeId);
  const [addCategory, setAddCategory] = useState(categories[0]?.name ?? "Other");
  const [addIcon, setAddIcon] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editType, setEditType] = useState<TransactionType>(defaultTypeId);
  const [editCategory, setEditCategory] = useState("Other");
  const [editIcon, setEditIcon] = useState("");

  useEffect(() => {
    if (selectedISO) setJumpISO(selectedISO);
  }, [selectedISO]);

  const panelInput: React.CSSProperties = {
    width: "100%",
    padding: "7px 9px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    fontSize: 11,
    fontFamily: "inherit",
    background: "var(--surface)",
  };

  const submitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!day) return;
    const n = parseFloat(addAmount);
    if (!addDesc.trim() || !Number.isFinite(n)) return;
    onAddTransaction({
      desc: addDesc.trim(),
      amount: n,
      type: addType,
      category: addCategory,
      dateISO: CAL_KEY(day.date),
      icon: addIcon.trim() || undefined,
    });
    setAddDesc("");
    setAddAmount("");
    setAddIcon("");
    setShowAdd(false);
  };

  const startEdit = (item: CalDay["items"][0]) => {
    setEditId(item.id);
    setEditDesc(item.desc);
    setEditAmount(amountToEditString(item.amount));
    setEditType(item.txnType);
    setEditCategory(item.category);
    setEditIcon(item.icon);
  };

  const saveEdit = () => {
    if (!editId) return;
    const n = parseFloat(editAmount);
    if (!editDesc.trim() || !Number.isFinite(n)) return;
    onUpdateTransaction(editId, {
      desc: editDesc.trim(),
      amount: n,
      type: editType,
      category: editCategory,
      icon: editIcon.trim() || iconForType(editType),
    });
    setEditId(null);
  };

  return (
    <div style={{ width: 280, flexShrink: 0, borderLeft: "1px solid var(--border)", background: "var(--surface)", display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
      {calView === "yearly" && (
        <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", background: "var(--bg)" }}>
          <p className="fety-label" style={{ marginBottom: 8 }}>Jump to date</p>
          <input type="date" value={jumpISO} onChange={(e) => setJumpISO(e.target.value)} style={panelInput} />
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => onJumpToDate(todayISO())}
              style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => onJumpToDate(jumpISO)}
              style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "none", background: "var(--ink)", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
            >
              Go
            </button>
          </div>
          <p style={{ fontSize: 9, color: "var(--ink-3)", marginTop: 6 }}>Scrolls the {year} grid to the day you pick.</p>
        </div>
      )}

      {!day ? (
        <div style={{ padding: 20, textAlign: "center", color: "var(--ink-3)", fontSize: 12 }}>Select a day to see balances and transactions.</div>
      ) : (
        <>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>
              {day.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
            </p>
            {calView !== "yearly" && (
              <button type="button" onClick={onClose} style={{ width: 22, height: 22, borderRadius: 6, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2l6 6M8 2l-6 6" stroke="var(--ink-3)" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            )}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "14px", minHeight: 0 }}>
            <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
              <p className="fety-label" style={{ marginBottom: 10 }}>Balance sheet</p>
              {[
                { label: "Starting", value: usd(day.startBal), color: calBalanceColor(day.startBal) },
                { label: "Income", value: day.income > 0 ? `+${usd(day.income)}` : "—", color: calSignedColor(day.income) },
                { label: "Expenses", value: day.expenses < 0 ? usd(day.expenses) : "—", color: calSignedColor(day.expenses) },
                { label: "Ending", value: usd(day.endBal), color: calBalanceColor(day.endBal) },
              ].map((r, i) => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: i > 0 ? 7 : 0, paddingBottom: 7, borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
                  <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{r.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, fontFamily: "var(--font-sans)", color: r.color }}>{r.value}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <p className="fety-label">Transactions</p>
              <button type="button" onClick={() => setShowAdd((s) => !s)} style={{ fontSize: 10, fontWeight: 600, border: "none", background: "transparent", color: "var(--ink-2)", cursor: "pointer" }}>
                {showAdd ? "Cancel" : "+ Add"}
              </button>
            </div>

            {showAdd && (
              <form onSubmit={submitAdd} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: 10, marginBottom: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
                  <EmojiIconPicker
                    value={addIcon}
                    defaultEmoji={iconForType(addType)}
                    onChange={setAddIcon}
                    compact
                  />
                  <div className="fety-form-desc" style={{ flex: 1, minWidth: 0 }}>
                    <input value={addDesc} onChange={(e) => setAddDesc(e.target.value)} placeholder="Description" style={{ ...panelInput, width: "100%" }} />
                  </div>
                </div>
                <CurrencyInput value={addAmount} onChange={setAddAmount} placeholder="0.00" compact style={{ borderRadius: 8 }} />
                <select value={addType} onChange={(e) => setAddType(e.target.value)} style={panelInput}>
                  {transactionTypes.map((tt) => (
                    <option key={tt.id} value={tt.id}>
                      {tt.name}
                    </option>
                  ))}
                </select>
                <select value={addCategory} onChange={(e) => setAddCategory(e.target.value)} style={panelInput}>
                  {[...categories.map((c) => c.name), "Income", "Other"].filter((v, i, a) => a.indexOf(v) === i).map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <button type="submit" style={{ padding: "7px 0", borderRadius: 8, border: "none", background: "var(--ink)", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Save transaction</button>
              </form>
            )}

            {day.items.length === 0 ? (
              <p style={{ fontSize: 11, color: "var(--ink-3)", textAlign: "center", padding: "12px 0" }}>No transactions</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {day.items.map((item) =>
                  editId === item.id ? (
                    <div key={item.id} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
                        <EmojiIconPicker
                          value={editIcon}
                          defaultEmoji={iconForType(editType)}
                          onChange={setEditIcon}
                          compact
                        />
                        <div className="fety-form-desc" style={{ flex: 1, minWidth: 0 }}>
                          <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} style={{ ...panelInput, width: "100%" }} placeholder="Description" />
                        </div>
                      </div>
                      <CurrencyInput value={editAmount} onChange={setEditAmount} placeholder="0.00" compact style={{ borderRadius: 8 }} />
                      <select value={editType} onChange={(e) => setEditType(e.target.value)} style={panelInput}>
                        {transactionTypes.map((tt) => (
                          <option key={tt.id} value={tt.id}>
                            {tt.name}
                          </option>
                        ))}
                      </select>
                      <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} style={panelInput}>
                        {[...categories.map((c) => c.name), "Income", "Other"].filter((v, i, a) => a.indexOf(v) === i).map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button type="button" onClick={saveEdit} style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: "none", background: "var(--ink)", color: "#fff", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>Save</button>
                        <button type="button" onClick={() => setEditId(null)} style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", fontSize: 10, cursor: "pointer" }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 11px" }}>
                      <span style={{ fontSize: 15 }}>{item.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.desc}</p>
                        <p style={{ fontSize: 9, color: "var(--ink-3)" }}>{item.category}</p>
                      </div>
                      <span style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 11, color: item.amount >= 0 ? "var(--clear-dk)" : "var(--trouble-dk)", flexShrink: 0 }}>
                        {item.amount >= 0 ? "+" : ""}{usdF(item.amount)}
                      </span>
                      <button type="button" onClick={() => startEdit(item)} title="Edit" style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 10, color: "var(--ink-3)", padding: 2 }}>✎</button>
                      <button type="button" onClick={() => onDeleteTransaction(item.id)} title="Remove" style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 10, color: "var(--trouble-dk)", padding: 2 }}>×</button>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Dashboard (widget dock) ────────────────────────────────────────────────────
function DashboardView({
  store,
  summary,
  pinned, setPinned, lockedWidgets, onToggleWidgetLock, onSetLockedWidgets, onCustomize, customizing,
}: {
  store: FetyStore;
  summary: FinanceSummary;
  pinned: string[];
  setPinned: React.Dispatch<React.SetStateAction<string[]>>;
  lockedWidgets: string[];
  onToggleWidgetLock: (id: string) => void;
  onSetLockedWidgets: React.Dispatch<React.SetStateAction<string[]>>;
  onCustomize: () => void;
  customizing: boolean;
}) {
  liveWidgets = { store, summary };

  const [dragRowIndex, setDragRowIndex] = useState<number | null>(null);
  const [overRowIndex, setOverRowIndex] = useState<number | null>(null);
  const [dragWidgetId, setDragWidgetId] = useState<string | null>(null);
  const [overWidgetId, setOverWidgetId] = useState<string | null>(null);

  const removeWidget = (id: string) => {
    setPinned((prev) => unpinWidget(prev, id));
    onSetLockedWidgets((prev) => prev.filter((x) => x !== id));
  };

  const byId = useMemo(() => {
    const m = new Map<string, WidgetDef>();
    ALL_WIDGETS.forEach((w) => m.set(w.id, w));
    return m;
  }, []);

  const rows = useMemo(() => packWidgetsIntoRows(pinned, byId), [pinned, byId]);

  useEffect(() => {
    const pruned = pruneWidgetLocksToFirstRow(lockedWidgets, rows);
    if (pruned.length !== lockedWidgets.length || pruned.some((id, i) => id !== lockedWidgets[i])) {
      onSetLockedWidgets(pruned);
    }
  }, [rows, lockedWidgets, onSetLockedWidgets]);

  const reorderRows = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const next = flattenRowsAfterMoveRespectingLocks(rows, lockedWidgets, pinned, fromIndex, toIndex);
    if (next) setPinned(next);
  };

  const reorderWidgetBefore = (fromId: string, beforeId: string) => {
    setPinned((prev) => reorderWidgetRespectingLocks(prev, lockedWidgets, fromId, beforeId));
  };

  const colSpan = (size: WidgetDef["size"]) =>
    size === "full" ? "span 6" : size === "half" ? "span 3" : "span 2";

  const minH = (size: WidgetDef["size"]) =>
    size === "small" ? 80 : size === "half" ? 160 : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {pinned.length === 0 ? (
        <button
          onClick={onCustomize}
          style={{ width: "100%", padding: "48px 0", borderRadius: "var(--radius-card)", border: "2px dashed var(--border)", background: "transparent", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}
        >
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M14 4v20M4 14h20" stroke="var(--ink-3)" strokeWidth="2.2" strokeLinecap="round"/></svg>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-3)" }}>Add widgets to your dashboard</p>
          <p style={{ fontSize: 12, color: "var(--ink-3)" }}>Click Customize to choose what you want to see</p>
        </button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rows.map((rowIds, rowIndex) => {
            const isRowDragging = dragRowIndex === rowIndex;
            const isRowOver = overRowIndex === rowIndex && dragRowIndex !== null && dragRowIndex !== rowIndex;
            return (
              <div
                key={`${rowIds.join("-")}-${rowIndex}`}
                className="fety-widget-row"
                onDragOver={(e) => {
                  if (!customizing || dragRowIndex === null) return;
                  e.preventDefault();
                  setOverRowIndex(rowIndex);
                }}
                onDrop={(e) => {
                  if (!customizing || dragRowIndex === null) return;
                  e.preventDefault();
                  reorderRows(dragRowIndex, rowIndex);
                  setDragRowIndex(null);
                  setOverRowIndex(null);
                }}
                style={{
                  display: "flex",
                  alignItems: "stretch",
                  gap: customizing ? 6 : 0,
                  padding: customizing ? 4 : 0,
                  borderRadius: customizing ? 12 : 0,
                  border: isRowOver ? "2px dashed var(--ink)" : customizing ? "1px dashed var(--border-soft)" : "none",
                  opacity: isRowDragging ? 0.55 : 1,
                }}
              >
                {customizing && (
                  <div
                    className="fety-row-drag-handle"
                    draggable
                    title="Drag row"
                    onDragStart={(e) => {
                      setDragRowIndex(rowIndex);
                      setDragWidgetId(null);
                      e.dataTransfer.effectAllowed = "move";
                      e.stopPropagation();
                    }}
                    onDragEnd={() => {
                      setDragRowIndex(null);
                      setOverRowIndex(null);
                    }}
                  >
                    <svg width="10" height="14" viewBox="0 0 10 14" fill="none" aria-hidden>
                      <circle cx="3" cy="2.5" r="1" fill="currentColor" />
                      <circle cx="7" cy="2.5" r="1" fill="currentColor" />
                      <circle cx="3" cy="7" r="1" fill="currentColor" />
                      <circle cx="7" cy="7" r="1" fill="currentColor" />
                      <circle cx="3" cy="11.5" r="1" fill="currentColor" />
                      <circle cx="7" cy="11.5" r="1" fill="currentColor" />
                    </svg>
                  </div>
                )}
                <div
                  className="fety-widget-row-grid"
                  style={{
                    flex: 1,
                    display: "grid",
                    gridTemplateColumns: "repeat(6, 1fr)",
                    gap: 12,
                    minWidth: 0,
                  }}
                >
                {rowIds.map((id) => {
                  const w = byId.get(id);
                  if (!w) return null;
                  const isWidgetDragging = dragWidgetId === w.id;
                  const isWidgetOver = overWidgetId === w.id && dragWidgetId !== null && dragWidgetId !== w.id;
                  const atTopRow = isWidgetInFirstRow(rows, w.id);
                  const positionLocked = isWidgetPositionLocked(lockedWidgets, w.id);
                  const canDragWidget = customizing && !positionLocked;
                  return (
                    <div
                      key={w.id}
                      className={`fety-widget-cell fety-widget-cell--${w.size}`}
                      draggable={canDragWidget}
                      onDragStart={(e) => {
                        if (!canDragWidget) return;
                        setDragWidgetId(w.id);
                        setDragRowIndex(null);
                        e.dataTransfer.effectAllowed = "move";
                        e.stopPropagation();
                      }}
                      onDragEnd={() => {
                        setDragWidgetId(null);
                        setOverWidgetId(null);
                      }}
                      onDragOver={(e) => {
                        if (!customizing || !dragWidgetId) return;
                        e.preventDefault();
                        e.stopPropagation();
                        setOverWidgetId(w.id);
                      }}
                      onDragLeave={() => {
                        if (overWidgetId === w.id) setOverWidgetId(null);
                      }}
                      onDrop={(e) => {
                        if (!customizing || !dragWidgetId) return;
                        e.preventDefault();
                        e.stopPropagation();
                        if (dragWidgetId !== w.id) reorderWidgetBefore(dragWidgetId, w.id);
                        setDragWidgetId(null);
                        setOverWidgetId(null);
                      }}
                      style={{
                        gridColumn: colSpan(w.size),
                        background: w.color === "var(--surface)" ? "var(--surface)" : w.color,
                        borderRadius: "var(--radius-card)",
                        padding: w.size === "small" ? "14px 16px" : "20px 22px",
                        border: isWidgetOver ? "2px solid var(--ink)" : w.color === "var(--surface)" ? "1px solid var(--border)" : "2px solid transparent",
                        position: "relative",
                        minHeight: minH(w.size),
                        userSelect: "none",
                        opacity: isWidgetDragging ? 0.45 : 1,
                        cursor: canDragWidget ? "grab" : customizing ? "default" : "default",
                        transition: "opacity 0.15s, border-color 0.12s",
                      }}
                    >
                      {customizing && canDragWidget && (
                        <div style={{ position: "absolute", top: 8, left: 10, opacity: 0.25, pointerEvents: "none" }}>
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="3" cy="2.5" r="1" fill="currentColor"/><circle cx="7" cy="2.5" r="1" fill="currentColor"/><circle cx="3" cy="5" r="1" fill="currentColor"/><circle cx="7" cy="5" r="1" fill="currentColor"/><circle cx="3" cy="7.5" r="1" fill="currentColor"/><circle cx="7" cy="7.5" r="1" fill="currentColor"/></svg>
                        </div>
                      )}
                      {w.render()}
                      {customizing && (
                        <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 4 }}>
                          {atTopRow && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onToggleWidgetLock(w.id); }}
                              title={positionLocked ? "Unpin — allow moving this widget" : "Pin in place at top of dashboard"}
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 99,
                                border: positionLocked ? "2px solid var(--ink)" : "1px solid var(--border)",
                                background: positionLocked ? "var(--ink)" : "rgba(255,255,255,0.85)",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "background 0.12s, border-color 0.12s",
                              }}
                            >
                              <WidgetPinIcon
                                locked={positionLocked}
                                size={16}
                                color={positionLocked ? "#fff" : "var(--ink-2)"}
                              />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); removeWidget(w.id); }}
                            title="Remove from dashboard"
                            style={{ width: 28, height: 28, borderRadius: 99, background: "rgba(0,0,0,0.08)", border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                          >
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2l6 6M8 2L2 8" stroke="var(--trouble-dk)" strokeWidth="1.4" strokeLinecap="round" /></svg>
                          </button>
                        </div>
                      )}
                      {!customizing && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeWidget(w.id); }}
                        title="Remove widget"
                        style={{ position: "absolute", top: 8, right: 8, width: 22, height: 22, borderRadius: 99, background: "rgba(0,0,0,0.1)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.15s" }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}
                      >
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 1l6 6M7 1L1 7" stroke="rgba(0,0,0,0.55)" strokeWidth="1.4" strokeLinecap="round"/></svg>
                      </button>
                      )}
                    </div>
                  );
                })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Page Header ───────────────────────────────────────────────────────────────
const PAGE_META: Record<Page, { title: string; sub: string }> = {
  dashboard: { title: "Dashboard", sub: "Everything's counted. Here's what's yours." },
  spending:  { title: "Transactions", sub: "Every dollar in and out of your accounts." },
  budget:    { title: "Budget", sub: "Tracks are ink; coral marks the category that's over." },
  goals:     { title: "Goals", sub: "Money you're holding for later." },
  settings:  { title: "Settings", sub: "Profile, linked accounts, and data preferences." },
  calendar:  { title: "Calendar", sub: "Cash flow and spending power, day by day." },
};

// ─── App Root ──────────────────────────────────────────────────────────────────
export default function App() {
  const {
    store,
    summary,
    addTransaction,
    deleteTransaction,
    updateTransaction,
    updateBill,
    updateCategoryBudget,
    deleteCategory,
    addBill,
    deleteBill,
    addIncomeStream,
    updateIncomeStream,
    deleteIncomeStream,
    addRecurringTransaction,
    updateRecurringTransaction,
    deleteRecurringTransaction,
    addGoal,
    updateGoal,
    deleteGoal,
    updateProfile,
    updateAccount,
    addAccount,
    deleteAccount,
    addMessage,
    setPinnedWidgets,
    toggleDashboardWidgetLock,
    setLockedDashboardWidgets,
    resetAll,
    startFreshSetup,
    completeOnboarding,
    replaceCategories,
    replaceBills,
    replaceIncomeStreams,
    replaceRecurringTransactions,
    importTransactionsBulk,
    addTransactionType,
    updateTransactionType,
    deleteTransactionType,
  } = useFetyData();

  const transactionTypes = useMemo(() => getTransactionTypes(store), [store]);
  const transactionTypeInUse = useCallback(
    (id: string) =>
      store.transactions.some((t) => t.type === id) ||
      (store.recurringTransactions ?? []).some((r) => r.transactionType === id),
    [store.transactions, store.recurringTransactions],
  );

  const [page, setPage] = useState<Page>("dashboard");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [chatProcessing, setChatProcessing] = useState(false);
  const pendingConfirmations = useRef<Map<string, ToolAction>>(new Map());

  const pinned = store.pinnedWidgets;
  const messages = store.messages;
  const navDate = formatNavDate();

  const assistantDeps = useMemo(
    () => ({
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addGoal,
      updateProfile,
    }),
    [addTransaction, updateTransaction, deleteTransaction, addGoal, updateProfile],
  );

  const pushAssistantReply = useCallback(
    (reply: ReturnType<typeof handleAssistantMessageWithDeps>) => {
      const now = new Date();
      if (reply.confirmation) {
        pendingConfirmations.current.set(reply.confirmation.id, reply.confirmation.action);
      }
      addMessage({
        id: Date.now() + Math.floor(Math.random() * 1000),
        role: "system",
        time: now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        text: reply.text,
        tag: reply.tag,
        resultCard: reply.resultCard,
        confirmationId: reply.confirmation?.id,
        confirmationTitle: reply.confirmation?.title,
      });
    },
    [addMessage],
  );

  const recentUserText = useMemo(
    () =>
      messages
        .filter((m) => m.role === "user")
        .slice(-5)
        .map((m) => m.text),
    [messages],
  );

  const handleSend = useCallback(
    (text: string) => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      addMessage({ id: Date.now(), role: "user", text, time: timeStr });
      setChatProcessing(true);
      window.setTimeout(() => {
        const reply = handleAssistantMessageWithDeps(
          text,
          { store, summary, recentUserText },
          assistantDeps,
        );
        pushAssistantReply(reply);
        setChatProcessing(false);
      }, 400);
    },
    [addMessage, assistantDeps, pushAssistantReply, recentUserText, store, summary],
  );

  const handleConfirmAction = useCallback(
    (confirmationId: string) => {
      const action = pendingConfirmations.current.get(confirmationId);
      if (!action) {
        pushAssistantReply({ text: "That confirmation expired. Please ask again." });
        return;
      }
      pendingConfirmations.current.delete(confirmationId);
      const reply = confirmAssistantAction(action, assistantDeps, summary);
      pushAssistantReply(reply);
    },
    [assistantDeps, pushAssistantReply, summary],
  );

  const handleCancelConfirm = useCallback(
    (confirmationId: string) => {
      pendingConfirmations.current.delete(confirmationId);
      pushAssistantReply({ text: "Cancelled — nothing was changed." });
    },
    [pushAssistantReply],
  );

  const pageTitle = useMemo(() => {
    if (page === "dashboard") {
      return `Good morning, ${store.profile.displayName}`;
    }
    return PAGE_META[page].title;
  }, [page, store.profile.displayName]);

  const renderView = () => {
    if (page === "calendar") return null;
    switch (page) {
      case "budget":
        return (
          <BudgetManageView
            categories={summary.categoriesWithSpent}
            bills={store.bills}
            incomeStreams={store.incomeStreams ?? []}
            recurringTransactions={store.recurringTransactions ?? []}
            transactionTypes={transactionTypes}
            viewMode={viewMode}
            onUpdateBudget={updateCategoryBudget}
            onDeleteCategory={deleteCategory}
            onUpdateBill={updateBill}
            onAddBill={addBill}
            onDeleteBill={deleteBill}
            onUpdateIncomeStream={updateIncomeStream}
            onAddIncomeStream={addIncomeStream}
            onDeleteIncomeStream={deleteIncomeStream}
            onUpdateRecurringTransaction={updateRecurringTransaction}
            onAddRecurringTransaction={addRecurringTransaction}
            onDeleteRecurringTransaction={deleteRecurringTransaction}
            onAddTransactionType={addTransactionType}
            onUpdateTransactionType={updateTransactionType}
            onDeleteTransactionType={deleteTransactionType}
            transactionTypeInUse={transactionTypeInUse}
          />
        );
      case "spending":
        return (
          <TransactionsManageView
            transactions={store.transactions}
            categories={store.categories}
            transactionTypes={transactionTypes}
            viewMode={viewMode}
            onAdd={addTransaction}
            onUpdate={updateTransaction}
            onDelete={deleteTransaction}
          />
        );
      case "goals":
        return (
          <GoalsManageView
            goals={store.goals}
            viewMode={viewMode}
            onAdd={addGoal}
            onUpdate={updateGoal}
            onDelete={deleteGoal}
          />
        );
      case "settings":
        return (
          <SettingsManageView
            profile={store.profile}
            accounts={store.accounts}
            onUpdateProfile={updateProfile}
            onUpdateAccount={updateAccount}
            onAddAccount={addAccount}
            onDeleteAccount={deleteAccount}
            onReset={resetAll}
            onRestartSetup={() => {
              if (confirm("Clear all data and run setup again? This cannot be undone.")) startFreshSetup();
            }}
          />
        );
      default:
        return (
          <DashboardView
            store={store}
            summary={summary}
            pinned={pinned}
            setPinned={setPinnedWidgets}
            lockedWidgets={store.lockedDashboardWidgets ?? []}
            onToggleWidgetLock={toggleDashboardWidgetLock}
            onSetLockedWidgets={setLockedDashboardWidgets}
            onCustomize={() => setPickerOpen(true)}
            customizing={pickerOpen}
          />
        );
    }
  };

  if (!store.onboardingCompleted) {
    return (
      <OnboardingView
        store={store}
        onUpdateProfile={updateProfile}
        onReplaceCategories={replaceCategories}
        onReplaceBills={replaceBills}
        onReplaceIncomeStreams={replaceIncomeStreams}
        onReplaceRecurringTransactions={replaceRecurringTransactions}
        onImportTransactionsBulk={importTransactionsBulk}
        onComplete={completeOnboarding}
      />
    );
  }

  liveWidgets = { store, summary };

  return (
    <div className="fety-shell">
      <div className="fety-main-column">
        <TopNav
          page={page}
          setPage={setPage}
          navDate={navDate}
          profileInitial={(store.profile.displayName.trim()[0] || "?").toUpperCase()}
          onOpenSettings={() => setPage("settings")}
        />

        <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
          {page === "calendar" ? (
            <CalendarView
              store={store}
              transactionTypes={transactionTypes}
              onAddTransaction={addTransaction}
              onUpdateTransaction={updateTransaction}
              onDeleteTransaction={deleteTransaction}
            />
          ) : (
            <>
              <main className="fety-main-scroll" style={{ flex: 1, overflowY: "auto", padding: "24px 24px 48px", minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
                  <div>
                    <h1 style={{ fontSize: 26, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>{pageTitle}</h1>
                    <p style={{ fontSize: 15, color: "var(--ink-2)", marginTop: 4, lineHeight: 1.45 }}>{PAGE_META[page].sub}</p>
                  </div>
                  {page === "dashboard" && !pickerOpen && (
                    <button
                      type="button"
                      onClick={() => setPickerOpen(true)}
                      style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 99, border: "1px solid var(--ink)", background: "var(--surface)", color: "var(--ink)", cursor: "pointer", fontSize: 12, fontWeight: 600, flexShrink: 0, marginTop: 2 }}
                    >
                      Customise
                    </button>
                  )}
                </div>
                {renderView()}
              </main>
              {page === "dashboard" && pickerOpen && (
                <WidgetPicker
                  pinned={pinned}
                  onDashboardToggle={(id) => setPinnedWidgets((prev) => toggleWidgetOnDashboard(prev, id))}
                  onClose={() => setPickerOpen(false)}
                />
              )}
            </>
          )}
        </div>
      </div>

      <div className={`fety-chat-dock${chatCollapsed ? " fety-chat-dock-collapsed" : " fety-chat-dock-open"}`}>
        {!chatCollapsed && (
          <button
            type="button"
            className="fety-chat-mobile-backdrop"
            aria-label="Close chat"
            onClick={() => setChatCollapsed(true)}
          />
        )}
        {chatCollapsed ? (
          <div
            className="fety-assistant-rail"
            title="Show chat"
            onClick={() => setChatCollapsed(false)}
            onKeyDown={(e) => e.key === "Enter" && setChatCollapsed(false)}
            role="button"
            tabIndex={0}
          >
            <div className="fety-assistant-rail-inner">
              <ChatExpandIcon />
              <span className="fety-assistant-rail-label">Chat</span>
            </div>
          </div>
        ) : (
          <ChatPanel
            messages={messages}
            processing={chatProcessing}
            onSend={handleSend}
            onCollapse={() => setChatCollapsed(true)}
            onConfirm={handleConfirmAction}
            onCancelConfirm={handleCancelConfirm}
          />
        )}
      </div>
    </div>
  );
}
