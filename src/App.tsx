import { useState, useRef, useEffect, useCallback } from "react";
import { FetyLogo } from "./FetyLogo";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

// ─── Types ─────────────────────────────────────────────────────────────────────
type Page = "dashboard" | "budget" | "spending" | "goals" | "settings" | "calendar";
type ViewMode = "cards" | "list";
type CalView = "monthly" | "weekly" | "biweekly" | "daily";

interface ChatMessage {
  id: number;
  role: "system" | "user";
  text: string;
  time: string;
  tag?: string;
}

interface CalDay {
  date: Date;
  startBal: number;
  endBal: number;
  income: number;
  expenses: number;
  items: { icon: string; desc: string; amount: number; type: "income" | "expense" | "bill" | "paycheck" }[];
}

// ─── Calendar data factory ─────────────────────────────────────────────────────
// Build a month of realistic data centred on September 2026
function buildCalendarData(): Map<string, CalDay> {
  const map = new Map<string, CalDay>();
  const KEY = (d: Date) => d.toISOString().slice(0, 10);

  // Seed events (date string → items)
  const events: Record<string, CalDay["items"]> = {
    "2026-09-01": [
      { icon: "💵", desc: "Employer Paycheck",  amount: 2800,   type: "paycheck" },
      { icon: "⛽", desc: "Gas Station",         amount: -48,    type: "expense"  },
    ],
    "2026-09-02": [
      { icon: "🏠", desc: "Rent",                amount: -2000,  type: "bill"     },
    ],
    "2026-09-03": [
      { icon: "🛒", desc: "Trader Joe's",        amount: -87,    type: "expense"  },
    ],
    "2026-09-05": [
      { icon: "⚡", desc: "Electric Bill",       amount: -142,   type: "bill"     },
      { icon: "📱", desc: "Phone Bill",          amount: -85,    type: "bill"     },
    ],
    "2026-09-07": [
      { icon: "🎬", desc: "Netflix",             amount: -16,    type: "bill"     },
      { icon: "🎵", desc: "Spotify",             amount: -10,    type: "bill"     },
    ],
    "2026-09-08": [
      { icon: "🍽️", desc: "Chipotle",           amount: -15,    type: "expense"  },
    ],
    "2026-09-09": [
      { icon: "🛒", desc: "Whole Foods",         amount: -52,    type: "expense"  },
      { icon: "💼", desc: "Freelance Invoice",   amount:  350,   type: "income"   },
    ],
    "2026-09-10": [
      { icon: "📦", desc: "Amazon",              amount: -90,    type: "expense"  },
    ],
    "2026-09-12": [
      { icon: "🍽️", desc: "Dining Out",         amount: -65,    type: "expense"  },
    ],
    "2026-09-14": [
      { icon: "🌐", desc: "Internet Bill",       amount: -65,    type: "bill"     },
    ],
    "2026-09-15": [
      { icon: "💵", desc: "Employer Paycheck",   amount: 2800,   type: "paycheck" },
      { icon: "⛽", desc: "Gas Station",         amount: -52,    type: "expense"  },
    ],
    "2026-09-16": [
      { icon: "🛍️", desc: "Target",             amount: -63,    type: "expense"  },
    ],
    "2026-09-18": [
      { icon: "🛒", desc: "Whole Foods",         amount: -74,    type: "expense"  },
    ],
    "2026-09-20": [
      { icon: "🍽️", desc: "Restaurant",         amount: -48,    type: "expense"  },
      { icon: "💆", desc: "Personal Care",       amount: -35,    type: "expense"  },
    ],
    "2026-09-22": [
      { icon: "🚗", desc: "Car Insurance",       amount: -140,   type: "bill"     },
    ],
    "2026-09-24": [
      { icon: "🛒", desc: "Grocery Store",       amount: -68,    type: "expense"  },
    ],
    "2026-09-26": [
      { icon: "🎬", desc: "Movie Tickets",       amount: -28,    type: "expense"  },
    ],
    "2026-09-28": [
      { icon: "📦", desc: "Amazon",              amount: -44,    type: "expense"  },
    ],
    "2026-09-30": [
      { icon: "🏦", desc: "Savings Transfer",    amount: -200,   type: "expense"  },
    ],
  };

  // Walk through Sep 2026 building running balance
  let balance = 1820; // Aug 31 ending balance
  const start = new Date(2026, 8, 1);  // Sep 1
  const end   = new Date(2026, 8, 30); // Sep 30

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key   = KEY(d);
    const items = events[key] ?? [];
    const income   = items.filter(i => i.amount > 0).reduce((s, i) => s + i.amount, 0);
    const expenses = items.filter(i => i.amount < 0).reduce((s, i) => s + i.amount, 0);
    const startBal = balance;
    const endBal   = balance + income + expenses;
    balance = endBal;
    map.set(key, { date: new Date(d), startBal, endBal, income, expenses, items });
  }
  return map;
}

const CAL_DATA = buildCalendarData();
const CAL_KEY  = (d: Date) => d.toISOString().slice(0, 10);

// ─── Static data ───────────────────────────────────────────────────────────────
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

const SEED_MESSAGES: ChatMessage[] = [
  { id: 1, role: "system", text: "Morning. You've got $140 of spending power this week — after every bill I know about.", time: "8:00 AM" },
  { id: 2, role: "user",   text: "Just paid the electric bill, $142.", time: "8:14 AM" },
  { id: 3, role: "system", text: "Logged to Bills. $10 left in that budget, and nothing else due this month.", time: "8:14 AM", tag: "Budget updated" },
  { id: 4, role: "user",   text: "Groceries at Whole Foods, about $52.", time: "9:31 AM" },
  { id: 5, role: "system", text: "Added $52 to Groceries. $128 left in that budget for September.", time: "9:31 AM", tag: "Transaction added" },
  { id: 6, role: "user",   text: "Freelance payment of $350 came in today.", time: "11:02 AM" },
  { id: 7, role: "system", text: "Recorded +$350 income. Spending power this week is now $140.", time: "11:02 AM", tag: "Income recorded" },
];

const getAutoReply = (msg: string): ChatMessage => {
  const lower = msg.toLowerCase();
  let text = "I've noted that. Your dashboard has been updated to reflect this.";
  let tag: string | undefined = "Note saved";
  if (/spent|paid|bought|purchased|charged/i.test(lower)) {
    const match = msg.match(/\$[\d,.]+|\d+/);
    const amt = match ? match[0] : "that amount";
    text = `Logged ${amt} as an expense. Spending power adjusted.`;
    tag = "Transaction added";
  } else if (/income|received|paid me|deposit|paycheck|freelance/i.test(lower)) {
    text = "Income recorded. Check the dashboard for updated spending power.";
    tag = "Income recorded";
  } else if (/transfer|moved|savings/i.test(lower)) {
    text = "Logged as a transfer. Net spending power stays the same.";
    tag = "Transfer logged";
  } else if (/goal|saving for/i.test(lower)) {
    text = "Goal update noted. Check your Goals tab for the latest progress.";
    tag = "Goal updated";
  } else if (/budget|limit|category/i.test(lower)) {
    text = "Budget updated. Your Budget page reflects the new allocation.";
    tag = "Budget updated";
  }
  const now = new Date();
  return { id: Date.now(), role: "system", text, time: now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }), tag };
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
const usd  = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Math.abs(n));
const usdF = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n));
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ─── Top Nav ───────────────────────────────────────────────────────────────────
const NAV_ITEMS: { id: Page; label: string }[] = [
  { id: "dashboard", label: "Dashboard"    },
  { id: "calendar",  label: "Calendar"     },
  { id: "spending",  label: "Transactions" },
  { id: "budget",    label: "Budget"       },
  { id: "goals",     label: "Goals"        },
  { id: "settings",  label: "Settings"     },
];

