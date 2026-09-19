import { useEffect, useMemo, useState } from "react";
import type {
  Account,
  Bill,
  BillFrequency,
  BudgetCategory,
  CategoryWithSpent,
  FetyTransactionType,
  Goal,
  Transaction,
  TransactionFlow,
  TransactionType,
} from "../types/fety";
import { formatDisplayDate, todayISO } from "../lib/fetyCalculations";
import { EditableNumber, EditableText } from "../components/EditableField";
import EmojiIconPicker from "../components/EmojiIconPicker";
import BillScheduleFields from "../components/BillScheduleFields";
import CurrencyInput, { amountToEditString } from "../components/CurrencyInput";

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
  transactionTypes,
  viewMode,
  onUpdateBudget,
  onUpdateBill,
  onAddBill,
  onDeleteBill,
  onAddTransactionType,
  onUpdateTransactionType,
  onDeleteTransactionType,
  transactionTypeInUse,
}: {
  categories: CategoryWithSpent[];
  bills: Bill[];
  transactionTypes: FetyTransactionType[];
  viewMode: ViewMode;
  onUpdateBudget: (id: string, monthlyBudget: number) => void;
  onUpdateBill: (id: string, updates: Partial<Pick<Bill, "name" | "amount" | "dueDay" | "frequency" | "category">>) => void;
  onAddBill: (bill: Omit<Bill, "id">) => void;
  onDeleteBill: (id: string) => void;
  onAddTransactionType: (input: { name: string; icon: string; flow: TransactionFlow }) => void;
  onUpdateTransactionType: (id: string, updates: Partial<Pick<FetyTransactionType, "name" | "icon" | "flow">>) => void;
  onDeleteTransactionType: (id: string) => void;
  transactionTypeInUse: (id: string) => boolean;
}) {
  const [billName, setBillName] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billDue, setBillDue] = useState(1);
  const [billFrequency, setBillFrequency] = useState<BillFrequency>("monthly");
  const [billCategory, setBillCategory] = useState("Bills");
  const [typeName, setTypeName] = useState("");
  const [typeIcon, setTypeIcon] = useState("🏷️");
  const [typeFlow, setTypeFlow] = useState<TransactionFlow>("expense");
  const typeNameDrafts = useMemo(
    () => Object.fromEntries(transactionTypes.map((t) => [t.id, t.name])),
    [transactionTypes],
  );
  const [typeNames, setTypeNames] = useState<Record<string, string>>(typeNameDrafts);
  useEffect(() => {
    setTypeNames(typeNameDrafts);
  }, [typeNameDrafts]);

  const totalBudget = categories.reduce((s, c) => s + c.monthlyBudget, 0);
  const totalSpent = categories.reduce((s, c) => s + c.spent, 0);

  const submitBill = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(billAmount);
    if (!billName.trim() || !Number.isFinite(amount)) return;
    onAddBill({
      name: billName.trim(),
      amount,
      dueDay: billDue,
      frequency: billFrequency,
      category: billCategory,
      icon: "📄",
    });
    setBillName("");
    setBillAmount("");
    setBillDue(1);
    setBillFrequency("monthly");
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
              <EditableNumber
                label="Monthly cap"
                value={c.monthlyBudget}
                format={usd}
                onSave={(n) => onUpdateBudget(c.id, n)}
                valueStyle={{ fontSize: 18 }}
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
            <div key={b.id} style={{ padding: "12px 0", borderBottom: "1px solid var(--border-soft)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ fontSize: 18, marginTop: 4 }}>{b.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <EditableText label="Bill name" value={b.name} onSave={(name) => onUpdateBill(b.id, { name })} />
                  <EditableNumber label="Amount" value={b.amount} format={usd} currency onSave={(amount) => onUpdateBill(b.id, { amount })} valueStyle={{ fontSize: 16 }} />
                  <div style={{ marginTop: 8 }}>
                    <BillScheduleFields
                      compact
                      frequency={b.frequency ?? "monthly"}
                      dueDay={b.dueDay}
                      onFrequencyChange={(frequency) => onUpdateBill(b.id, { frequency })}
                      onDueDayChange={(dueDay) => onUpdateBill(b.id, { dueDay })}
                      inputStyle={inputStyle}
                    />
                  </div>
                  <EditableText label="Category" value={b.category} onSave={(category) => onUpdateBill(b.id, { category })} valueStyle={{ fontSize: 12 }} />
                </div>
                <button type="button" onClick={() => onDeleteBill(b.id)} style={{ border: "none", background: "transparent", color: "var(--ink-3)", cursor: "pointer", fontSize: 11, flexShrink: 0 }}>Remove</button>
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={submitBill} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8, alignItems: "end" }}>
            <div>
              <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Bill name</label>
              <input value={billName} onChange={(e) => setBillName(e.target.value)} style={inputStyle} placeholder="Electric" />
            </div>
            <div>
              <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Amount</label>
              <CurrencyInput value={billAmount} onChange={setBillAmount} placeholder="0.00" />
            </div>
            <div>
              <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Category</label>
              <input value={billCategory} onChange={(e) => setBillCategory(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <BillScheduleFields
            frequency={billFrequency}
            dueDay={billDue}
            onFrequencyChange={setBillFrequency}
            onDueDayChange={setBillDue}
            inputStyle={inputStyle}
          />
          <button type="submit" style={{ padding: "8px 14px", borderRadius: "var(--radius-ctrl)", border: "none", background: "var(--ink)", color: "#fff", fontWeight: 600, cursor: "pointer", alignSelf: "flex-start" }}>Add bill</button>
        </form>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px" }}>
        <p className="fety-label-strong" style={{ marginBottom: 6 }}>Transaction types</p>
        <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 14, lineHeight: 1.45 }}>
          Types you define here appear when you add or edit transactions on the calendar and Transactions page.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {transactionTypes.map((tt) => {
            const inUse = transactionTypeInUse(tt.id);
            return (
              <div key={tt.id} style={{ padding: "12px 14px", border: "1px solid var(--border-soft)", borderRadius: 12 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <EmojiIconPicker
                    value={tt.icon}
                    onChange={(icon) => onUpdateTransactionType(tt.id, { icon })}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Name</label>
                    <input
                      value={typeNames[tt.id] ?? tt.name}
                      onChange={(e) => setTypeNames((prev) => ({ ...prev, [tt.id]: e.target.value }))}
                      onBlur={() => {
                        const name = (typeNames[tt.id] ?? tt.name).trim();
                        if (name && name !== tt.name) onUpdateTransactionType(tt.id, { name });
                        else setTypeNames((prev) => ({ ...prev, [tt.id]: tt.name }));
                      }}
                      style={{ ...inputStyle, marginBottom: 8 }}
                    />
                    <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Money direction</label>
                    <select
                      value={tt.flow}
                      disabled={tt.locked}
                      onChange={(e) => onUpdateTransactionType(tt.id, { flow: e.target.value as TransactionFlow })}
                      style={inputStyle}
                    >
                      <option value="income">Money in (income)</option>
                      <option value="expense">Money out (expense)</option>
                      <option value="bill">Bill / recurring due</option>
                      <option value="transfer">Transfer (neutral)</option>
                    </select>
                    {tt.locked && (
                      <p style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 6 }}>Core type — you can rename and change the icon, but not remove it.</p>
                    )}
                  </div>
                  {!tt.locked && (
                    <button
                      type="button"
                      title={inUse ? "Remove after deleting transactions that use this type" : "Remove type"}
                      disabled={inUse}
                      onClick={() => onDeleteTransactionType(tt.id)}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: inUse ? "var(--ink-3)" : "var(--trouble-dk)",
                        cursor: inUse ? "not-allowed" : "pointer",
                        fontSize: 11,
                        flexShrink: 0,
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!typeName.trim()) return;
            onAddTransactionType({ name: typeName.trim(), icon: typeIcon, flow: typeFlow });
            setTypeName("");
            setTypeIcon("🏷️");
            setTypeFlow("expense");
          }}
          style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 8, alignItems: "end" }}
        >
          <div>
            <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>New type name</label>
            <input value={typeName} onChange={(e) => setTypeName(e.target.value)} style={inputStyle} placeholder="Refund" />
          </div>
          <EmojiIconPicker value={typeIcon} onChange={setTypeIcon} />
          <div>
            <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Direction</label>
            <select value={typeFlow} onChange={(e) => setTypeFlow(e.target.value as TransactionFlow)} style={inputStyle}>
              <option value="expense">Money out</option>
              <option value="income">Money in</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>
          <button type="submit" style={{ padding: "8px 14px", borderRadius: "var(--radius-ctrl)", border: "none", background: "var(--ink)", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Add type</button>
        </form>
      </div>
    </div>
  );
}

export function TransactionsManageView({
  transactions,
  categories,
  transactionTypes,
  viewMode,
  onAdd,
  onUpdate,
  onDelete,
}: {
  transactions: Transaction[];
  categories: BudgetCategory[];
  transactionTypes: FetyTransactionType[];
  viewMode: ViewMode;
  onAdd: (input: { desc: string; amount: number; type: TransactionType; category: string; dateISO?: string; icon?: string }) => void;
  onUpdate: (id: string, updates: Partial<Pick<Transaction, "desc" | "amount" | "type" | "category" | "dateISO" | "icon">>) => void;
  onDelete: (id: string) => void;
}) {
  const defaultTypeId = transactionTypes.find((t) => t.id === "expense")?.id ?? transactionTypes[0]?.id ?? "expense";
  const iconForType = (typeId: string) => transactionTypes.find((t) => t.id === typeId)?.icon ?? "💬";
  const [filter, setFilter] = useState("All");
  const [editId, setEditId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editType, setEditType] = useState<TransactionType>(defaultTypeId);
  const [editCategory, setEditCategory] = useState("Other");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<TransactionType>(defaultTypeId);
  const [category, setCategory] = useState(categories[0]?.name ?? "Other");
  const [dateISO, setDateISO] = useState(todayISO());
  const [addIcon, setAddIcon] = useState("");
  const [editIcon, setEditIcon] = useState("");

  const shown =
    filter === "All"
      ? transactions
      : transactions.filter((t) => {
          const tt = transactionTypes.find((x) => x.id === t.type);
          return tt?.name === filter || t.type === filter;
        });
  const filterLabels = ["All", ...transactionTypes.map((t) => t.name)];
  const byDate: Record<string, Transaction[]> = {};
  shown.forEach((t) => {
    const label = formatDisplayDate(t.dateISO);
    (byDate[label] ||= []).push(t);
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseFloat(amount);
    if (!desc.trim() || !Number.isFinite(n)) return;
    onAdd({ desc: desc.trim(), amount: n, type, category, dateISO, icon: addIcon.trim() || undefined });
    setDesc("");
    setAmount("");
    setAddIcon("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <form onSubmit={submit} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, alignItems: "end" }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <p className="fety-label-strong" style={{ marginBottom: 8 }}>Add transaction</p>
        </div>
        <EmojiIconPicker
          value={addIcon}
          defaultEmoji={iconForType(type)}
          onChange={setAddIcon}
        />
        <div>
          <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Description</label>
          <input value={desc} onChange={(e) => setDesc(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Amount</label>
          <CurrencyInput value={amount} onChange={setAmount} placeholder="0.00" />
        </div>
        <div>
          <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Transaction type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} style={inputStyle}>
            {transactionTypes.map((tt) => (
              <option key={tt.id} value={tt.id}>
                {tt.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Transaction category</label>
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
        {filterLabels.map((f) => (
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
                {editId === t.id ? (
                  <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 8, alignItems: "end", overflow: "visible", position: "relative", zIndex: 2 }}>
                    <EmojiIconPicker
                      value={editIcon}
                      defaultEmoji={iconForType(editType)}
                      onChange={setEditIcon}
                      compact
                    />
                    <div>
                      <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Description</label>
                      <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} style={inputStyle} placeholder="Description" />
                    </div>
                    <div>
                      <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Amount</label>
                      <CurrencyInput value={editAmount} onChange={setEditAmount} placeholder="0.00" />
                    </div>
                    <div>
                      <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Transaction type</label>
                      <select value={editType} onChange={(e) => setEditType(e.target.value)} style={inputStyle}>
                        {transactionTypes.map((tt) => (
                          <option key={tt.id} value={tt.id}>
                            {tt.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Transaction category</label>
                      <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} style={inputStyle}>
                        {[...categories.map((c) => c.name), "Income", "Savings", "Other"].filter((v, i, a) => a.indexOf(v) === i).map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const n = parseFloat(editAmount);
                        if (editDesc.trim() && Number.isFinite(n)) {
                          onUpdate(t.id, {
                            desc: editDesc.trim(),
                            amount: n,
                            type: editType,
                            category: editCategory,
                            icon: editIcon.trim() || iconForType(editType),
                          });
                          setEditId(null);
                        }
                      }}
                      style={{ padding: "8px 12px", borderRadius: "var(--radius-ctrl)", border: "none", background: "var(--ink)", color: "#fff", fontWeight: 600, cursor: "pointer" }}
                    >
                      Save
                    </button>
                    <button type="button" onClick={() => setEditId(null)} style={{ padding: "8px 12px", borderRadius: "var(--radius-ctrl)", border: "1px solid var(--border)", background: "transparent", cursor: "pointer" }}>Cancel</button>
                  </div>
                ) : (
                  <>
                    <div style={{ width: 36, height: 36, borderRadius: 11, background: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{t.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{t.desc}</p>
                      <p style={{ fontSize: 10, color: "var(--ink-3)" }}>{t.category}</p>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: t.amount >= 0 ? "var(--clear-dk)" : "var(--trouble-dk)" }}>
                      {t.amount >= 0 ? "+" : ""}{usdF(t.amount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditId(t.id);
                        setEditDesc(t.desc);
                        setEditAmount(amountToEditString(t.amount));
                        setEditType(t.type);
                        setEditCategory(t.category);
                        setEditIcon(t.icon);
                      }}
                      style={{ border: "none", background: "transparent", color: "var(--ink-3)", cursor: "pointer", fontSize: 11 }}
                    >
                      Edit
                    </button>
                    <button type="button" onClick={() => onDelete(t.id)} style={{ border: "none", background: "transparent", color: "var(--ink-3)", cursor: "pointer", fontSize: 11 }}>Delete</button>
                  </>
                )}
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
  const [editGoalId, setEditGoalId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSaved, setEditSaved] = useState("");
  const [editTarget, setEditTarget] = useState("");
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
          const editing = editGoalId === g.id;
          return (
            <div key={g.id} style={{ background: "var(--surface)", borderRadius: 16, padding: "20px 22px", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 22 }}>{g.icon}</span>
                <div style={{ flex: 1 }}>
                  {editing ? (
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} style={inputStyle} placeholder="Goal name" />
                  ) : (
                    <>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{g.name}</p>
                      <p style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}>Target {g.targetDate}</p>
                    </>
                  )}
                </div>
                {!editing ? (
                  <button type="button" onClick={() => { setEditGoalId(g.id); setEditName(g.name); setEditSaved(String(g.saved)); setEditTarget(String(g.target)); }} style={{ border: "none", background: "transparent", color: "var(--ink-2)", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Edit</button>
                ) : (
                  <button type="button" onClick={() => { const s = parseFloat(editSaved); const t = parseFloat(editTarget); if (editName.trim() && Number.isFinite(s) && Number.isFinite(t)) { onUpdate(g.id, { name: editName.trim(), saved: s, target: t }); setEditGoalId(null); } }} style={{ border: "none", background: "var(--ink)", color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600, padding: "6px 10px", borderRadius: 8 }}>Save</button>
                )}
                <button type="button" onClick={() => onDelete(g.id)} style={{ border: "none", background: "transparent", color: "var(--ink-3)", cursor: "pointer", fontSize: 11 }}>Remove</button>
              </div>
              {editing ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Saved</label>
                    <input value={editSaved} onChange={(e) => setEditSaved(e.target.value)} type="number" style={inputStyle} />
                  </div>
                  <div>
                    <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Target</label>
                    <input value={editTarget} onChange={(e) => setEditTarget(e.target.value)} type="number" style={inputStyle} />
                  </div>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: 18, fontWeight: 400, color: "var(--ink)" }}>{usd(g.saved)} <span style={{ fontSize: 12, color: "var(--ink-3)" }}>of {usd(g.target)}</span></p>
                  <p style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 8 }}>{pct}% of target</p>
                </>
              )}
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
  onAddAccount,
  onDeleteAccount,
  onReset,
  onRestartSetup,
}: {
  profile: { displayName: string; email: string; currency: string; startingBalance: number };
  accounts: Account[];
  onUpdateProfile: (u: Partial<{ displayName: string; email: string; currency: string; startingBalance: number }>) => void;
  onUpdateAccount: (id: string, u: Partial<Pick<Account, "name" | "type" | "balance" | "icon">>) => void;
  onAddAccount: (input: Omit<Account, "id">) => void;
  onDeleteAccount: (id: string) => void;
  onReset: () => void;
  onRestartSetup?: () => void;
}) {
  const [profileEdit, setProfileEdit] = useState(false);
  const [pName, setPName] = useState(profile.displayName);
  const [pEmail, setPEmail] = useState(profile.email);
  const [pCurrency, setPCurrency] = useState(profile.currency);
  const [pStart, setPStart] = useState(String(profile.startingBalance));
  const [newAcctName, setNewAcctName] = useState("");
  const [newAcctType, setNewAcctType] = useState("Checking");
  const [newAcctBalance, setNewAcctBalance] = useState("");
  const [newAcctIcon, setNewAcctIcon] = useState("🏦");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
      <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", padding: "18px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <p className="fety-label-strong">Profile</p>
          {!profileEdit ? (
            <button type="button" onClick={() => { setProfileEdit(true); setPName(profile.displayName); setPEmail(profile.email); setPCurrency(profile.currency); setPStart(String(profile.startingBalance)); }} style={{ border: "none", background: "transparent", color: "var(--ink-2)", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Edit</button>
          ) : (
            <button type="button" onClick={() => { onUpdateProfile({ displayName: pName, email: pEmail, currency: pCurrency, startingBalance: parseFloat(pStart) || 0 }); setProfileEdit(false); }} style={{ border: "none", background: "var(--ink)", color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600, padding: "6px 10px", borderRadius: 8 }}>Save</button>
          )}
        </div>
        {profileEdit ? (
          <>
            <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Display name</label>
            <input value={pName} onChange={(e) => setPName(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }} />
            <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Email</label>
            <input value={pEmail} onChange={(e) => setPEmail(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }} type="email" />
            <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Currency</label>
            <input value={pCurrency} onChange={(e) => setPCurrency(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }} />
            <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Starting balance</label>
            <CurrencyInput value={pStart} onChange={setPStart} placeholder="Optional" />
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: "var(--ink)" }}>{profile.displayName || "—"}</p>
            <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>{profile.email}</p>
            <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>{profile.currency} · Starting {usd(profile.startingBalance)}</p>
          </>
        )}
      </div>

      <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", padding: "18px 20px" }}>
        <p className="fety-label-strong" style={{ marginBottom: 6 }}>Accounts</p>
        <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 14, lineHeight: 1.45 }}>
          Track where your money lives — checking, savings, credit cards, and more.
        </p>
        {accounts.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 12 }}>No accounts yet. Add one below.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {accounts.map((a) => (
              <div key={a.id} style={{ padding: "12px 14px", border: "1px solid var(--border-soft)", borderRadius: 12 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <EmojiIconPicker
                    value={a.icon}
                    onChange={(icon) => onUpdateAccount(a.id, { icon })}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <EditableText label="Account name" value={a.name} onSave={(name) => onUpdateAccount(a.id, { name })} />
                    <EditableText label="Account type" value={a.type} onSave={(type) => onUpdateAccount(a.id, { type })} valueStyle={{ fontSize: 12 }} />
                    <EditableNumber
                      label="Balance"
                      value={a.balance}
                      format={usdF}
                      currency
                      allowNegative
                      onSave={(balance) => onUpdateAccount(a.id, { balance })}
                      valueStyle={{ fontSize: 18 }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Remove ${a.name || "this account"}?`)) onDeleteAccount(a.id);
                    }}
                    style={{ border: "none", background: "transparent", color: "var(--trouble-dk)", cursor: "pointer", fontSize: 11, flexShrink: 0 }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newAcctName.trim()) return;
            onAddAccount({
              name: newAcctName.trim(),
              type: newAcctType.trim() || "Account",
              balance: parseFloat(newAcctBalance) || 0,
              icon: newAcctIcon || "🏦",
            });
            setNewAcctName("");
            setNewAcctType("Checking");
            setNewAcctBalance("");
            setNewAcctIcon("🏦");
          }}
          style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr auto auto", gap: 8, alignItems: "end" }}
        >
          <div>
            <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>New account name</label>
            <input value={newAcctName} onChange={(e) => setNewAcctName(e.target.value)} style={inputStyle} placeholder="Chase Checking" />
          </div>
          <div>
            <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Type</label>
            <input value={newAcctType} onChange={(e) => setNewAcctType(e.target.value)} style={inputStyle} placeholder="Checking" />
          </div>
          <div>
            <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Balance</label>
            <CurrencyInput value={newAcctBalance} onChange={setNewAcctBalance} placeholder="0.00" />
          </div>
          <EmojiIconPicker value={newAcctIcon} onChange={setNewAcctIcon} />
          <button type="submit" style={{ padding: "8px 14px", borderRadius: "var(--radius-ctrl)", border: "none", background: "var(--ink)", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Add</button>
        </form>
      </div>

      <button type="button" onClick={() => { if (confirm("Reset all local data to demo sample data?")) onReset(); }} style={{ padding: "10px 16px", borderRadius: "var(--radius-ctrl)", border: "1px solid var(--trouble-dk)", background: "transparent", color: "var(--trouble-dk)", cursor: "pointer", fontWeight: 600 }}>
        Load demo sample data
      </button>
      {onRestartSetup && (
        <button type="button" onClick={onRestartSetup} style={{ padding: "10px 16px", borderRadius: "var(--radius-ctrl)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", cursor: "pointer", fontWeight: 600 }}>
          Run setup wizard again
        </button>
      )}
    </div>
  );
}
