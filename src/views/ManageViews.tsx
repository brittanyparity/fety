import { useState } from "react";
import type { Bill, BudgetCategory, CategoryWithSpent, Goal, Transaction, TransactionType } from "../types/fety";
import { formatDisplayDate, todayISO } from "../lib/fetyCalculations";

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Math.abs(n));
const usdF = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n));

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: "var(--radius-ctrl)",
  border: "1px solid var(--border)",
  fontSize: 13,
  fontFamily: "inherit",
  background: "var(--surface)",
};

type ViewMode = "cards" | "list";

export function BudgetManageView({
  categories,
  bills,
  viewMode,
  onUpdateBudget,
  onAddBill,
  onDeleteBill,
}: {
  categories: CategoryWithSpent[];
  bills: Bill[];
  viewMode: ViewMode;
  onUpdateBudget: (id: string, monthlyBudget: number) => void;
  onAddBill: (bill: Omit<Bill, "id">) => void;
  onDeleteBill: (id: string) => void;
}) {
  const [billName, setBillName] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billDue, setBillDue] = useState("1");
  const [billCategory, setBillCategory] = useState("Bills");

  const totalBudget = categories.reduce((s, c) => s + c.monthlyBudget, 0);
  const totalSpent = categories.reduce((s, c) => s + c.spent, 0);

  const submitBill = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(billAmount);
    if (!billName.trim() || !Number.isFinite(amount)) return;
    onAddBill({
      name: billName.trim(),
      amount,
      dueDay: Math.min(31, Math.max(1, parseInt(billDue, 10) || 1)),
      category: billCategory,
      icon: "📄",
    });
    setBillName("");
    setBillAmount("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {[
          { label: "Monthly budget", value: usd(totalBudget) },
          { label: "Spent so far", value: usd(totalSpent) },
          { label: "Remaining", value: usd(totalBudget - totalSpent) },
        ].map((s) => (
          <div key={s.label} style={{ background: "var(--surface)", borderRadius: 14, padding: "16px 18px", border: "1px solid var(--border)", textAlign: "center" }}>
            <p className="fety-label" style={{ marginBottom: 6 }}>{s.label}</p>
            <p style={{ fontSize: 22, fontWeight: 400, color: "var(--ink)" }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: viewMode === "cards" ? "repeat(auto-fill, minmax(220px, 1fr))" : "1fr", gap: 10 }}>
        {categories.map((c) => {
          const pct = c.monthlyBudget > 0 ? Math.min((c.spent / c.monthlyBudget) * 100, 100) : 0;
          const over = c.spent > c.monthlyBudget;
          return (
            <div key={c.id} style={{ background: "var(--surface)", borderRadius: 14, padding: "16px 18px", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 18 }}>{c.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</span>
                {over && <span style={{ fontSize: 9, color: "var(--trouble-dk)", background: "#FFECE8", padding: "2px 6px", borderRadius: 99 }}>Over</span>}
              </div>
              <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Monthly cap</label>
              <input
                type="number"
                min={0}
                step={1}
                value={c.monthlyBudget}
                onChange={(e) => onUpdateBudget(c.id, parseFloat(e.target.value) || 0)}
                style={inputStyle}
              />
              <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 8 }}>
                Spent {usd(c.spent)} · {over ? `${usd(c.spent - c.monthlyBudget)} over` : `${usd(c.monthlyBudget - c.spent)} left`}
              </p>
              <div style={{ height: 5, background: "var(--paper)", borderRadius: 99, marginTop: 6, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: over ? "var(--trouble-dk)" : pct > 80 ? "var(--amber-dk)" : "var(--ink)" }} />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px" }}>
        <p className="fety-label-strong" style={{ marginBottom: 12 }}>Bills</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {bills.map((b) => (
            <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--border-soft)" }}>
              <span>{b.icon}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 600 }}>{b.name}</p>
                <p style={{ fontSize: 10, color: "var(--ink-3)" }}>Due day {b.dueDay} · {b.category}</p>
              </div>
              <span style={{ fontSize: 14 }}>{usd(b.amount)}</span>
              <button type="button" onClick={() => onDeleteBill(b.id)} style={{ border: "none", background: "transparent", color: "var(--ink-3)", cursor: "pointer", fontSize: 11 }}>Remove</button>
            </div>
          ))}
        </div>
        <form onSubmit={submitBill} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 80px 1fr auto", gap: 8, alignItems: "end" }}>
          <div>
            <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Bill name</label>
            <input value={billName} onChange={(e) => setBillName(e.target.value)} style={inputStyle} placeholder="Electric" />
          </div>
          <div>
            <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Amount</label>
            <input value={billAmount} onChange={(e) => setBillAmount(e.target.value)} style={inputStyle} placeholder="142" />
          </div>
          <div>
            <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Due day</label>
            <input value={billDue} onChange={(e) => setBillDue(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Category</label>
            <input value={billCategory} onChange={(e) => setBillCategory(e.target.value)} style={inputStyle} />
          </div>
          <button type="submit" style={{ padding: "8px 14px", borderRadius: "var(--radius-ctrl)", border: "none", background: "var(--ink)", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Add bill</button>
        </form>
      </div>
    </div>
  );
}

export function TransactionsManageView({
  transactions,
  categories,
  viewMode,
  onAdd,
  onDelete,
}: {
  transactions: Transaction[];
  categories: BudgetCategory[];
  viewMode: ViewMode;
  onAdd: (input: { desc: string; amount: number; type: TransactionType; category: string; dateISO?: string; icon?: string }) => void;
  onDelete: (id: string) => void;
}) {
  const [filter, setFilter] = useState("All");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<TransactionType>("expense");
  const [category, setCategory] = useState(categories[0]?.name ?? "Other");
  const [dateISO, setDateISO] = useState(todayISO());

  const shown =
    filter === "All" ? transactions : transactions.filter((t) => t.type === filter.toLowerCase());
  const byDate: Record<string, Transaction[]> = {};
  shown.forEach((t) => {
    const label = formatDisplayDate(t.dateISO);
    (byDate[label] ||= []).push(t);
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseFloat(amount);
    if (!desc.trim() || !Number.isFinite(n)) return;
    onAdd({ desc: desc.trim(), amount: n, type, category, dateISO });
    setDesc("");
    setAmount("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <form onSubmit={submit} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, alignItems: "end" }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <p className="fety-label-strong" style={{ marginBottom: 8 }}>Add transaction</p>
        </div>
        <div>
          <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Description</label>
          <input value={desc} onChange={(e) => setDesc(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Amount</label>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} style={inputStyle} type="number" step="0.01" />
        </div>
        <div>
          <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as TransactionType)} style={inputStyle}>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
            <option value="transfer">Transfer</option>
            <option value="bill">Bill</option>
          </select>
        </div>
        <div>
          <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
            {[...categories.map((c) => c.name), "Income", "Savings", "Other"].filter((v, i, a) => a.indexOf(v) === i).map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Date</label>
          <input type="date" value={dateISO} onChange={(e) => setDateISO(e.target.value)} style={inputStyle} />
        </div>
        <button type="submit" style={{ padding: "8px 14px", borderRadius: "var(--radius-ctrl)", border: "none", background: "var(--ink)", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Save</button>
      </form>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {["All", "Income", "Expense", "Transfer", "Bill"].map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} style={{ padding: "6px 14px", borderRadius: 99, fontSize: 12, border: "1px solid var(--border)", cursor: "pointer", background: filter === f ? "var(--ink)" : "var(--surface)", color: filter === f ? "#fff" : "var(--ink-2)" }}>{f}</button>
        ))}
      </div>

      <div style={{ background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)", overflow: "hidden" }}>
        {Object.entries(byDate).map(([date, txns], gi) => (
          <div key={date}>
            <div style={{ padding: "9px 18px", background: "var(--bg)", borderTop: gi > 0 ? "1px solid var(--border)" : undefined }}>
              <span className="fety-label">{date}</span>
            </div>
            {txns.map((t) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", padding: "12px 18px", borderTop: "1px solid var(--border)", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 11, background: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{t.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{t.desc}</p>
                  <p style={{ fontSize: 10, color: "var(--ink-3)" }}>{t.category}</p>
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, color: t.amount >= 0 ? "var(--clear-dk)" : "var(--trouble-dk)" }}>
                  {t.amount >= 0 ? "+" : ""}{usdF(t.amount)}
                </span>
                <button type="button" onClick={() => onDelete(t.id)} style={{ border: "none", background: "transparent", color: "var(--ink-3)", cursor: "pointer", fontSize: 11 }}>Delete</button>
              </div>
            ))}
          </div>
        ))}
        {shown.length === 0 && <p style={{ padding: 24, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>No transactions yet.</p>}
      </div>
    </div>
  );
}

export function GoalsManageView({
  goals,
  viewMode,
  onAdd,
  onUpdate,
  onDelete,
}: {
  goals: Goal[];
  viewMode: ViewMode;
  onAdd: (goal: Omit<Goal, "id">) => void;
  onUpdate: (id: string, updates: Partial<Goal>) => void;
  onDelete: (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [saved, setSaved] = useState("0");
  const [targetDate, setTargetDate] = useState("");
  const [monthly, setMonthly] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = parseFloat(target);
    const s = parseFloat(saved);
    if (!name.trim() || !Number.isFinite(t)) return;
    onAdd({
      name: name.trim(),
      icon: "🎯",
      target: t,
      saved: Number.isFinite(s) ? s : 0,
      targetDate: targetDate || "TBD",
      monthlyContribution: parseFloat(monthly) || 0,
    });
    setName("");
    setTarget("");
    setSaved("0");
    setTargetDate("");
    setMonthly("");
    setShowForm(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: viewMode === "cards" ? "repeat(auto-fill, minmax(240px, 1fr))" : "1fr", gap: 12 }}>
        {goals.map((g) => {
          const pct = g.target > 0 ? Math.round((g.saved / g.target) * 100) : 0;
          return (
            <div key={g.id} style={{ background: "var(--surface)", borderRadius: 16, padding: "20px 22px", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 22 }}>{g.icon}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600 }}>{g.name}</p>
                  <p style={{ fontSize: 10, color: "var(--ink-3)" }}>Target {g.targetDate}</p>
                </div>
                <button type="button" onClick={() => onDelete(g.id)} style={{ border: "none", background: "transparent", color: "var(--ink-3)", cursor: "pointer", fontSize: 11 }}>Remove</button>
              </div>
              <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Saved amount</label>
              <input
                type="number"
                value={g.saved}
                onChange={(e) => onUpdate(g.id, { saved: parseFloat(e.target.value) || 0 })}
                style={{ ...inputStyle, marginBottom: 8 }}
              />
              <p style={{ fontSize: 12, color: "var(--ink-2)" }}>{pct}% of {usd(g.target)}</p>
              <div style={{ height: 6, background: "var(--paper)", borderRadius: 99, marginTop: 8, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: "var(--later)" }} />
              </div>
            </div>
          );
        })}
        <button type="button" onClick={() => setShowForm(true)} style={{ background: "transparent", borderRadius: 16, padding: "20px", border: "2px dashed var(--border)", cursor: "pointer", minHeight: 120 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-3)" }}>Add a goal</p>
        </button>
      </div>
      {showForm && (
        <form onSubmit={submit} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          <input placeholder="Goal name" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
          <input placeholder="Target $" value={target} onChange={(e) => setTarget(e.target.value)} style={inputStyle} type="number" />
          <input placeholder="Saved $" value={saved} onChange={(e) => setSaved(e.target.value)} style={inputStyle} type="number" />
          <input placeholder="Target date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} style={inputStyle} />
          <input placeholder="Monthly $" value={monthly} onChange={(e) => setMonthly(e.target.value)} style={inputStyle} type="number" />
          <button type="submit" style={{ padding: "8px 14px", border: "none", background: "var(--ink)", color: "#fff", borderRadius: "var(--radius-ctrl)", cursor: "pointer" }}>Create goal</button>
        </form>
      )}
    </div>
  );
}

export function SettingsManageView({
  profile,
  accounts,
  onUpdateProfile,
  onUpdateAccount,
  onReset,
}: {
  profile: { displayName: string; email: string; currency: string; startingBalance: number };
  accounts: { id: string; name: string; type: string; balance: number; icon: string }[];
  onUpdateProfile: (u: Partial<{ displayName: string; email: string; currency: string; startingBalance: number }>) => void;
  onUpdateAccount: (id: string, u: Partial<{ name: string; type: string; balance: number }>) => void;
  onReset: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
      <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", padding: "18px 20px" }}>
        <p className="fety-label-strong" style={{ marginBottom: 12 }}>Profile</p>
        {[
          { key: "displayName" as const, label: "Display name" },
          { key: "email" as const, label: "Email" },
          { key: "currency" as const, label: "Currency" },
        ].map((f) => (
          <div key={f.key} style={{ marginBottom: 10 }}>
            <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>{f.label}</label>
            <input
              value={profile[f.key]}
              onChange={(e) => onUpdateProfile({ [f.key]: e.target.value })}
              style={inputStyle}
            />
          </div>
        ))}
        <div>
          <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Starting balance (baseline)</label>
          <input
            type="number"
            value={profile.startingBalance}
            onChange={(e) => onUpdateProfile({ startingBalance: parseFloat(e.target.value) || 0 })}
            style={inputStyle}
          />
        </div>
      </div>

      <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
        <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)" }}>
          <p className="fety-label-strong">Accounts</p>
        </div>
        {accounts.map((a, i) => (
          <div key={a.id} style={{ padding: "12px 18px", borderTop: i > 0 ? "1px solid var(--border)" : undefined, display: "grid", gridTemplateColumns: "1fr 1fr 100px", gap: 8 }}>
            <input value={a.name} onChange={(e) => onUpdateAccount(a.id, { name: e.target.value })} style={inputStyle} />
            <input value={a.type} onChange={(e) => onUpdateAccount(a.id, { type: e.target.value })} style={inputStyle} />
            <input type="number" value={a.balance} onChange={(e) => onUpdateAccount(a.id, { balance: parseFloat(e.target.value) || 0 })} style={inputStyle} />
          </div>
        ))}
      </div>

      <button type="button" onClick={() => { if (confirm("Reset all local data to defaults?")) onReset(); }} style={{ padding: "10px 16px", borderRadius: "var(--radius-ctrl)", border: "1px solid var(--trouble-dk)", background: "transparent", color: "var(--trouble-dk)", cursor: "pointer", fontWeight: 600 }}>
        Reset local data
      </button>
    </div>
  );
}