function TopNav({ page, setPage }: { page: Page; setPage: (p: Page) => void }) {
  const activeNav = page;
  return (
    <nav style={{ display: "flex", alignItems: "center", height: 56, background: "var(--surface)", borderBottom: "1px solid var(--border)", padding: "0 24px", flexShrink: 0, zIndex: 20 }}>
      <FetyLogo />
      <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
        {NAV_ITEMS.map(item => {
          const active = activeNav === item.id;
          return (
            <button key={item.id} onClick={() => setPage(item.id)} style={{ padding: "7px 12px", borderRadius: "var(--radius-ctrl)", fontSize: 13, fontWeight: active ? 600 : 400, border: active ? "1px solid var(--border)" : "1px solid transparent", cursor: "pointer", transition: "all 0.14s", background: active ? "var(--paper)" : "transparent", color: active ? "var(--ink)" : "var(--ink-2)", whiteSpace: "nowrap" }}>
              {item.label}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-3)", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-ctrl)", padding: "5px 10px" }}>Sep 16, 2026</div>
        <div style={{ width: 30, height: 30, borderRadius: "var(--radius-ctrl)", background: "var(--paper)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: "var(--ink)", cursor: "pointer" }}>A</div>
      </div>
    </nav>
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
      <p style={{ fontSize: 16, fontWeight: 400, color: "var(--ink)", letterSpacing: "-0.5px", fontFamily: "var(--font-mono)", lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 9, color: "var(--ink-3)", marginTop: 2 }}>{sub}</p>}
    </div>
  </div>
);

const ALL_WIDGETS: WidgetDef[] = [
  // ── Small stat cards ──────────────────────────────────────────────────────────
  {
    id: "stat-balance", label: "Today's Balance", color: "var(--surface)", size: "small",
    preview: () => statPreview("var(--clear)", "Today's Balance", "$2,612", "All accounts"),
    render: () => (
      <div style={{ display: "flex", alignItems: "center", gap: 8, height: "100%" }}>
        <div style={{ width: 9, height: 9, borderRadius: "var(--radius-marker)", background: "var(--clear)", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 400, color: "var(--ink-3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: 4 }}>Today's Balance</p>
          <p style={{ fontSize: 22, fontWeight: 400, color: "var(--ink)", letterSpacing: "-0.8px", fontFamily: "var(--font-mono)", lineHeight: 1 }}>$2,612</p>
        </div>
      </div>
    ),
  },
  {
    id: "stat-money-in", label: "Money In Today", color: "var(--surface)", size: "small",
    preview: () => statPreview("var(--clear)", "Money In Today", "+$350", "Income today"),
    render: () => (
      <div style={{ display: "flex", alignItems: "center", gap: 8, height: "100%" }}>
        <div style={{ width: 9, height: 9, borderRadius: "var(--radius-marker)", background: "var(--clear)", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 400, color: "var(--ink-3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: 4 }}>Money In Today</p>
          <p style={{ fontSize: 22, fontWeight: 400, color: "var(--lime-dk)", letterSpacing: "-0.8px", fontFamily: "var(--font-mono)", lineHeight: 1 }}>+$350</p>
        </div>
      </div>
    ),
  },
  {
    id: "stat-money-out", label: "Money Out Today", color: "var(--surface)", size: "small",
    preview: () => statPreview("var(--trouble)", "Money Out Today", "-$52", "Expenses today"),
    render: () => (
      <div style={{ display: "flex", alignItems: "center", gap: 8, height: "100%" }}>
        <div style={{ width: 9, height: 9, borderRadius: "var(--radius-marker)", background: "var(--trouble)", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 400, color: "var(--ink-3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: 4 }}>Money Out Today</p>
          <p style={{ fontSize: 22, fontWeight: 400, color: "var(--peach-dk)", letterSpacing: "-0.8px", fontFamily: "var(--font-mono)", lineHeight: 1 }}>-$52</p>
        </div>
      </div>
    ),
  },
  {
    id: "stat-monthly-net", label: "Monthly Net", color: "var(--surface)", size: "small",
    preview: () => statPreview("var(--clear)", "Monthly Net", "+$2,450", "September"),
    render: () => (
      <div style={{ display: "flex", alignItems: "center", gap: 8, height: "100%" }}>
        <div style={{ width: 9, height: 9, borderRadius: "var(--radius-marker)", background: "var(--clear)", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 400, color: "var(--ink-3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: 4 }}>Monthly Net</p>
          <p style={{ fontSize: 22, fontWeight: 400, color: "var(--lime-dk)", letterSpacing: "-0.8px", fontFamily: "var(--font-mono)", lineHeight: 1 }}>+$2,450</p>
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
          <p style={{ fontSize: 22, fontWeight: 400, color: "var(--ink)", letterSpacing: "-0.8px", fontFamily: "var(--font-mono)", lineHeight: 1 }}>$634</p>
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
          <p style={{ fontSize: 22, fontWeight: 400, color: "var(--ink)", letterSpacing: "-0.8px", fontFamily: "var(--font-mono)", lineHeight: 1 }}>$2,028</p>
        </div>
      </div>
    ),
  },

  // ── Half-width detailed widgets ────────────────────────────────────────────────
  {
    id: "weekly-power", label: "Weekly spending power", color: "var(--amber)", size: "half",
    preview: () => statPreview("var(--amber-dk)", "Spending power", "$140", "22% of $640 budget"),
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <p className="fety-label" style={{ marginBottom: 8 }}>Spending power · this week</p>
        <p className="fety-figure" style={{ fontSize: 48 }}>$140</p>
        <p style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 8 }}>Available after bills you have on file</p>
        <div style={{ marginTop: 16, height: 6, background: "rgba(17,17,17,0.12)", borderRadius: "var(--radius-track)" }}>
          <div style={{ width: "22%", height: "100%", background: "var(--amber-dk)", borderRadius: "var(--radius-track)" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--ink-3)" }}>$140 of $640 weekly budget</span>
          <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--ink-2)" }}>22%</span>
        </div>
      </div>
    ),
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
    render: () => (
      <div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>Balance This Week</p>
            <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>Daily ending balance · Sep 7–13</p>
          </div>
          <p style={{ fontSize: 22, fontWeight: 400, color: "var(--ink)", letterSpacing: "-0.8px", fontFamily: "var(--font-mono)" }}>$2,612</p>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={cashFlow}>
            <defs><linearGradient id="wg1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--clear)" stopOpacity={0.45}/><stop offset="95%" stopColor="var(--clear)" stopOpacity={0}/></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false}/>
            <XAxis dataKey="d" tick={{ fontSize: 10, fill: "var(--ink-3)" }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fontSize: 10, fill: "var(--ink-3)" }} axisLine={false} tickLine={false} tickFormatter={v => `$${Number(v)/1000}k`} width={36}/>
            <Tooltip formatter={(v: unknown) => [usdF(Number(v)), "Balance"]} contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid var(--border)", fontFamily: "var(--font-mono)" }}/>
            <Area type="monotone" dataKey="bal" stroke="var(--clear-dk)" strokeWidth={2.5} fill="url(#wg1)" dot={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
    ),
  },
  {
    id: "monthly-spend-chart", label: "Monthly Spending Trend", color: "var(--surface)", size: "half",
    preview: () => statPreview("var(--ink)", "Monthly Spending Trend", "$3,650", "Bar chart · last 6 months"),
    render: () => (
      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 2 }}>Monthly Spending</p>
        <p style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 16 }}>Last 6 months</p>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={monthlySpend} barSize={20}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false}/>
            <XAxis dataKey="m" tick={{ fontSize: 10, fill: "var(--ink-3)" }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fontSize: 10, fill: "var(--ink-3)" }} axisLine={false} tickLine={false} tickFormatter={v => `$${Number(v)/1000}k`} width={36}/>
            <Tooltip formatter={(v: unknown) => [usd(Number(v)), "Spent"]} contentStyle={{ fontSize: 11, borderRadius: 9, border: "1px solid var(--border)" }}/>
            <Bar dataKey="v" fill="var(--ink)" radius={[4,4,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>
    ),
  },
  {
    id: "spending-breakdown", label: "Spending Breakdown", color: "var(--surface)", size: "half",
    preview: () => statPreview("var(--ink-3)", "Spending Breakdown", "5 categories", "Donut chart · where money goes"),
    render: () => (
      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 16 }}>Where Your Money Is Going</p>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <ResponsiveContainer width={110} height={110}>
            <PieChart><Pie data={donutData} dataKey="value" innerRadius={32} outerRadius={52} paddingAngle={2} startAngle={90} endAngle={-270}>{donutData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i]}/>)}</Pie></PieChart>
          </ResponsiveContainer>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
            {donutData.map((d, i) => (
              <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ width: 7, height: 7, borderRadius: 2, background: DONUT_COLORS[i], flexShrink: 0 }}/>
                <span style={{ fontSize: 11, color: "var(--ink-2)", flex: 1 }}>{d.name}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink)", fontFamily: "var(--font-mono)" }}>{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
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
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", fontFamily: "var(--font-mono)" }}>$1,812</p>
          </div>
          <div style={{ flex: 1, background: "rgba(255,255,255,0.5)", borderRadius: 10, padding: "10px 12px" }}>
            <p style={{ fontSize: 10, color: "rgba(0,0,0,0.5)", marginBottom: 3 }}>Savings</p>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", fontFamily: "var(--font-mono)" }}>$800</p>
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
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--mint-dk)", fontFamily: "var(--font-mono)" }}>+$350</span>
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
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--peach-dk)", fontFamily: "var(--font-mono)" }}>-$52</span>
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
            <p style={{ fontSize: 16, fontWeight: 400, color: "var(--lime-dk)", fontFamily: "var(--font-mono)" }}>+$3,150</p>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 10, color: "rgba(0,0,0,0.45)", marginBottom: 3 }}>Expenses</p>
            <p style={{ fontSize: 16, fontWeight: 400, color: "var(--peach-dk)", fontFamily: "var(--font-mono)" }}>-$700</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "budget-remaining", label: "Budget Health", color: "var(--surface)", size: "half",
    preview: () => statPreview("var(--ink)", "Budget Health", "$477 left", "Progress bars · top 4 categories"),
    render: () => (
      <div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>Budget Health</p>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--lime-dk)", background: "var(--lime)", borderRadius: 99, padding: "2px 9px" }}>$477 left</span>
        </div>
        {budgetCategories.slice(0, 4).map(c => {
          const pct = Math.min(100, Math.round((c.spent / c.budget) * 100));
          return (
            <div key={c.name} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: "var(--ink-2)" }}>{c.icon} {c.name}</span>
                <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: pct >= 100 ? "var(--peach-dk)" : "var(--ink-3)" }}>{usd(c.spent)} / {usd(c.budget)}</span>
              </div>
              <div style={{ height: 5, background: "var(--bg)", borderRadius: 99 }}>
                <div style={{ width: `${pct}%`, height: "100%", background: pct >= 100 ? "var(--trouble-dk)" : pct >= 80 ? "var(--amber-dk)" : "var(--ink)", borderRadius: "var(--radius-track)" }} />
              </div>
            </div>
          );
        })}
      </div>
    ),
  },
  {
    id: "next-paycheck", label: "Next Paycheck", color: "var(--later)", size: "half",
    preview: () => statPreview("var(--lav-dk)", "Next Paycheck", "Sept 15", "$2,800 · 2 days away"),
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.5)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.16em" }}>Next Paycheck</p>
        <p style={{ fontSize: 36, fontWeight: 400, color: "var(--ink)", letterSpacing: "-1.5px", lineHeight: 1 }}>Sept 15</p>
        <p style={{ fontSize: 28, fontWeight: 400, color: "var(--lav-dk)", letterSpacing: "-1px", lineHeight: 1, marginTop: 4 }}>$2,800</p>
        <p style={{ fontSize: 12, color: "rgba(0,0,0,0.5)", marginTop: 8 }}>2 days away · Employer direct deposit</p>
        <div style={{ background: "rgba(255,255,255,0.4)", borderRadius: 10, padding: "10px 12px", marginTop: 16 }}>
          <p style={{ fontSize: 10, color: "rgba(0,0,0,0.5)", marginBottom: 2 }}>Projected balance after deposit</p>
          <p style={{ fontSize: 18, fontWeight: 400, color: "var(--lav-dk)", fontFamily: "var(--font-mono)" }}>$5,412</p>
        </div>
      </div>
    ),
  },
  {
    id: "savings-goal", label: "Savings Goals", color: "var(--surface)", size: "full",
    preview: () => statPreview("var(--mint-dk)", "Savings Goals", "4 goals", "Emergency 65% · Vacation 48%"),
    render: () => (
      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 16 }}>Savings Goals</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          {goals.map(g => {
            const pct = Math.round((g.saved / g.target) * 100);
            return (
              <div key={g.name} style={{ background: "var(--bg)", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 18 }}>{g.icon}</span>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>{g.name}</p>
                    <p style={{ fontSize: 10, color: "var(--ink-3)" }}>Target: {g.date}</p>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 400, color: "var(--ink)", fontFamily: "var(--font-mono)" }}>{usd(g.saved)}</span>
                  <span style={{ fontSize: 10, color: "var(--ink-3)", alignSelf: "flex-end" }}>of {usd(g.target)}</span>
                </div>
                <div style={{ height: 5, background: "var(--border)", borderRadius: 99 }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: g.color, borderRadius: 99 }} />
                </div>
                <p style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 4 }}>{pct}% complete</p>
              </div>
            );
          })}
        </div>
      </div>
    ),
  },
  {
    id: "biggest-bill", label: "Largest Upcoming Bill", color: "var(--peach)", size: "half",
    preview: () => statPreview("var(--peach-dk)", "Largest Upcoming Bill", "$2,000", "Rent · due Oct 1"),
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.5)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.16em" }}>Largest Upcoming Bill</p>
        <p style={{ fontSize: 42, fontWeight: 400, color: "var(--ink)", letterSpacing: "-2px", lineHeight: 1 }}>$2,000</p>
        <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(0,0,0,0.6)", marginTop: 6 }}>Rent</p>
        <p style={{ fontSize: 12, color: "rgba(0,0,0,0.45)", marginTop: 2 }}>Due Oct 1 · 18 days away</p>
        <div style={{ marginTop: "auto", paddingTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
          {[{ name: "Rent", amt: "$2,000", due: "Oct 1" }, { name: "Electric", amt: "$142", due: "Sep 18" }, { name: "Internet", amt: "$65", due: "Sep 22" }].map(b => (
            <div key={b.name} style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 6 }}>
              <span style={{ fontSize: 11, color: "rgba(0,0,0,0.6)" }}>{b.name}</span>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink)", fontFamily: "var(--font-mono)" }}>{b.amt}</span>
                <span style={{ fontSize: 10, color: "rgba(0,0,0,0.4)", marginLeft: 6 }}>{b.due}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

const DEFAULT_PINNED = ["stat-balance", "stat-money-in", "stat-money-out", "stat-weekly-spend", "stat-monthly-net", "stat-remaining", "today-balance", "weekly-power", "balance-chart", "monthly-spend-chart", "budget-remaining", "next-paycheck", "spending-breakdown"];

// ─── Widget Picker Panel (push sidebar) ─────────────────────────────────────────
const SIZE_GROUPS: { label: string; sizes: WidgetDef["size"][] }[] = [
  { label: "Stat Cards", sizes: ["small"] },
  { label: "Detail Cards", sizes: ["half"] },
  { label: "Full-Width", sizes: ["full"] },
];

function WidgetPicker({
  pinned, onToggle, onClose,
}: {
  pinned: string[]; onToggle: (id: string) => void; onClose: () => void;
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
                      <button
                        onClick={() => onToggle(w.id)}
                        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}
                      >
                        <div>
                          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--ink)" }}>{w.label}</p>
                          <p style={{ fontSize: 9, color: "var(--ink-3)", marginTop: 1 }}>{w.size === "full" ? "Full width" : w.size === "half" ? "Half width" : "Stat card"}</p>
                        </div>
                        <div style={{ width: 20, height: 20, borderRadius: 99, flexShrink: 0, border: active ? "none" : "1.5px solid var(--border)", background: active ? "var(--ink)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {active && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 2.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                      </button>
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


// ─── Chat Panel ────────────────────────────────────────────────────────────────
function ChatPanel({ messages, onSend, onCollapse }: { messages: ChatMessage[]; onSend: (t: string) => void; onCollapse: () => void }) {
  const [draft, setDraft] = useState("");
  const feedRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [messages]);

  const send = () => {
    const t = draft.trim();
    if (!t) return;
    onSend(t);
    setDraft("");
    inputRef.current?.focus();
  };

  return (
    <div style={{ width: 300, flexShrink: 0, display: "flex", flexDirection: "column", background: "var(--surface)", borderRight: "1px solid var(--border)", height: "100%", overflow: "hidden" }}>
      {/* Chat header with collapse button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>Assistant</span>
        <button onClick={onCollapse} title="Collapse chat" style={{ width: 24, height: 24, borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M7 2L4 5.5L7 9" stroke="var(--ink-3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

      <div ref={feedRef} style={{ flex: 1, overflowY: "auto", padding: "14px 14px 6px" }}>
        {messages.map(msg => <ChatBubble key={msg.id} msg={msg} />)}
      </div>

      <div style={{ borderTop: "1px solid var(--border)", padding: "10px 12px", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", background: "var(--bg)", borderRadius: 14, padding: "8px 10px 8px 14px", border: "1px solid var(--border)" }}>
          <textarea
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Share a spending update…"
            rows={1}
            style={{ flex: 1, resize: "none", border: "none", background: "transparent", fontSize: 12, color: "var(--ink)", fontFamily: "inherit", outline: "none", lineHeight: 1.5, maxHeight: 80, overflowY: "auto" }}
          />
          <button onClick={send} disabled={!draft.trim()} style={{ width: 30, height: 30, borderRadius: 99, border: "none", cursor: draft.trim() ? "pointer" : "default", background: draft.trim() ? "var(--ink)" : "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.15s" }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 11V2M2.5 6L6.5 2l4 4" stroke={draft.trim() ? "#fff" : "var(--ink-3)"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
        <p style={{ fontSize: 9, color: "var(--ink-3)", textAlign: "center", marginTop: 6 }}>Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}

function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", marginBottom: 12 }}>
      {!isUser && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span className="fety-label" style={{ fontSize: 9, letterSpacing: "0.12em" }}>Assistant</span>
          <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--ink-3)" }}>{msg.time}</span>
        </div>
      )}
      {isUser && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 9, color: "var(--ink-3)" }}>{msg.time}</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: "var(--ink-2)" }}>You</span>
          <div style={{ width: 20, height: 20, borderRadius: "var(--radius-marker)", background: "var(--lavender)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, color: "var(--lav-dk)" }}>A</div>
        </div>
      )}
      <div style={{ maxWidth: "85%", background: isUser ? "var(--ink)" : "var(--paper)", color: isUser ? "#fff" : "var(--ink)", borderRadius: isUser ? "12px 12px 4px 12px" : "12px 12px 12px 4px", padding: "10px 12px", fontSize: 13, lineHeight: 1.55, border: isUser ? "none" : "1px solid var(--border)" }}>
        {msg.text}
      </div>
      {msg.tag && (
        <div style={{ marginTop: 4, fontSize: 9, fontWeight: 600, color: "var(--lime-dk)", background: "#E8F5EE", padding: "2px 8px", borderRadius: 99 }}>
          ✓ {msg.tag}
        </div>
      )}
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
function CalendarView({ onBack: _onBack }: { onBack: () => void }) {
  const [calView,   setCalView]   = useState<CalView>("monthly");
  const [focusDate, setFocusDate] = useState(new Date(2026, 8, 9));  // Sep 9 2026
  const [selected,  setSelected]  = useState<string | null>("2026-09-09");

  // helpers
  const fmt = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

  // navigate month
  const addMonth = (n: number) => setFocusDate(p => { const d = new Date(p); d.setMonth(d.getMonth() + n); return d; });
  const addWeek  = (n: number) => setFocusDate(p => { const d = new Date(p); d.setDate(d.getDate() + n * 7); return d; });
  const addDay   = (n: number) => setFocusDate(p => { const d = new Date(p); d.setDate(d.getDate() + n); return d; });

  const selectedDay = selected ? CAL_DATA.get(selected) : null;

  const VIEWS: { id: CalView; label: string }[] = [
    { id: "monthly",   label: "Monthly"   },
    { id: "weekly",    label: "Weekly"    },
    { id: "biweekly",  label: "Bi-Weekly" },
    { id: "daily",     label: "Daily"     },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, width: 0, height: "100%", overflow: "hidden" }}>
      {/* Calendar top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 24px", borderBottom: "1px solid var(--border)", background: "var(--surface)", flexShrink: 0, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.3px" }}>Financial Calendar</h2>

        <div style={{ flex: 1 }}/>

        {/* View switcher */}
        <div style={{ display: "inline-flex", background: "var(--bg)", borderRadius: 99, padding: 3, border: "1px solid var(--border)", gap: 2 }}>
          {VIEWS.map(v => (
            <button key={v.id} onClick={() => setCalView(v.id)} style={{ padding: "5px 14px", borderRadius: 99, fontSize: 11.5, fontWeight: 500, border: "none", cursor: "pointer", transition: "all 0.15s", background: calView === v.id ? "var(--ink)" : "transparent", color: calView === v.id ? "#fff" : "var(--ink-2)" }}>
              {v.label}
            </button>
          ))}
        </div>

        {/* Nav arrows */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button onClick={() => calView === "daily" ? addDay(-1) : calView === "monthly" || calView === "biweekly" ? addMonth(-1) : addWeek(-1)} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M8 2.5L5 6.5L8 10.5" stroke="#5A5A55" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", minWidth: 140, textAlign: "center" }}>
            {calView === "daily"
              ? focusDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
              : calView === "weekly"
              ? (() => {
                  const mon = new Date(focusDate); mon.setDate(focusDate.getDate() - focusDate.getDay() + 1);
                  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
                  return `${mon.toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${sun.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`;
                })()
              : calView === "biweekly"
              ? (() => {
                  const mon = new Date(focusDate); mon.setDate(focusDate.getDate() - focusDate.getDay() + 1);
                  const end = new Date(mon); end.setDate(mon.getDate() + 13);
                  return `${mon.toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${end.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`;
                })()
              : fmt(focusDate)}
          </span>
          <button onClick={() => calView === "daily" ? addDay(1) : calView === "monthly" || calView === "biweekly" ? addMonth(1) : addWeek(1)} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M5 2.5L8 6.5L5 10.5" stroke="#5A5A55" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>

      {/* Calendar body */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {calView === "monthly"  && <MonthlyCalGrid  month={focusDate} selected={selected} onSelect={setSelected} />}
          {calView === "weekly"   && <WeeklyCalGrid   anchor={focusDate} days={7}  selected={selected} onSelect={setSelected} />}
          {calView === "biweekly" && <WeeklyCalGrid   anchor={focusDate} days={14} selected={selected} onSelect={setSelected} />}
          {calView === "daily"    && <DailyCalView    date={focusDate} />}
        </div>

        {/* Day detail panel (monthly & weekly) */}
        {calView !== "daily" && selected && selectedDay && (
          <DayDetailPanel day={selectedDay} onClose={() => setSelected(null)} />
        )}
      </div>
    </div>
  );
}

// ─── Monthly Calendar Grid ─────────────────────────────────────────────────────
function MonthlyCalGrid({ month, selected, onSelect }: { month: Date; selected: string | null; onSelect: (k: string) => void }) {
  const y = month.getFullYear(), m = month.getMonth();
  const firstDay = new Date(y, m, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d));

  const today = new Date(2026, 8, 9);

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
          const data = CAL_DATA.get(key);
          const isSelected = selected === key;
          const isToday    = date.toDateString() === today.toDateString();
          const hasItems   = (data?.items.length ?? 0) > 0;
          const netPositive = (data?.endBal ?? 0) >= (data?.startBal ?? 0);
          const hasBill    = data?.items.some(i => i.type === "bill") ?? false;
          const hasPayday  = data?.items.some(i => i.type === "paycheck") ?? false;

          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              style={{
                borderRadius: 10, padding: "7px 6px",
                border: isSelected ? "2px solid var(--ink)" : "1px solid var(--border)",
                background: isSelected ? "var(--ink)" : isToday ? "#F0F7F0" : "var(--surface)",
                cursor: "pointer", textAlign: "left", minHeight: 82,
                display: "flex", flexDirection: "column", gap: 3,
                transition: "all 0.12s",
              }}
            >
              {/* Date number */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: isSelected ? "#fff" : isToday ? "var(--lime-dk)" : "var(--ink)", lineHeight: 1 }}>
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
                    Start <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: isSelected ? "rgba(255,255,255,0.85)" : "var(--ink-2)" }}>{usd(data.startBal)}</span>
                  </div>
                  <div style={{ fontSize: 9, color: isSelected ? "rgba(255,255,255,0.6)" : "var(--ink-3)" }}>
                    End <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: isSelected ? "#fff" : netPositive ? "var(--clear-dk)" : "var(--trouble-dk)" }}>{usd(data.endBal)}</span>
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
      </div>
    </div>
  );
}

// ─── Weekly / Bi-Weekly Grid ───────────────────────────────────────────────────
function WeeklyCalGrid({ anchor, days, selected, onSelect }: { anchor: Date; days: number; selected: string | null; onSelect: (k: string) => void }) {
  // Start from Monday of anchor's week
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7));

  const cols: Date[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    cols.push(d);
  }

  const today = new Date(2026, 8, 9);
  const isBiweekly = days === 14;

  // For bi-weekly, split into two rows of 7
  const rows: Date[][] = isBiweekly
    ? [cols.slice(0, 7), cols.slice(7, 14)]
    : [cols];

  const DayCell = (date: Date) => {
    const key  = CAL_KEY(date);
    const data = CAL_DATA.get(key);
    const isSelected  = selected === key;
    const isToday     = date.toDateString() === today.toDateString();
    const netPositive = (data?.endBal ?? 0) >= (data?.startBal ?? 0);
    return (
      <button key={key} onClick={() => onSelect(key)} style={{ background: isSelected ? "var(--ink)" : isToday ? "#F0F7F0" : "var(--surface)", border: isSelected ? "2px solid var(--ink)" : "1px solid var(--border)", borderRadius: 12, padding: "12px 10px", cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: 8 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 600, color: isSelected ? "rgba(255,255,255,0.6)" : "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.16em" }}>{DAYS_SHORT[date.getDay()]}</p>
          <p style={{ fontSize: 18, fontWeight: 400, color: isSelected ? "#fff" : isToday ? "var(--lime-dk)" : "var(--ink)", letterSpacing: "-0.5px", lineHeight: 1.1 }}>{date.getDate()}</p>
        </div>
        {data ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 3, borderTop: `1px solid ${isSelected ? "rgba(255,255,255,0.15)" : "var(--border)"}`, paddingTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 9, color: isSelected ? "rgba(255,255,255,0.55)" : "var(--ink-3)" }}>Open</span>
              <span style={{ fontSize: 10, fontWeight: 600, fontFamily: "var(--font-mono)", color: isSelected ? "rgba(255,255,255,0.8)" : "var(--ink-2)" }}>{usd(data.startBal)}</span>
            </div>
            {data.income > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 9, color: isSelected ? "rgba(255,255,255,0.55)" : "var(--ink-3)" }}>In</span>
                <span style={{ fontSize: 10, fontWeight: 600, fontFamily: "var(--font-mono)", color: isSelected ? "var(--clear)" : "var(--clear-dk)" }}>+{usd(data.income)}</span>
              </div>
            )}
            {data.expenses < 0 && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 9, color: isSelected ? "rgba(255,255,255,0.55)" : "var(--ink-3)" }}>Out</span>
                <span style={{ fontSize: 10, fontWeight: 600, fontFamily: "var(--font-mono)", color: isSelected ? "var(--trouble)" : "var(--trouble-dk)" }}>-{usd(data.expenses)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${isSelected ? "rgba(255,255,255,0.12)" : "var(--border)"}`, paddingTop: 3 }}>
              <span style={{ fontSize: 9, fontWeight: 600, color: isSelected ? "rgba(255,255,255,0.7)" : "var(--ink-2)" }}>Close</span>
              <span style={{ fontSize: 10, fontWeight: 400, fontFamily: "var(--font-mono)", color: isSelected ? "#fff" : netPositive ? "var(--clear-dk)" : "var(--trouble-dk)" }}>{usd(data.endBal)}</span>
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
function DailyCalView({ date }: { date: Date }) {
  const key  = CAL_KEY(date);
  const data = CAL_DATA.get(key);

  const net = data ? data.endBal - data.startBal : 0;

  return (
    <div style={{ maxWidth: 680, width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Balance sheet hero */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {[
          { label: "Opening Balance", value: data ? usd(data.startBal) : "—", color: "var(--sky)", textColor: "#1050A0" },
          { label: "Closing Balance", value: data ? usd(data.endBal)   : "—", color: net >= 0 ? "var(--lime)" : "var(--peach)", textColor: net >= 0 ? "var(--lime-dk)" : "var(--trouble-dk)" },
          { label: "Net Cash Flow",   value: data ? `${net >= 0 ? "+" : ""}${usd(net)}` : "—", color: "var(--lavender)", textColor: "var(--lav-dk)" },
        ].map(card => (
          <div key={card.label} style={{ background: card.color, borderRadius: 16, padding: "18px 20px" }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.5)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.16em" }}>{card.label}</p>
            <p style={{ fontSize: 24, fontWeight: 400, color: card.textColor, letterSpacing: "-0.8px", fontFamily: "var(--font-mono)" }}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Income / Expenses sub-totals */}
      {data && (data.income > 0 || data.expenses < 0) && (
        <div style={{ display: "flex", gap: 10 }}>
          {data.income > 0 && (
            <div style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-2)" }}>Total In</span>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--clear-dk)", fontSize: 16 }}>+{usd(data.income)}</span>
            </div>
          )}
          {data.expenses < 0 && (
            <div style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-2)" }}>Total Out</span>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--trouble-dk)", fontSize: 16 }}>-{usd(data.expenses)}</span>
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
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 13, color: item.amount >= 0 ? "var(--clear-dk)" : item.type === "bill" ? "var(--trouble-dk)" : "var(--trouble-dk)" }}>
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
            <span>Open · {usd(data.startBal)}</span>
            <span>Close · {usd(data.endBal)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Day Detail Panel (sidebar for monthly/weekly clicks) ─────────────────────
function DayDetailPanel({ day, onClose }: { day: CalDay; onClose: () => void }) {
  const net = day.endBal - day.startBal;
  return (
    <div style={{ width: 260, flexShrink: 0, borderLeft: "1px solid var(--border)", background: "var(--surface)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>
          {day.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
        </p>
        <button onClick={onClose} style={{ width: 22, height: 22, borderRadius: 6, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2l6 6M8 2l-6 6" stroke="var(--ink-3)" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "14px" }}>
        {/* Mini balance sheet */}
        <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
          <p style={{ fontSize: 10, fontWeight: 400, color: "var(--ink-3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Balance Sheet</p>
          {[
            { label: "Opening",    value: usd(day.startBal), color: "var(--ink)"                                 },
            { label: "Income",     value: day.income > 0   ? `+${usd(day.income)}` : "—",   color: "var(--clear-dk)"    },
            { label: "Expenses",   value: day.expenses < 0 ? `-${usd(day.expenses)}`  : "—", color: "var(--trouble-dk)"   },
            { label: "Closing",    value: usd(day.endBal),   color: net >= 0 ? "var(--clear-dk)" : "var(--trouble-dk)"            },
          ].map((r, i) => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: i > 0 ? 7 : 0, paddingBottom: 7, borderTop: i > 0 ? "1px solid var(--border)" : undefined, borderBottom: i === 3 ? undefined : undefined }}>
              <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{r.label}</span>
              <span style={{ fontSize: 12, fontWeight: 600, fontFamily: "var(--font-mono)", color: r.color }}>{r.value}</span>
            </div>
          ))}
        </div>

        {/* Net pill */}
        <div style={{ background: net >= 0 ? "var(--lime)" : "var(--peach)", borderRadius: 10, padding: "10px 14px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.6)" }}>Net</span>
          <span style={{ fontSize: 14, fontWeight: 400, fontFamily: "var(--font-mono)", color: net >= 0 ? "var(--lime-dk)" : "var(--trouble-dk)" }}>{net >= 0 ? "+" : ""}{usd(net)}</span>
        </div>

        {/* Transactions */}
        {day.items.length > 0 ? (
          <>
            <p style={{ fontSize: 10, fontWeight: 400, color: "var(--ink-3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Transactions</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {day.items.map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 11px" }}>
                  <span style={{ fontSize: 15 }}>{item.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.desc}</p>
                    <p style={{ fontSize: 9, color: "var(--ink-3)", textTransform: "capitalize" }}>{item.type}</p>
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 11, color: item.amount >= 0 ? "var(--clear-dk)" : "var(--trouble-dk)", flexShrink: 0 }}>
                    {item.amount >= 0 ? "+" : ""}{usdF(item.amount)}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p style={{ fontSize: 11, color: "var(--ink-3)", textAlign: "center", padding: "16px 0" }}>No transactions</p>
        )}
      </div>
    </div>
  );
}

// ─── Dashboard (widget dock) ────────────────────────────────────────────────────
function DashboardView({
  pinned, setPinned, onCustomize, customizing,
}: {
  pinned: string[];
  setPinned: React.Dispatch<React.SetStateAction<string[]>>;
  onCustomize: () => void;
  customizing: boolean;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const toggleWidget = (id: string) => {
    setPinned(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const reorder = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setPinned(prev => {
      const arr = [...prev];
      const fi = arr.indexOf(fromId);
      const ti = arr.indexOf(toId);
      if (fi === -1 || ti === -1) return arr;
      arr.splice(fi, 1);
      arr.splice(ti, 0, fromId);
      return arr;
    });
  };

  const widgets = ALL_WIDGETS.filter(w => pinned.includes(w.id)).sort(
    (a, b) => pinned.indexOf(a.id) - pinned.indexOf(b.id)
  );

  // Grid spans per size in a 6-column grid
  const colSpan = (size: WidgetDef["size"]) =>
    size === "full" ? "span 6" : size === "half" ? "span 3" : "span 2";

  const minH = (size: WidgetDef["size"]) =>
    size === "small" ? 80 : size === "half" ? 160 : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Widget grid */}
      {widgets.length === 0 ? (
        <button
          onClick={onCustomize}
          style={{ width: "100%", padding: "48px 0", borderRadius: "var(--radius-card)", border: "2px dashed var(--border)", background: "transparent", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}
        >
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M14 4v20M4 14h20" stroke="var(--ink-3)" strokeWidth="2.2" strokeLinecap="round"/></svg>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-3)" }}>Add widgets to your dashboard</p>
          <p style={{ fontSize: 12, color: "var(--ink-3)" }}>Click Customize to choose what you want to see</p>
        </button>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12 }}>
          {widgets.map(w => {
            const isDragging = dragId === w.id;
            const isOver = overId === w.id && dragId !== w.id;
            return (
              <div
                key={w.id}
                draggable={customizing}
                onDragStart={e => { if (!customizing) return; setDragId(w.id); e.dataTransfer.effectAllowed = "move"; }}
                onDragEnd={() => { setDragId(null); setOverId(null); }}
                onDragOver={e => { if (!customizing) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; setOverId(w.id); }}
                onDragLeave={() => setOverId(null)}
                onDrop={e => { if (!customizing) return; e.preventDefault(); if (dragId) reorder(dragId, w.id); setDragId(null); setOverId(null); }}
                style={{
                  gridColumn: colSpan(w.size),
                  background: w.color === "var(--surface)" ? "var(--surface)" : w.color,
                  borderRadius: "var(--radius-card)",
                  padding: w.size === "small" ? "14px 16px" : "20px 22px",
                  border: isOver ? "2px solid var(--ink)" : w.color === "var(--surface)" ? "1px solid var(--border)" : "2px solid transparent",
                  position: "relative",
                  minHeight: minH(w.size),
                  opacity: isDragging ? 0.4 : 1,
                  cursor: customizing ? "grab" : "default",
                  transition: "opacity 0.15s, border-color 0.12s",
                  userSelect: "none",
                }}
              >
                {/* Drag handle hint — only visible in customize mode */}
                {customizing && (
                  <div style={{ position: "absolute", top: 8, left: 10, opacity: 0.25, pointerEvents: "none" }}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="3" cy="2.5" r="1" fill="currentColor"/><circle cx="7" cy="2.5" r="1" fill="currentColor"/><circle cx="3" cy="5" r="1" fill="currentColor"/><circle cx="7" cy="5" r="1" fill="currentColor"/><circle cx="3" cy="7.5" r="1" fill="currentColor"/><circle cx="7" cy="7.5" r="1" fill="currentColor"/></svg>
                  </div>
                )}
                {w.render()}
                {/* Remove button */}
                <button
                  onClick={e => { e.stopPropagation(); toggleWidget(w.id); }}
                  title="Remove widget"
                  style={{ position: "absolute", top: 8, right: 8, width: 22, height: 22, borderRadius: 99, background: "rgba(0,0,0,0.1)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                  onMouseLeave={e => (e.currentTarget.style.opacity = "0")}
                >
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 1l6 6M7 1L1 7" stroke="rgba(0,0,0,0.55)" strokeWidth="1.4" strokeLinecap="round"/></svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BudgetView({ viewMode }: { viewMode: ViewMode }) {
  const totalBudget = budgetCategories.reduce((s, c) => s + c.budget, 0);
  const totalSpent  = budgetCategories.reduce((s, c) => s + c.spent, 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {[
          { label: "Monthly Budget", value: usd(totalBudget), color: "var(--ink-3)" },
          { label: "Spent So Far",   value: usd(totalSpent),  color: "var(--trouble-dk)"      },
          { label: "Remaining",      value: usd(totalBudget - totalSpent), color: "var(--clear-dk)" },
        ].map(s => (
          <div key={s.label} style={{ background: "var(--surface)", borderRadius: 14, padding: "16px 18px", border: "1px solid var(--border)", textAlign: "center" }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: 6 }}>{s.label}</p>
            <p style={{ fontSize: 22, fontWeight: 600, color: s.color, fontFamily: "var(--font-mono)" }}>{s.value}</p>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: viewMode === "cards" ? "repeat(auto-fill, minmax(220px, 1fr))" : "1fr", gap: 10 }}>
        {budgetCategories.map(c => {
          const pct = Math.min((c.spent / c.budget) * 100, 100);
          const over = c.spent > c.budget;
          const barColor = over ? "var(--trouble-dk)" : pct > 80 ? "#D97706" : "var(--clear-dk)";
          return (
            <div key={c.name} style={{ background: "var(--surface)", borderRadius: 14, padding: viewMode === "list" ? "12px 18px" : "18px 20px", border: "1px solid var(--border)", display: viewMode === "list" ? "flex" : "block", alignItems: "center", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: viewMode === "list" ? 0 : 12, flex: viewMode === "list" ? "0 0 180px" : undefined }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: c.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{c.icon}</div>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{c.name}</span>
                  {over && <span style={{ marginLeft: 8, fontSize: 9, fontWeight: 600, color: "var(--trouble-dk)", background: "#FFECE8", padding: "2px 6px", borderRadius: 99 }}>Over</span>}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink-3)", marginBottom: 6 }}>
                  <span>{usd(c.spent)}</span><span>{usd(c.budget)}</span>
                </div>
                <div style={{ height: 5, background: "var(--paper)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 99 }}/>
                </div>
                <p style={{ fontSize: 10, color: over ? "var(--trouble-dk)" : "var(--ink-3)", marginTop: 4 }}>{over ? `${usd(c.spent - c.budget)} over` : `${usd(c.budget - c.spent)} left`}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SpendingView({ transactions, viewMode }: { transactions: typeof INIT_TRANSACTIONS; viewMode: ViewMode }) {
  const [filter, setFilter] = useState("All");
  const shown = filter === "All" ? transactions : transactions.filter(t => t.type === filter.toLowerCase());
  const byDate: Record<string, typeof INIT_TRANSACTIONS> = {};
  shown.forEach(t => { (byDate[t.date] ||= []).push(t); });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {["All","Income","Expense","Transfer"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "6px 14px", borderRadius: 99, fontSize: 12, fontWeight: 500, border: "1px solid var(--border)", cursor: "pointer", background: filter === f ? "var(--ink)" : "var(--surface)", color: filter === f ? "#fff" : "var(--ink-2)", transition: "all 0.14s" }}>{f}</button>
        ))}
      </div>
      <div style={{ background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)", overflow: "hidden" }}>
        {Object.entries(byDate).map(([date, txns], gi) => (
          <div key={date}>
            <div style={{ padding: "9px 18px", background: "var(--bg)", borderTop: gi > 0 ? "1px solid var(--border)" : undefined }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.16em" }}>{date}</span>
            </div>
            {txns.map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", padding: "12px 18px", borderTop: "1px solid var(--border)", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 11, background: t.type === "income" ? "#E8F5EE" : t.type === "transfer" ? "#F0EBFF" : "#FFECE8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{t.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.desc}</p>
                  <p style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 1 }}>{t.category}</p>
                </div>
                <div style={{ padding: "4px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600, fontFamily: "var(--font-mono)", flexShrink: 0, background: t.type === "income" ? "#E8F5EE" : t.type === "transfer" ? "#F0EBFF" : "#FFECE8", color: t.type === "income" ? "var(--clear-dk)" : t.type === "transfer" ? "var(--later-dk)" : "var(--trouble-dk)" }}>
                  {t.type === "income" ? "+" : ""}{usdF(t.amount)}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function GoalsView({ viewMode }: { viewMode: ViewMode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: viewMode === "cards" ? "repeat(auto-fill, minmax(240px, 1fr))" : "1fr", gap: 12 }}>
        {goals.map(g => {
          const pct = Math.round((g.saved / g.target) * 100);
          const status = pct >= 70 ? "Ahead" : pct >= 40 ? "On Track" : "Behind";
          const sColor = pct >= 70 ? "var(--clear-dk)" : pct >= 40 ? "#7A5010" : "var(--trouble-dk)";
          const sBg    = pct >= 70 ? "#E8F5EE" : pct >= 40 ? "#FFF4DC"  : "#FFECE8";
          return (
            <div key={g.name} style={{ background: "var(--surface)", borderRadius: 16, padding: "20px 22px", border: "1px solid var(--border)", display: "flex", flexDirection: viewMode === "list" ? "row" : "column", gap: viewMode === "list" ? 20 : 14, alignItems: viewMode === "list" ? "center" : "stretch" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flex: viewMode === "list" ? "0 0 220px" : undefined }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: g.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{g.icon}</div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{g.name}</p>
                  <p style={{ fontSize: 10, color: "var(--ink-3)" }}>By {g.date}</p>
                </div>
                <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 600, color: sColor, background: sBg, padding: "3px 10px", borderRadius: 99, flexShrink: 0 }}>{status}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--ink)", fontSize: 18 }}>{usd(g.saved)}</span>
                  <span style={{ color: "var(--ink-3)", fontSize: 11, alignSelf: "flex-end" }}>of {usd(g.target)}</span>
                </div>
                <div style={{ height: 7, background: "var(--paper)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: g.color, borderRadius: 99 }}/>
                </div>
                <p style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 5 }}>{pct}% · {usd(g.target - g.saved)} to go</p>
              </div>
            </div>
          );
        })}
        <button style={{ background: "transparent", borderRadius: 16, padding: "20px", border: "2px dashed var(--border)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", minHeight: 120 }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M11 4v14M4 11h14" stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round"/></svg>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-3)" }}>Add a Goal</p>
        </button>
      </div>
    </div>
  );
}

function SettingsView() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
      <div style={{ background: "var(--ink)", borderRadius: 20, padding: "24px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
        <div>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>Current Plan</p>
          <p style={{ fontSize: 26, fontWeight: 400, color: "#fff", letterSpacing: "-0.5px" }}>Free</p>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 3 }}>Upgrade for AI insights, unlimited accounts & more.</p>
        </div>
        <button style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: "var(--radius-ctrl)", padding: "11px 22px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Upgrade to Premium</button>
      </div>
      {[
        { title: "Accounts", items: [
          { label: "Chase Checking", sub: "Checking",    val: "$3,278", icon: "🏦" },
          { label: "Marcus Savings", sub: "Savings",     val: "$8,420", icon: "💰" },
          { label: "Visa Platinum",  sub: "Credit Card", val: "-$614",  icon: "💳" },
        ]},
        { title: "Profile", items: [
          { label: "Name",     sub: "Display name", val: "Alex Johnson",     icon: "👤" },
          { label: "Email",    sub: "Login",        val: "alex@example.com", icon: "✉️" },
          { label: "Currency", sub: "Display",      val: "USD",              icon: "💱" },
        ]},
      ].map(section => (
        <div key={section.title} style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
          <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)" }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{section.title}</p>
          </div>
          {section.items.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", padding: "12px 18px", borderTop: i > 0 ? "1px solid var(--border)" : undefined, gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{item.icon}</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{item.label}</p>
                <p style={{ fontSize: 10, color: "var(--ink-3)" }}>{item.sub}</p>
              </div>
              <span style={{ fontSize: 12, color: "var(--ink-2)", fontFamily: "var(--font-mono)" }}>{item.val}</span>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5.5 3.5L9 7l-3.5 3.5" stroke="var(--ink-3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Page Header ───────────────────────────────────────────────────────────────
const PAGE_META: Record<Page, { title: string; sub: string }> = {
  dashboard: { title: "Dashboard",           sub: "Know what you can spend today, this week, and this month." },
  spending:  { title: "Transactions",        sub: "Every dollar in and out of your accounts."               },
  budget:    { title: "Budget",              sub: "Tracks are ink; coral marks the category that's over."   },
  goals:     { title: "Goals",               sub: "Money you're holding for later."                         },
  settings:  { title: "Settings",            sub: "Accounts, categories, and preferences."                    },
  calendar:  { title: "Calendar",            sub: "Cash flow and spending power, day by day."               },
};

// ─── App Root ──────────────────────────────────────────────────────────────────
export default function App() {
  const [page,          setPage]          = useState<Page>("dashboard");
  const [viewMode,      setViewMode]      = useState<ViewMode>("cards");
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [messages,      setMessages]      = useState<ChatMessage[]>(SEED_MESSAGES);
  const [transactions,  setTransactions]  = useState(INIT_TRANSACTIONS);
  const [pinned,        setPinned]        = useState<string[]>(DEFAULT_PINNED);
  const [pickerOpen,    setPickerOpen]    = useState(false);

  const handleSend = useCallback((text: string) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    setMessages(prev => [...prev, { id: Date.now(), role: "user", text, time: timeStr }]);
    const amountMatch = text.match(/\$?([\d,]+(?:\.\d{1,2})?)/);
    if (amountMatch && /spent|paid|bought|grabbed/i.test(text)) {
      const amount = -parseFloat(amountMatch[1].replace(",", ""));
      setTransactions(prev => [{ date: "Today", desc: text.slice(0, 40), category: "Other", amount, type: "expense", icon: "💬" }, ...prev]);
    }
    setTimeout(() => setMessages(prev => [...prev, getAutoReply(text)]), 700);
  }, []);

  const renderView = () => {
    if (page === "calendar") return null;
    switch (page) {
      case "budget":    return <BudgetView   viewMode={viewMode} />;
      case "spending":  return <SpendingView transactions={transactions} viewMode={viewMode} />;
      case "goals":     return <GoalsView    viewMode={viewMode} />;
      case "settings":  return <SettingsView />;
      default:          return <DashboardView pinned={pinned} setPinned={setPinned} onCustomize={() => setPickerOpen(p => !p)} customizing={pickerOpen} />;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg)" }}>
      <TopNav page={page} setPage={setPage} />

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Chat panel or collapsed rail — always visible */}
        {chatCollapsed ? (
            /* Slim rail — sits flush on the left, click anywhere to expand */
            <div
              title="Show chat"
              onClick={() => setChatCollapsed(false)}
              style={{
                width: 32, flexShrink: 0, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "flex-start", paddingTop: 14,
                background: "var(--surface)", borderRight: "1px solid var(--border)",
                cursor: "pointer", transition: "background 0.14s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--paper)")}
              onMouseLeave={e => (e.currentTarget.style.background = "var(--surface)")}
            >
              <div style={{ width: 22, height: 22, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path d="M4 2.5L7 5.5L4 8.5" stroke="var(--ink-3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          ) : (
            <ChatPanel messages={messages} onSend={handleSend} onCollapse={() => setChatCollapsed(true)} />
          )}

        {/* Main area */}
        {page === "calendar" ? (
          <CalendarView onBack={() => setPage("dashboard")} />
        ) : (
          <>
            <main style={{ flex: 1, overflowY: "auto", padding: "24px 24px 48px", minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>{PAGE_META[page].title}</h1>
                  <p style={{ fontSize: 15, color: "var(--ink-2)", marginTop: 4, lineHeight: 1.45 }}>{PAGE_META[page].sub}</p>
                </div>
                {page === "dashboard" && (
                  <button
                    onClick={() => setPickerOpen(p => !p)}
                    style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 99, border: "1px solid var(--border)", background: pickerOpen ? "var(--ink)" : "var(--surface)", color: pickerOpen ? "#fff" : "var(--ink-2)", cursor: "pointer", fontSize: 12, fontWeight: 600, transition: "all 0.13s", flexShrink: 0, marginTop: 2 }}
                  >
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="2" stroke="currentColor" strokeWidth="1.3"/><path d="M6.5 1v1.5M6.5 10.5V12M1 6.5h1.5M10.5 6.5H12M2.8 2.8l1.06 1.06M9.14 9.14l1.06 1.06M2.8 10.2l1.06-1.06M9.14 3.86l1.06-1.06" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                    Customize
                  </button>
                )}
              </div>
              {renderView()}
            </main>
            {page === "dashboard" && pickerOpen && (
              <WidgetPicker
                pinned={pinned}
                onToggle={id => setPinned(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])}
                onClose={() => setPickerOpen(false)}
              />
            )}
          </>
        )}

      </div>
    </div>
  );
}
