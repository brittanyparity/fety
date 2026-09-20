import { useEffect, useState } from "react";
import type {
  Account,
  Bill,
  BillFrequency,
  BudgetCategory,
  CategoryWithSpent,
  FetyTransactionType,
  Goal,
  IncomeStream,
  IncomeFrequency,
  RecurringTransaction,
  Transaction,
  TransactionFlow,
  TransactionType,
} from "../types/fety";
import { formatTransactionGroupDate, todayISO } from "../lib/fetyCalculations";
import { EditableNumber, EditableText } from "../components/EditableField";
import EmojiIconPicker from "../components/EmojiIconPicker";
import BillScheduleFields from "../components/BillScheduleFields";
import IncomeScheduleFields from "../components/IncomeScheduleFields";
import { BILL_FREQUENCY_LABELS, INCOME_FREQUENCY_LABELS } from "../lib/billScheduling";
import { flowForTransactionType, isTransferTransactionType } from "../lib/transactionTypes";
import { APP_BUILD_LABEL } from "../lib/appBuildLabel";
import { accountBalanceWithTransactions, formatTransactionDetailLine, goalContributionsFromTransactions, goalSavedTotal } from "../lib/ledger";
import CurrencyInput, { amountToEditString } from "../components/CurrencyInput";

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const usdF = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const FLOW_LABELS: Record<TransactionFlow, string> = {
  income: "Money in",
  expense: "Money out",
  bill: "Bill / recurring due",
  transfer: "Transfer",
};

const editBtnStyle: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  color: "var(--ink-3)",
  fontSize: 11,
  fontWeight: 600,
  padding: "0 10px",
  height: 28,
};

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

function accountSelectOptions(accounts: Account[]) {
  return accounts;
}

function TransactionGoalSelect({
  goals,
  goalId,
  onGoalId,
}: {
  goals: Goal[];
  goalId: string;
  onGoalId: (v: string) => void;
}) {
  const validGoalId = goals.some((g) => g.id === goalId) ? goalId : "";
  return (
    <div>
      <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>
        Apply to goal
      </label>
      <select
        value={validGoalId}
        onChange={(e) => onGoalId(e.target.value)}
        style={inputStyle}
        disabled={goals.length === 0}
      >
        <option value="">{goals.length === 0 ? "Create goals on the Goals page" : "— None —"}</option>
        {goals.map((g) => (
          <option key={g.id} value={g.id}>
            {g.icon} {g.name}
          </option>
        ))}
      </select>
      {goals.length === 0 ? (
        <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>Linked amounts count toward that goal&apos;s saved total.</p>
      ) : null}
    </div>
  );
}

function TransferAccountFields({
  accounts,
  fromAccountId,
  toAccountId,
  onFromAccountId,
  onToAccountId,
}: {
  accounts: Account[];
  fromAccountId: string;
  toAccountId: string;
  onFromAccountId: (v: string) => void;
  onToAccountId: (v: string) => void;
}) {
  const emptyAcct = accounts.length === 0 ? "Add accounts in Settings" : "Select account";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: 10,
        padding: "12px 14px",
        borderRadius: 12,
        border: "1px solid var(--border)",
        background: "var(--bg)",
      }}
    >
      <p className="fety-label-strong" style={{ gridColumn: "1 / -1", margin: 0 }}>
        Transfer between accounts
      </p>
      {accounts.length === 0 ? (
        <p style={{ gridColumn: "1 / -1", fontSize: 12, color: "var(--ink-2)", margin: 0 }}>
          Add checking, savings, or other accounts under Settings to choose where money moves from and to.
        </p>
      ) : null}
      <div>
        <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>
          From account
        </label>
        <select
          value={fromAccountId}
          onChange={(e) => onFromAccountId(e.target.value)}
          style={inputStyle}
          disabled={accounts.length === 0}
        >
          <option value="">{emptyAcct}</option>
          {accountSelectOptions(accounts).map((a) => (
            <option key={a.id} value={a.id}>
              {a.icon} {a.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>
          To account
        </label>
        <select
          value={toAccountId}
          onChange={(e) => onToAccountId(e.target.value)}
          style={inputStyle}
          disabled={accounts.length === 0}
        >
          <option value="">{emptyAcct}</option>
          {accountSelectOptions(accounts).map((a) => (
            <option key={a.id} value={a.id}>
              {a.icon} {a.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function TransactionRoutingFields({
  type,
  accounts,
  goals,
  fromAccountId,
  toAccountId,
  goalId,
  onFromAccountId,
  onToAccountId,
  onGoalId,
  storeForFlow,
}: {
  type: TransactionType;
  accounts: Account[];
  goals: Goal[];
  fromAccountId: string;
  toAccountId: string;
  goalId: string;
  onFromAccountId: (v: string) => void;
  onToAccountId: (v: string) => void;
  onGoalId: (v: string) => void;
  storeForFlow: import("../types/fety").FetyStore;
}) {
  const isTransfer = isTransferTransactionType(storeForFlow, type);
  return (
    <>
      {isTransfer ? (
        <TransferAccountFields
          accounts={accounts}
          fromAccountId={fromAccountId}
          toAccountId={toAccountId}
          onFromAccountId={onFromAccountId}
          onToAccountId={onToAccountId}
        />
      ) : null}
      <TransactionGoalSelect goals={goals} goalId={goalId} onGoalId={onGoalId} />
    </>
  );
}

const tileIconBtn: React.CSSProperties = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  fontSize: 14,
  padding: "4px 5px",
  lineHeight: 1,
  minWidth: 28,
  minHeight: 28,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export function BudgetManageView({
  categories,
  bills,
  incomeStreams,
  recurringTransactions,
  transactionTypes,
  viewMode,
  onUpdateBudget,
  onDeleteCategory,
  onUpdateBill,
  onAddBill,
  onDeleteBill,
  onUpdateIncomeStream,
  onAddIncomeStream,
  onDeleteIncomeStream,
  onUpdateRecurringTransaction,
  onAddRecurringTransaction,
  onDeleteRecurringTransaction,
  onAddTransactionType,
  onUpdateTransactionType,
  onDeleteTransactionType,
  transactionTypeInUse,
  accounts,
  goals,
  typeIcons,
}: {
  categories: CategoryWithSpent[];
  bills: Bill[];
  incomeStreams: IncomeStream[];
  recurringTransactions: RecurringTransaction[];
  transactionTypes: FetyTransactionType[];
  viewMode: ViewMode;
  onUpdateBudget: (id: string, monthlyBudget: number) => void;
  onDeleteCategory: (id: string) => void;
  onUpdateBill: (id: string, updates: Partial<Pick<Bill, "name" | "amount" | "dueDay" | "frequency" | "category" | "icon">>) => void;
  onAddBill: (bill: Omit<Bill, "id">) => void;
  onDeleteBill: (id: string) => void;
  onUpdateIncomeStream: (
    id: string,
    updates: Partial<
      Pick<
        IncomeStream,
        "name" | "amount" | "dueDay" | "frequency" | "category" | "icon" | "startDateISO" | "endDateISO" | "semiMonthlyDays"
      >
    >,
  ) => void;
  onAddIncomeStream: (stream: Omit<IncomeStream, "id">) => void;
  onDeleteIncomeStream: (id: string) => void;
  onUpdateRecurringTransaction: (
    id: string,
    updates: Partial<
      Pick<
        RecurringTransaction,
        "name" | "amount" | "dueDay" | "frequency" | "category" | "icon" | "transactionType" | "fromAccountId" | "toAccountId" | "goalId"
      >
    >,
  ) => void;
  onAddRecurringTransaction: (item: Omit<RecurringTransaction, "id">) => void;
  onDeleteRecurringTransaction: (id: string) => void;
  onAddTransactionType: (input: { name: string; icon: string; flow: TransactionFlow }) => void;
  onUpdateTransactionType: (id: string, updates: Partial<Pick<FetyTransactionType, "name" | "icon" | "flow">>) => void;
  onDeleteTransactionType: (id: string) => void;
  transactionTypeInUse: (id: string) => boolean;
  accounts: Account[];
  goals: Goal[];
  typeIcons: import("../types/fety").TypeIconMap;
}) {
  const ledgerStore = { accounts, goals, transactionTypes, typeIcons } as import("../types/fety").FetyStore;
  const [billName, setBillName] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billDue, setBillDue] = useState(1);
  const [billFrequency, setBillFrequency] = useState<BillFrequency>("monthly");
  const [billCategory, setBillCategory] = useState("Bills");
  const [typeName, setTypeName] = useState("");
  const [typeIcon, setTypeIcon] = useState("🏷️");
  const [typeFlow, setTypeFlow] = useState<TransactionFlow>("expense");
  const [budgetAddMode, setBudgetAddMode] = useState<"bill" | "income" | "recur" | "type">("bill");
  const [editingCategoryCapId, setEditingCategoryCapId] = useState<string | null>(null);
  const [categoryCapDraft, setCategoryCapDraft] = useState("");
  const [incomeName, setIncomeName] = useState("");
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeDue, setIncomeDue] = useState(1);
  const [incomeFrequency, setIncomeFrequency] = useState<IncomeFrequency>("biweekly");
  const [incomeSemiMonthlyDays, setIncomeSemiMonthlyDays] = useState<[number, number]>([1, 15]);
  const [incomeStartDate, setIncomeStartDate] = useState("");
  const [incomeEndDate, setIncomeEndDate] = useState("");
  const [incomeCategory, setIncomeCategory] = useState("Income");
  const [recurName, setRecurName] = useState("");
  const [recurAmount, setRecurAmount] = useState("");
  const [recurDue, setRecurDue] = useState(1);
  const [recurFrequency, setRecurFrequency] = useState<BillFrequency>("monthly");
  const [recurCategory, setRecurCategory] = useState("Other");
  const [recurTransactionType, setRecurTransactionType] = useState<TransactionType>("expense");
  const [recurFromAccountId, setRecurFromAccountId] = useState("");
  const [recurToAccountId, setRecurToAccountId] = useState("");
  const [recurGoalId, setRecurGoalId] = useState("");
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [typeEditDraft, setTypeEditDraft] = useState<{ name: string; icon: string; flow: TransactionFlow } | null>(null);

  const startEditTransactionType = (tt: FetyTransactionType) => {
    setEditingTypeId(tt.id);
    setTypeEditDraft({ name: tt.name, icon: tt.icon, flow: tt.flow });
  };

  const saveEditTransactionType = () => {
    if (!editingTypeId || !typeEditDraft) return;
    const name = typeEditDraft.name.trim();
    if (!name) return;
    onUpdateTransactionType(editingTypeId, {
      name,
      icon: typeEditDraft.icon,
      flow: typeEditDraft.flow,
    });
    setEditingTypeId(null);
    setTypeEditDraft(null);
  };

  const cancelEditTransactionType = () => {
    setEditingTypeId(null);
    setTypeEditDraft(null);
  };

  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [billEditDraft, setBillEditDraft] = useState<{
    name: string;
    amount: string;
    category: string;
    frequency: BillFrequency;
    dueDay: number;
    icon: string;
  } | null>(null);

  const startEditBill = (b: Bill) => {
    setEditingBillId(b.id);
    setBillEditDraft({
      name: b.name,
      amount: b.amount === 0 ? "" : String(b.amount),
      category: b.category,
      frequency: b.frequency ?? "monthly",
      dueDay: b.dueDay,
      icon: b.icon || "📄",
    });
  };

  const saveEditBill = () => {
    if (!editingBillId || !billEditDraft) return;
    const name = billEditDraft.name.trim();
    const amount = parseFloat(billEditDraft.amount);
    if (!name || !Number.isFinite(amount)) return;
    onUpdateBill(editingBillId, {
      name,
      amount,
      category: billEditDraft.category.trim() || "Bills",
      frequency: billEditDraft.frequency,
      dueDay: billEditDraft.dueDay,
      icon: billEditDraft.icon,
    });
    setEditingBillId(null);
    setBillEditDraft(null);
  };

  const cancelEditBill = () => {
    setEditingBillId(null);
    setBillEditDraft(null);
  };

  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);
  const [incomeEditDraft, setIncomeEditDraft] = useState<{
    name: string;
    amount: string;
    category: string;
    frequency: IncomeFrequency;
    dueDay: number;
    semiMonthlyDays: [number, number];
    startDateISO: string;
    endDateISO: string;
    icon: string;
  } | null>(null);

  const incomeScheduleFromDraft = (d: {
    frequency: IncomeFrequency;
    dueDay: number;
    semiMonthlyDays: [number, number];
    startDateISO: string;
    endDateISO: string;
  }): Pick<IncomeStream, "frequency" | "dueDay" | "semiMonthlyDays" | "startDateISO" | "endDateISO"> => ({
    frequency: d.frequency,
    dueDay: d.dueDay,
    semiMonthlyDays: d.frequency === "semimonthly" ? d.semiMonthlyDays : undefined,
    startDateISO: d.startDateISO.trim() || undefined,
    endDateISO: d.endDateISO.trim() || undefined,
  });

  const startEditIncome = (s: IncomeStream) => {
    setEditingIncomeId(s.id);
    setIncomeEditDraft({
      name: s.name,
      amount: s.amount === 0 ? "" : String(s.amount),
      category: s.category,
      frequency: s.frequency ?? "monthly",
      dueDay: s.dueDay,
      semiMonthlyDays: s.semiMonthlyDays ?? [s.dueDay, 15],
      startDateISO: s.startDateISO ?? "",
      endDateISO: s.endDateISO ?? "",
      icon: s.icon || "💵",
    });
  };

  const saveEditIncome = () => {
    if (!editingIncomeId || !incomeEditDraft) return;
    const name = incomeEditDraft.name.trim();
    const amount = parseFloat(incomeEditDraft.amount);
    if (!name || !Number.isFinite(amount)) return;
    onUpdateIncomeStream(editingIncomeId, {
      name,
      amount,
      category: incomeEditDraft.category.trim() || "Income",
      icon: incomeEditDraft.icon,
      ...incomeScheduleFromDraft(incomeEditDraft),
    });
    setEditingIncomeId(null);
    setIncomeEditDraft(null);
  };

  const cancelEditIncome = () => {
    setEditingIncomeId(null);
    setIncomeEditDraft(null);
  };

  const [editingRecurId, setEditingRecurId] = useState<string | null>(null);
  const [recurEditDraft, setRecurEditDraft] = useState<{
    name: string;
    amount: string;
    category: string;
    frequency: BillFrequency;
    dueDay: number;
    icon: string;
    transactionType: TransactionType;
    fromAccountId: string;
    toAccountId: string;
    goalId: string;
  } | null>(null);

  const startEditRecur = (r: RecurringTransaction) => {
    setEditingRecurId(r.id);
    setRecurEditDraft({
      name: r.name,
      amount: r.amount === 0 ? "" : String(r.amount),
      category: r.category,
      frequency: r.frequency ?? "monthly",
      dueDay: r.dueDay,
      icon: r.icon || "🔄",
      transactionType: r.transactionType || "expense",
      fromAccountId: r.fromAccountId ?? "",
      toAccountId: r.toAccountId ?? "",
      goalId: r.goalId ?? "",
    });
  };

  const saveEditRecur = () => {
    if (!editingRecurId || !recurEditDraft) return;
    const name = recurEditDraft.name.trim();
    const amount = parseFloat(recurEditDraft.amount);
    if (!name || !Number.isFinite(amount)) return;
    onUpdateRecurringTransaction(editingRecurId, {
      name,
      amount,
      category: recurEditDraft.category.trim() || "Other",
      frequency: recurEditDraft.frequency,
      dueDay: recurEditDraft.dueDay,
      icon: recurEditDraft.icon,
      transactionType: recurEditDraft.transactionType,
      fromAccountId: recurEditDraft.fromAccountId || undefined,
      toAccountId: recurEditDraft.toAccountId || undefined,
      goalId: recurEditDraft.goalId || undefined,
    });
    setEditingRecurId(null);
    setRecurEditDraft(null);
  };

  const cancelEditRecur = () => {
    setEditingRecurId(null);
    setRecurEditDraft(null);
  };

  const scheduleDueSummary = (item: Pick<Bill, "frequency" | "dueDay">) => {
    const freq = BILL_FREQUENCY_LABELS[item.frequency ?? "monthly"];
    if (item.frequency === "weekly" || item.frequency === "biweekly") {
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return `${freq} · ${days[item.dueDay] ?? "Mon"}`;
    }
    return `${freq} · day ${item.dueDay}`;
  };

  const billDueSummary = (b: Bill) => scheduleDueSummary(b);

  const incomeDueSummary = (s: IncomeStream) => {
    if (s.frequency === "semimonthly") {
      const [a, b] = s.semiMonthlyDays ?? [s.dueDay, 15];
      return `Twice a month · days ${a} & ${b}`;
    }
    const freq = INCOME_FREQUENCY_LABELS[s.frequency ?? "monthly"];
    if (s.frequency === "weekly" || s.frequency === "biweekly") {
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return `${freq} · ${days[s.dueDay] ?? "Mon"}`;
    }
    return `${freq} · day ${s.dueDay}`;
  };

  const recurringTypeOptions = transactionTypes.filter((t) => t.id !== "bill");
  const typeLabel = (id: TransactionType) => transactionTypes.find((t) => t.id === id)?.name ?? id;

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

  const submitIncome = () => {
    const amount = parseFloat(incomeAmount);
    if (!incomeName.trim() || !Number.isFinite(amount)) return;
    onAddIncomeStream({
      name: incomeName.trim(),
      amount,
      category: incomeCategory,
      icon: "💵",
      ...incomeScheduleFromDraft({
        frequency: incomeFrequency,
        dueDay: incomeDue,
        semiMonthlyDays: incomeSemiMonthlyDays,
        startDateISO: incomeStartDate,
        endDateISO: incomeEndDate,
      }),
    });
    setIncomeName("");
    setIncomeAmount("");
    setIncomeDue(1);
    setIncomeFrequency("biweekly");
    setIncomeSemiMonthlyDays([1, 15]);
    setIncomeStartDate("");
    setIncomeEndDate("");
  };

  const submitRecur = () => {
    const amount = parseFloat(recurAmount);
    if (!recurName.trim() || !Number.isFinite(amount)) return;
    onAddRecurringTransaction({
      name: recurName.trim(),
      amount,
      dueDay: recurDue,
      frequency: recurFrequency,
      category: recurCategory,
      icon: "🔄",
      transactionType: recurTransactionType,
      fromAccountId: recurFromAccountId || undefined,
      toAccountId: recurToAccountId || undefined,
      goalId: recurGoalId || undefined,
    });
    setRecurName("");
    setRecurAmount("");
    setRecurDue(1);
    setRecurFrequency("monthly");
  };

  const submitBudgetAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (budgetAddMode === "bill") {
      submitBill(e);
      return;
    }
    if (budgetAddMode === "income") {
      submitIncome();
      return;
    }
    if (budgetAddMode === "recur") {
      submitRecur();
      return;
    }
    if (!typeName.trim()) return;
    onAddTransactionType({ name: typeName.trim(), icon: typeIcon, flow: typeFlow });
    setTypeName("");
    setTypeIcon("🏷️");
    setTypeFlow("expense");
  };

  const addModeToggleStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 14px",
    borderRadius: 99,
    fontSize: 11,
    fontWeight: 600,
    border: "1px solid var(--border)",
    cursor: "pointer",
    background: active ? "var(--ink)" : "var(--surface)",
    color: active ? "#fff" : "var(--ink-2)",
  });

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
          const editingCap = editingCategoryCapId === c.id;
          return (
            <div key={c.id} style={{ position: "relative", background: "var(--surface)", borderRadius: 14, padding: "16px 18px", border: "1px solid var(--border)" }}>
              <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 0, zIndex: 1 }}>
                <button
                  type="button"
                  title="Edit monthly cap"
                  onClick={() => {
                    setEditingCategoryCapId(c.id);
                    setCategoryCapDraft(c.monthlyBudget === 0 ? "" : String(c.monthlyBudget));
                  }}
                  style={{ ...tileIconBtn, color: "var(--ink-3)" }}
                >
                  ✎
                </button>
                <button
                  type="button"
                  title="Remove category"
                  onClick={() => {
                    if (editingCategoryCapId === c.id) setEditingCategoryCapId(null);
                    onDeleteCategory(c.id);
                  }}
                  style={{ ...tileIconBtn, color: "var(--trouble-dk)" }}
                >
                  ×
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, paddingRight: 44 }}>
                <span style={{ fontSize: 18 }}>{c.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{c.name}</span>
                {over && <span style={{ fontSize: 9, color: "var(--trouble-dk)", background: "#FFECE8", padding: "2px 6px", borderRadius: 99 }}>Over</span>}
              </div>
              {editingCap ? (
                <div>
                  <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Monthly cap</label>
                  <CurrencyInput value={categoryCapDraft} onChange={setCategoryCapDraft} placeholder="0.00" />
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={() => {
                        const n = categoryCapDraft === "" ? 0 : parseFloat(categoryCapDraft);
                        if (!Number.isFinite(n)) return;
                        onUpdateBudget(c.id, n);
                        setEditingCategoryCapId(null);
                        setCategoryCapDraft("");
                      }}
                      style={{ padding: "6px 12px", borderRadius: "var(--radius-ctrl)", border: "none", background: "var(--ink)", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCategoryCapId(null);
                        setCategoryCapDraft("");
                      }}
                      style={{ padding: "6px 12px", borderRadius: "var(--radius-ctrl)", border: "1px solid var(--border)", background: "transparent", fontSize: 11, cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="fety-label" style={{ marginBottom: 4 }}>Monthly cap</p>
                  <p style={{ fontSize: 18, fontWeight: 400, color: "var(--ink)", letterSpacing: "-0.02em" }}>{usd(c.monthlyBudget)}</p>
                </>
              )}
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

      <form
        onSubmit={submitBudgetAdd}
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: "18px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <p className="fety-label-strong" style={{ margin: 0 }}>Add scheduled item or type</p>
          <div style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setBudgetAddMode("bill")} style={addModeToggleStyle(budgetAddMode === "bill")}>
              Bill
            </button>
            <button type="button" onClick={() => setBudgetAddMode("income")} style={addModeToggleStyle(budgetAddMode === "income")}>
              Income
            </button>
            <button type="button" onClick={() => setBudgetAddMode("recur")} style={addModeToggleStyle(budgetAddMode === "recur")}>
              Recurring
            </button>
            <button type="button" onClick={() => setBudgetAddMode("type")} style={addModeToggleStyle(budgetAddMode === "type")}>
              Transaction type
            </button>
          </div>
        </div>

        {budgetAddMode === "bill" ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8, alignItems: "end" }}>
              <div className="fety-form-desc">
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
            <button type="submit" style={{ padding: "8px 14px", borderRadius: "var(--radius-ctrl)", border: "none", background: "var(--ink)", color: "#fff", fontWeight: 600, cursor: "pointer", alignSelf: "flex-start" }}>
              Add bill
            </button>
          </>
        ) : budgetAddMode === "income" ? (
          <>
            <p style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.45, margin: 0 }}>
              Paychecks and other recurring money in — projected on your calendar and Transactions page.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8, alignItems: "end" }}>
              <div className="fety-form-desc">
                <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Income name</label>
                <input value={incomeName} onChange={(e) => setIncomeName(e.target.value)} style={inputStyle} placeholder="Paycheck" />
              </div>
              <div>
                <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Amount</label>
                <CurrencyInput value={incomeAmount} onChange={setIncomeAmount} placeholder="0.00" />
              </div>
              <div>
                <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Category</label>
                <input value={incomeCategory} onChange={(e) => setIncomeCategory(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <IncomeScheduleFields
              frequency={incomeFrequency}
              dueDay={incomeDue}
              semiMonthlyDays={incomeSemiMonthlyDays}
              startDateISO={incomeStartDate}
              endDateISO={incomeEndDate}
              onFrequencyChange={setIncomeFrequency}
              onDueDayChange={setIncomeDue}
              onSemiMonthlyDaysChange={setIncomeSemiMonthlyDays}
              onStartDateISOChange={setIncomeStartDate}
              onEndDateISOChange={setIncomeEndDate}
              inputStyle={inputStyle}
            />
            <button type="submit" style={{ padding: "8px 14px", borderRadius: "var(--radius-ctrl)", border: "none", background: "var(--ink)", color: "#fff", fontWeight: 600, cursor: "pointer", alignSelf: "flex-start" }}>
              Add income stream
            </button>
          </>
        ) : budgetAddMode === "recur" ? (
          <>
            <p style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.45, margin: 0 }}>
              Other repeating transactions (subscriptions, transfers, etc.) — not bills.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8, alignItems: "end" }}>
              <div className="fety-form-desc">
                <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Name</label>
                <input value={recurName} onChange={(e) => setRecurName(e.target.value)} style={inputStyle} placeholder="Gym membership" />
              </div>
              <div>
                <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Amount</label>
                <CurrencyInput value={recurAmount} onChange={setRecurAmount} placeholder="0.00" />
              </div>
              <div>
                <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Category</label>
                <input value={recurCategory} onChange={(e) => setRecurCategory(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <div style={{ maxWidth: 280 }}>
              <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Transaction type</label>
              <select
                value={recurTransactionType}
                onChange={(e) => setRecurTransactionType(e.target.value)}
                style={inputStyle}
              >
                {recurringTypeOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.icon} {t.name}
                  </option>
                ))}
              </select>
            </div>
            <BillScheduleFields
              frequency={recurFrequency}
              dueDay={recurDue}
              onFrequencyChange={setRecurFrequency}
              onDueDayChange={setRecurDue}
              inputStyle={inputStyle}
            />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
              <TransactionRoutingFields
                type={recurTransactionType}
                accounts={accounts}
                goals={goals}
                fromAccountId={recurFromAccountId}
                toAccountId={recurToAccountId}
                goalId={recurGoalId}
                onFromAccountId={setRecurFromAccountId}
                onToAccountId={setRecurToAccountId}
                onGoalId={setRecurGoalId}
                storeForFlow={ledgerStore}
              />
            </div>
            <button type="submit" style={{ padding: "8px 14px", borderRadius: "var(--radius-ctrl)", border: "none", background: "var(--ink)", color: "#fff", fontWeight: 600, cursor: "pointer", alignSelf: "flex-start" }}>
              Add recurring transaction
            </button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.45, margin: 0 }}>
              Custom types appear when you add or edit transactions on the calendar and Transactions page.
            </p>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <EmojiIconPicker value={typeIcon} onChange={setTypeIcon} />
              <div className="fety-form-desc" style={{ flex: "1 1 200px", minWidth: 160 }}>
                <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Type name</label>
                <input value={typeName} onChange={(e) => setTypeName(e.target.value)} style={inputStyle} placeholder="Refund" />
              </div>
              <div style={{ flex: "0 1 220px", minWidth: 160 }}>
                <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Money direction</label>
                <select value={typeFlow} onChange={(e) => setTypeFlow(e.target.value as TransactionFlow)} style={inputStyle}>
                  <option value="expense">Money out (expense)</option>
                  <option value="income">Money in (income)</option>
                  <option value="bill">Bill / recurring due</option>
                  <option value="transfer">Transfer (neutral)</option>
                </select>
              </div>
            </div>
            <button type="submit" style={{ padding: "8px 14px", borderRadius: "var(--radius-ctrl)", border: "none", background: "var(--ink)", color: "#fff", fontWeight: 600, cursor: "pointer", alignSelf: "flex-start" }}>
              Add type
            </button>
          </>
        )}
      </form>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px" }}>
        <p className="fety-label-strong" style={{ marginBottom: 12 }}>Bills</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {bills.map((b) => {
            const isEditing = editingBillId === b.id && billEditDraft;
            return (
              <div key={b.id} style={{ padding: "12px 14px", border: "1px solid var(--border-soft)", borderRadius: 12 }}>
                {isEditing ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
                      <EmojiIconPicker
                        value={billEditDraft.icon}
                        onChange={(icon) => setBillEditDraft((d) => (d ? { ...d, icon } : d))}
                      />
                      <div className="fety-form-desc" style={{ flex: "1 1 160px", minWidth: 140 }}>
                        <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Bill name</label>
                        <input
                          value={billEditDraft.name}
                          onChange={(e) => setBillEditDraft((d) => (d ? { ...d, name: e.target.value } : d))}
                          style={inputStyle}
                          autoFocus
                        />
                      </div>
                      <div style={{ flex: "0 1 140px", minWidth: 120 }}>
                        <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Amount</label>
                        <CurrencyInput value={billEditDraft.amount} onChange={(amount) => setBillEditDraft((d) => (d ? { ...d, amount } : d))} />
                      </div>
                      <div style={{ flex: "0 1 140px", minWidth: 120 }}>
                        <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Category</label>
                        <input
                          value={billEditDraft.category}
                          onChange={(e) => setBillEditDraft((d) => (d ? { ...d, category: e.target.value } : d))}
                          style={inputStyle}
                        />
                      </div>
                    </div>
                    <BillScheduleFields
                      compact
                      frequency={billEditDraft.frequency}
                      dueDay={billEditDraft.dueDay}
                      onFrequencyChange={(frequency) => setBillEditDraft((d) => (d ? { ...d, frequency } : d))}
                      onDueDayChange={(dueDay) => setBillEditDraft((d) => (d ? { ...d, dueDay } : d))}
                      inputStyle={inputStyle}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={saveEditBill}
                        style={{ padding: "6px 14px", borderRadius: "var(--radius-ctrl)", border: "none", background: "var(--ink)", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditBill}
                        style={{ padding: "6px 14px", borderRadius: "var(--radius-ctrl)", border: "1px solid var(--border)", background: "transparent", fontSize: 11, cursor: "pointer" }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteBill(b.id);
                          cancelEditBill();
                        }}
                        style={{
                          marginLeft: "auto",
                          border: "none",
                          background: "transparent",
                          color: "var(--trouble-dk)",
                          cursor: "pointer",
                          fontSize: 11,
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{b.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{b.name}</p>
                      <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>
                        {usd(b.amount)} · {b.category} · {billDueSummary(b)}
                      </p>
                    </div>
                    <button type="button" onClick={() => startEditBill(b)} style={editBtnStyle}>
                      Edit
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {bills.length === 0 && (
            <p style={{ fontSize: 12, color: "var(--ink-3)", margin: 0 }}>No bills yet — add one above.</p>
          )}
        </div>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px" }}>
        <p className="fety-label-strong" style={{ marginBottom: 12 }}>Income streams</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {incomeStreams.map((s) => {
            const isEditing = editingIncomeId === s.id && incomeEditDraft;
            return (
              <div key={s.id} style={{ padding: "12px 14px", border: "1px solid var(--border-soft)", borderRadius: 12 }}>
                {isEditing ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
                      <EmojiIconPicker
                        value={incomeEditDraft.icon}
                        onChange={(icon) => setIncomeEditDraft((d) => (d ? { ...d, icon } : d))}
                      />
                      <div className="fety-form-desc" style={{ flex: "1 1 160px", minWidth: 140 }}>
                        <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Name</label>
                        <input
                          value={incomeEditDraft.name}
                          onChange={(e) => setIncomeEditDraft((d) => (d ? { ...d, name: e.target.value } : d))}
                          style={inputStyle}
                          autoFocus
                        />
                      </div>
                      <div style={{ flex: "0 1 140px", minWidth: 120 }}>
                        <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Amount</label>
                        <CurrencyInput value={incomeEditDraft.amount} onChange={(amount) => setIncomeEditDraft((d) => (d ? { ...d, amount } : d))} />
                      </div>
                      <div style={{ flex: "0 1 140px", minWidth: 120 }}>
                        <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Category</label>
                        <input
                          value={incomeEditDraft.category}
                          onChange={(e) => setIncomeEditDraft((d) => (d ? { ...d, category: e.target.value } : d))}
                          style={inputStyle}
                        />
                      </div>
                    </div>
                    <IncomeScheduleFields
                      compact
                      frequency={incomeEditDraft.frequency}
                      dueDay={incomeEditDraft.dueDay}
                      semiMonthlyDays={incomeEditDraft.semiMonthlyDays}
                      startDateISO={incomeEditDraft.startDateISO}
                      endDateISO={incomeEditDraft.endDateISO}
                      onFrequencyChange={(frequency) => setIncomeEditDraft((d) => (d ? { ...d, frequency } : d))}
                      onDueDayChange={(dueDay) => setIncomeEditDraft((d) => (d ? { ...d, dueDay } : d))}
                      onSemiMonthlyDaysChange={(semiMonthlyDays) =>
                        setIncomeEditDraft((d) => (d ? { ...d, semiMonthlyDays } : d))
                      }
                      onStartDateISOChange={(startDateISO) =>
                        setIncomeEditDraft((d) => (d ? { ...d, startDateISO } : d))
                      }
                      onEndDateISOChange={(endDateISO) => setIncomeEditDraft((d) => (d ? { ...d, endDateISO } : d))}
                      inputStyle={inputStyle}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" onClick={saveEditIncome} style={{ padding: "6px 14px", borderRadius: "var(--radius-ctrl)", border: "none", background: "var(--ink)", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                        Save
                      </button>
                      <button type="button" onClick={cancelEditIncome} style={{ padding: "6px 14px", borderRadius: "var(--radius-ctrl)", border: "1px solid var(--border)", background: "transparent", fontSize: 11, cursor: "pointer" }}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteIncomeStream(s.id);
                          cancelEditIncome();
                        }}
                        style={{ marginLeft: "auto", border: "none", background: "transparent", color: "var(--trouble-dk)", cursor: "pointer", fontSize: 11 }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{s.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{s.name}</p>
                      <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>
                        {usd(s.amount)} · {s.category} · {incomeDueSummary(s)}
                      </p>
                    </div>
                    <button type="button" onClick={() => startEditIncome(s)} style={editBtnStyle}>
                      Edit
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {incomeStreams.length === 0 && (
            <p style={{ fontSize: 12, color: "var(--ink-3)", margin: 0 }}>No income streams — add paychecks or other recurring deposits above.</p>
          )}
        </div>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px" }}>
        <p className="fety-label-strong" style={{ marginBottom: 12 }}>Recurring transactions</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {recurringTransactions.map((r) => {
            const isEditing = editingRecurId === r.id && recurEditDraft;
            return (
              <div key={r.id} style={{ padding: "12px 14px", border: "1px solid var(--border-soft)", borderRadius: 12 }}>
                {isEditing ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
                      <EmojiIconPicker
                        value={recurEditDraft.icon}
                        onChange={(icon) => setRecurEditDraft((d) => (d ? { ...d, icon } : d))}
                      />
                      <div className="fety-form-desc" style={{ flex: "1 1 160px", minWidth: 140 }}>
                        <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Name</label>
                        <input
                          value={recurEditDraft.name}
                          onChange={(e) => setRecurEditDraft((d) => (d ? { ...d, name: e.target.value } : d))}
                          style={inputStyle}
                          autoFocus
                        />
                      </div>
                      <div style={{ flex: "0 1 140px", minWidth: 120 }}>
                        <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Amount</label>
                        <CurrencyInput value={recurEditDraft.amount} onChange={(amount) => setRecurEditDraft((d) => (d ? { ...d, amount } : d))} />
                      </div>
                      <div style={{ flex: "0 1 140px", minWidth: 120 }}>
                        <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Category</label>
                        <input
                          value={recurEditDraft.category}
                          onChange={(e) => setRecurEditDraft((d) => (d ? { ...d, category: e.target.value } : d))}
                          style={inputStyle}
                        />
                      </div>
                      <div style={{ flex: "0 1 180px", minWidth: 140 }}>
                        <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Type</label>
                        <select
                          value={recurEditDraft.transactionType}
                          onChange={(e) => setRecurEditDraft((d) => (d ? { ...d, transactionType: e.target.value } : d))}
                          style={inputStyle}
                        >
                          {recurringTypeOptions.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.icon} {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                      <TransactionRoutingFields
                type={recurEditDraft.transactionType}
                accounts={accounts}
                goals={goals}
                        fromAccountId={recurEditDraft.fromAccountId}
                        toAccountId={recurEditDraft.toAccountId}
                        goalId={recurEditDraft.goalId}
                        onFromAccountId={(fromAccountId) => setRecurEditDraft((d) => (d ? { ...d, fromAccountId } : d))}
                        onToAccountId={(toAccountId) => setRecurEditDraft((d) => (d ? { ...d, toAccountId } : d))}
                        onGoalId={(goalId) => setRecurEditDraft((d) => (d ? { ...d, goalId } : d))}
                        storeForFlow={ledgerStore}
                      />
                    </div>
                    <BillScheduleFields
                      compact
                      frequency={recurEditDraft.frequency}
                      dueDay={recurEditDraft.dueDay}
                      onFrequencyChange={(frequency) => setRecurEditDraft((d) => (d ? { ...d, frequency } : d))}
                      onDueDayChange={(dueDay) => setRecurEditDraft((d) => (d ? { ...d, dueDay } : d))}
                      inputStyle={inputStyle}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" onClick={saveEditRecur} style={{ padding: "6px 14px", borderRadius: "var(--radius-ctrl)", border: "none", background: "var(--ink)", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                        Save
                      </button>
                      <button type="button" onClick={cancelEditRecur} style={{ padding: "6px 14px", borderRadius: "var(--radius-ctrl)", border: "1px solid var(--border)", background: "transparent", fontSize: 11, cursor: "pointer" }}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteRecurringTransaction(r.id);
                          cancelEditRecur();
                        }}
                        style={{ marginLeft: "auto", border: "none", background: "transparent", color: "var(--trouble-dk)", cursor: "pointer", fontSize: 11 }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{r.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{r.name}</p>
                      <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>
                        {usd(r.amount)} · {r.category} · {typeLabel(r.transactionType)} · {scheduleDueSummary(r)}
                      </p>
                    </div>
                    <button type="button" onClick={() => startEditRecur(r)} style={editBtnStyle}>
                      Edit
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {recurringTransactions.length === 0 && (
            <p style={{ fontSize: 12, color: "var(--ink-3)", margin: 0 }}>No recurring transactions yet.</p>
          )}
        </div>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px" }}>
        <p className="fety-label-strong" style={{ marginBottom: 6 }}>Transaction types</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {transactionTypes.map((tt) => {
            const inUse = transactionTypeInUse(tt.id);
            const isEditing = editingTypeId === tt.id && typeEditDraft;
            return (
              <div key={tt.id} style={{ padding: "12px 14px", border: "1px solid var(--border-soft)", borderRadius: 12 }}>
                {isEditing ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
                      <EmojiIconPicker
                        value={typeEditDraft.icon}
                        onChange={(icon) => setTypeEditDraft((d) => (d ? { ...d, icon } : d))}
                      />
                      <div className="fety-form-desc" style={{ flex: "1 1 200px", minWidth: 160 }}>
                        <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Name</label>
                        <input
                          value={typeEditDraft.name}
                          onChange={(e) => setTypeEditDraft((d) => (d ? { ...d, name: e.target.value } : d))}
                          style={inputStyle}
                          autoFocus
                        />
                      </div>
                      <div style={{ flex: "0 1 200px", minWidth: 160 }}>
                        <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Money direction</label>
                        <select
                          value={typeEditDraft.flow}
                          disabled={tt.locked}
                          onChange={(e) =>
                            setTypeEditDraft((d) => (d ? { ...d, flow: e.target.value as TransactionFlow } : d))
                          }
                          style={inputStyle}
                        >
                          <option value="income">Money in (income)</option>
                          <option value="expense">Money out (expense)</option>
                          <option value="bill">Bill / recurring due</option>
                          <option value="transfer">Transfer (neutral)</option>
                        </select>
                      </div>
                    </div>
                    {tt.locked && (
                      <p style={{ fontSize: 10, color: "var(--ink-3)" }}>Core type — direction is fixed; you can rename and change the icon.</p>
                    )}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={saveEditTransactionType}
                        style={{ padding: "6px 14px", borderRadius: "var(--radius-ctrl)", border: "none", background: "var(--ink)", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditTransactionType}
                        style={{ padding: "6px 14px", borderRadius: "var(--radius-ctrl)", border: "1px solid var(--border)", background: "transparent", fontSize: 11, cursor: "pointer" }}
                      >
                        Cancel
                      </button>
                      {!tt.locked && (
                        <button
                          type="button"
                          title={inUse ? "Remove after deleting transactions that use this type" : "Remove type"}
                          disabled={inUse}
                          onClick={() => {
                            onDeleteTransactionType(tt.id);
                            cancelEditTransactionType();
                          }}
                          style={{
                            marginLeft: "auto",
                            border: "none",
                            background: "transparent",
                            color: inUse ? "var(--ink-3)" : "var(--trouble-dk)",
                            cursor: inUse ? "not-allowed" : "pointer",
                            fontSize: 11,
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{tt.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{tt.name}</p>
                      <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>
                        {FLOW_LABELS[tt.flow]}
                        {tt.locked ? " · Core type" : ""}
                      </p>
                    </div>
                    <button type="button" onClick={() => startEditTransactionType(tt)} style={editBtnStyle}>
                      Edit
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function TransactionsManageView({
  transactions,
  categories,
  transactionTypes,
  accounts,
  goals,
  typeIcons,
  viewMode,
  onAdd,
  onUpdate,
  onDelete,
}: {
  transactions: Transaction[];
  categories: BudgetCategory[];
  transactionTypes: FetyTransactionType[];
  accounts: Account[];
  goals: Goal[];
  typeIcons: import("../types/fety").TypeIconMap;
  viewMode: ViewMode;
  onAdd: (input: {
    desc: string;
    amount: number;
    type: TransactionType;
    category: string;
    dateISO?: string;
    icon?: string;
    fromAccountId?: string;
    toAccountId?: string;
    goalId?: string;
  }) => void;
  onUpdate: (
    id: string,
    updates: Partial<
      Pick<Transaction, "desc" | "amount" | "type" | "category" | "dateISO" | "icon" | "fromAccountId" | "toAccountId" | "goalId">
    >,
  ) => void;
  onDelete: (id: string) => void;
}) {
  const ledgerStore = { accounts, goals, transactionTypes, typeIcons, transactions, profile: { startingBalance: 0, displayName: "", email: "", currency: "USD" } } as import("../types/fety").FetyStore;
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
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [goalId, setGoalId] = useState("");
  const [editFromAccountId, setEditFromAccountId] = useState("");
  const [editToAccountId, setEditToAccountId] = useState("");
  const [editGoalId, setEditGoalId] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    if (!isTransferTransactionType(ledgerStore, type)) {
      setFromAccountId("");
      setToAccountId("");
    }
  }, [type, transactionTypes, typeIcons]);

  const shown =
    filter === "All"
      ? transactions
      : transactions.filter((t) => {
          const tt = transactionTypes.find((x) => x.id === t.type);
          return tt?.name === filter || t.type === filter;
        });
  const filterLabels = ["All", ...transactionTypes.map((t) => t.name)];
  const byDateISO: Record<string, Transaction[]> = {};
  shown.forEach((t) => {
    (byDateISO[t.dateISO] ||= []).push(t);
  });
  const dateGroups = Object.entries(byDateISO).sort(([a], [b]) => {
    const today = todayISO();
    const aFuture = a > today;
    const bFuture = b > today;
    if (aFuture !== bFuture) return aFuture ? 1 : -1;
    if (aFuture) return a.localeCompare(b);
    return b.localeCompare(a);
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    const n = parseFloat(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setAddError("Enter an amount greater than zero.");
      return;
    }
    const flow = flowForTransactionType(ledgerStore, type);
    const description =
      desc.trim() ||
      (flow === "transfer" ? `Transfer — ${category}` : flow === "income" ? `Income — ${category}` : "");
    if (!description) {
      setAddError("Add a short description (or pick a category for transfers).");
      return;
    }
    onAdd({
      desc: description,
      amount: n,
      type,
      category,
      dateISO,
      icon: addIcon.trim() || undefined,
      fromAccountId: fromAccountId || undefined,
      toAccountId: toAccountId || undefined,
      goalId: goalId || undefined,
    });
    setDesc("");
    setAmount("");
    setAddIcon("");
    setFromAccountId("");
    setToAccountId("");
    setGoalId("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {accounts.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.45, padding: "12px 14px", background: "var(--bg)", borderRadius: 12, border: "1px solid var(--border-soft)" }}>
          Choose <strong style={{ fontWeight: 600 }}>Apply to goal</strong> below to update Goals progress. For transfers, pick type{" "}
          <strong style={{ fontWeight: 600 }}>Transfer</strong> to reveal account from/to fields (add accounts in Settings first).
        </p>
      ) : null}
      <form onSubmit={submit} className="fety-txn-add-form" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px" }}>
        <p className="fety-label-strong" style={{ marginBottom: 4 }}>Add transaction</p>
        <p style={{ fontSize: 10, color: "var(--ink-3)", marginBottom: 8 }}>
          Build {APP_BUILD_LABEL} · Transfer type shows account fields · all types can link a goal below
        </p>
        {addError ? (
          <p style={{ fontSize: 12, color: "var(--trouble-dk)", marginBottom: 8 }} role="alert">
            {addError}
          </p>
        ) : null}
        <div className="fety-txn-add-form__row">
          <EmojiIconPicker value={addIcon} defaultEmoji={iconForType(type)} onChange={setAddIcon} />
          <div className="fety-form-desc">
            <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Description</label>
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              style={inputStyle}
              placeholder={flowForTransactionType(ledgerStore, type) === "transfer" ? "Optional for transfers" : "Required"}
            />
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
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Date</label>
            <input type="date" value={dateISO} onChange={(e) => setDateISO(e.target.value)} style={inputStyle} />
          </div>
        </div>
        <div className="fety-txn-add-form__routing">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <TransactionRoutingFields
              type={type}
              accounts={accounts}
              goals={goals}
              fromAccountId={fromAccountId}
              toAccountId={toAccountId}
              goalId={goalId}
              onFromAccountId={setFromAccountId}
              onToAccountId={setToAccountId}
              onGoalId={setGoalId}
              storeForFlow={ledgerStore}
            />
          </div>
        </div>
        <button
          type="submit"
          style={{
            padding: "8px 14px",
            borderRadius: "var(--radius-ctrl)",
            border: "none",
            background: "var(--ink)",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
            alignSelf: "flex-start",
          }}
        >
          Save transaction
        </button>
      </form>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {filterLabels.map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} style={{ padding: "6px 14px", borderRadius: 99, fontSize: 12, border: "1px solid var(--border)", cursor: "pointer", background: filter === f ? "var(--ink)" : "var(--surface)", color: filter === f ? "#fff" : "var(--ink-2)" }}>{f}</button>
        ))}
      </div>

      <div style={{ background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)", overflow: "hidden" }}>
        {dateGroups.map(([dateISO, txns], gi) => (
          <div key={dateISO}>
            <div style={{ padding: "9px 18px", background: "var(--bg)", borderTop: gi > 0 ? "1px solid var(--border)" : undefined }}>
              <span className="fety-label">{formatTransactionGroupDate(dateISO)}</span>
            </div>
            {txns.map((t) => {
              const detail = formatTransactionDetailLine(t, { ...ledgerStore, transactions });
              return (
              <div key={t.id} style={{ display: "flex", alignItems: "center", padding: "12px 18px", borderTop: "1px solid var(--border)", gap: 12 }}>
                {editId === t.id ? (
                  <div style={{ flex: 1, display: "grid", gridTemplateColumns: "auto minmax(140px, 2.5fr) minmax(100px, 1fr) minmax(100px, 1fr) minmax(100px, 1fr) auto auto", gap: 8, alignItems: "end", overflow: "visible", position: "relative", zIndex: 2 }}>
                    <EmojiIconPicker
                      value={editIcon}
                      defaultEmoji={iconForType(editType)}
                      onChange={setEditIcon}
                      compact
                    />
                    <div className="fety-form-desc">
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
                    <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
                      <TransactionRoutingFields
                        type={editType}
                        accounts={accounts}
                        goals={goals}
                        fromAccountId={editFromAccountId}
                        toAccountId={editToAccountId}
                        goalId={editGoalId}
                        onFromAccountId={setEditFromAccountId}
                        onToAccountId={setEditToAccountId}
                        onGoalId={setEditGoalId}
                        storeForFlow={ledgerStore}
                      />
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
                            fromAccountId: editFromAccountId || undefined,
                            toAccountId: editToAccountId || undefined,
                            goalId: editGoalId || undefined,
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
                      <p style={{ fontSize: 10, color: "var(--ink-3)" }}>
                        {t.category}
                        {detail ? ` · ${detail}` : ""}
                      </p>
                    </div>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color:
                          flowForTransactionType(ledgerStore, t.type) === "transfer"
                            ? "var(--ink-2)"
                            : t.amount >= 0
                              ? "var(--clear-dk)"
                              : "var(--trouble-dk)",
                      }}
                    >
                      {flowForTransactionType(ledgerStore, t.type) === "transfer"
                        ? usdF(Math.abs(t.amount))
                        : `${t.amount >= 0 ? "+" : ""}${usdF(t.amount)}`}
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
                        setEditFromAccountId(t.fromAccountId ?? "");
                        setEditToAccountId(t.toAccountId ?? "");
                        setEditGoalId(t.goalId ?? "");
                      }}
                      style={{ border: "none", background: "transparent", color: "var(--ink-3)", cursor: "pointer", fontSize: 11 }}
                    >
                      Edit
                    </button>
                    <button type="button" onClick={() => onDelete(t.id)} style={{ border: "none", background: "transparent", color: "var(--ink-3)", cursor: "pointer", fontSize: 11 }}>Delete</button>
                  </>
                )}
              </div>
              );
            })}
          </div>
        ))}
        {shown.length === 0 && <p style={{ padding: 24, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>No transactions yet.</p>}
      </div>
    </div>
  );
}

export function GoalsManageView({
  goals,
  goalLedgerStore,
  viewMode,
  onAdd,
  onUpdate,
  onDelete,
}: {
  goals: Goal[];
  goalLedgerStore: import("../types/fety").FetyStore;
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
  const [editTargetDate, setEditTargetDate] = useState("");
  const [editMonthly, setEditMonthly] = useState("");
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [saved, setSaved] = useState("");
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
    setSaved("");
    setTargetDate("");
    setMonthly("");
    setShowForm(false);
  };

  const startEditGoal = (g: Goal) => {
    setEditGoalId(g.id);
    setEditName(g.name);
    setEditSaved(g.saved === 0 ? "" : String(g.saved));
    setEditTarget(g.target === 0 ? "" : String(g.target));
    setEditTargetDate(g.targetDate === "TBD" ? "" : g.targetDate);
    setEditMonthly(g.monthlyContribution === 0 ? "" : String(g.monthlyContribution));
  };

  const cancelEditGoal = () => {
    setEditGoalId(null);
  };

  const saveEditGoal = (id: string) => {
    const t = parseFloat(editTarget);
    const s = parseFloat(editSaved);
    if (!editName.trim() || !Number.isFinite(t)) return;
    onUpdate(id, {
      name: editName.trim(),
      target: t,
      saved: Number.isFinite(s) ? s : 0,
      targetDate: editTargetDate.trim() || "TBD",
      monthlyContribution: parseFloat(editMonthly) || 0,
    });
    setEditGoalId(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.45, maxWidth: 560 }}>
        Progress includes <strong style={{ fontWeight: 600 }}>Starting saved</strong> plus any transaction you link with{" "}
        <strong style={{ fontWeight: 600 }}>Apply to goal</strong> on the Transactions page (or calendar).
      </p>
      <div style={{ display: "grid", gridTemplateColumns: viewMode === "cards" ? "repeat(auto-fill, minmax(280px, 1fr))" : "1fr", gap: 12 }}>
        {goals.map((g) => {
          const savedTotal = goalSavedTotal(goalLedgerStore, g);
          const fromTx = goalContributionsFromTransactions(goalLedgerStore, g.id);
          const pct = g.target > 0 ? Math.round((savedTotal / g.target) * 100) : 0;
          const editing = editGoalId === g.id;
          return (
            <div
              key={g.id}
              style={{
                background: "var(--surface)",
                borderRadius: 16,
                padding: "20px 22px",
                border: "1px solid var(--border)",
                minWidth: 0,
                overflow: "hidden",
              }}
            >
              {editing ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Goal Name</label>
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} style={inputStyle} placeholder="Goal name" />
                  </div>
                  <div>
                    <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Target Amount</label>
                    <CurrencyInput value={editTarget} onChange={setEditTarget} placeholder="0.00" />
                  </div>
                  <div>
                    <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Starting saved</label>
                    <CurrencyInput value={editSaved} onChange={setEditSaved} placeholder="0.00" />
                  </div>
                  <div>
                    <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Target date</label>
                    <input value={editTargetDate} onChange={(e) => setEditTargetDate(e.target.value)} style={inputStyle} placeholder="Dec 2026" />
                  </div>
                  <div>
                    <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Monthly Contribution</label>
                    <CurrencyInput value={editMonthly} onChange={setEditMonthly} placeholder="0.00" />
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={() => saveEditGoal(g.id)}
                      style={{ padding: "6px 14px", borderRadius: "var(--radius-ctrl)", border: "none", background: "var(--ink)", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditGoal}
                      style={{ padding: "6px 14px", borderRadius: "var(--radius-ctrl)", border: "1px solid var(--border)", background: "transparent", fontSize: 11, cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onDelete(g.id);
                        cancelEditGoal();
                      }}
                      style={{ marginLeft: "auto", border: "none", background: "transparent", color: "var(--trouble-dk)", cursor: "pointer", fontSize: 11 }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>{g.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{g.name}</p>
                      <p style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}>Target {g.targetDate}</p>
                    </div>
                    <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                      <button type="button" onClick={() => startEditGoal(g)} title="Edit" style={{ ...tileIconBtn, color: "var(--ink-3)" }}>
                        ✎
                      </button>
                      <button type="button" onClick={() => onDelete(g.id)} title="Remove" style={{ ...tileIconBtn, color: "var(--trouble-dk)" }}>
                        ×
                      </button>
                    </div>
                  </div>
                  <p style={{ fontSize: 18, fontWeight: 400, color: "var(--ink)" }}>
                    {usd(savedTotal)} <span style={{ fontSize: 12, color: "var(--ink-3)" }}>of {usd(g.target)}</span>
                  </p>
                  {fromTx > 0 ? (
                    <p style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}>{usd(fromTx)} from linked transactions</p>
                  ) : null}
                  <p style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 8 }}>{pct}% of target</p>
                  <div style={{ height: 6, background: "var(--paper)", borderRadius: 99, marginTop: 8, overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: "var(--later)" }} />
                  </div>
                </>
              )}
            </div>
          );
        })}
        <button type="button" onClick={() => setShowForm(true)} style={{ background: "transparent", borderRadius: 16, padding: "20px", border: "2px dashed var(--border)", cursor: "pointer", minHeight: 120 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-3)" }}>Add a goal</p>
        </button>
      </div>
      {showForm && (
        <form
          onSubmit={submit}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: 18,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <p className="fety-label-strong" style={{ margin: 0 }}>New goal</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, alignItems: "end" }}>
            <div className="fety-form-desc">
              <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Goal Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="Emergency fund" />
            </div>
            <div>
              <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Target Amount</label>
              <CurrencyInput value={target} onChange={setTarget} placeholder="0.00" />
            </div>
            <div>
              <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Starting saved</label>
              <CurrencyInput value={saved} onChange={setSaved} placeholder="0.00" />
            </div>
            <div>
              <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Target date</label>
              <input value={targetDate} onChange={(e) => setTargetDate(e.target.value)} style={inputStyle} placeholder="Dec 2026" />
            </div>
            <div>
              <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Monthly Contribution</label>
              <CurrencyInput value={monthly} onChange={setMonthly} placeholder="0.00" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" style={{ padding: "8px 14px", border: "none", background: "var(--ink)", color: "#fff", borderRadius: "var(--radius-ctrl)", cursor: "pointer", fontWeight: 600 }}>
              Create goal
            </button>
            <button type="button" onClick={() => setShowForm(false)} style={{ padding: "8px 14px", border: "1px solid var(--border)", background: "transparent", borderRadius: "var(--radius-ctrl)", cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function SettingsManageView({
  profile,
  accounts,
  ledgerStore,
  onUpdateProfile,
  onUpdateAccount,
  onAddAccount,
  onDeleteAccount,
  onReset,
  onRestartSetup,
}: {
  profile: { displayName: string; email: string; currency: string; startingBalance: number };
  accounts: Account[];
  ledgerStore: import("../types/fety").FetyStore;
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
          Track where your money lives. Opening balance plus linked transactions update the current balance shown below.
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
                      label="Opening balance"
                      value={a.balance}
                      format={usdF}
                      currency
                      allowNegative
                      onSave={(balance) => onUpdateAccount(a.id, { balance })}
                      valueStyle={{ fontSize: 18 }}
                    />
                    <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 6 }}>
                      Current balance:{" "}
                      <span style={{ fontWeight: 600, color: "var(--ink-2)" }}>{usdF(accountBalanceWithTransactions(ledgerStore, a.id))}</span>
                    </p>
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
      <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 8 }}>
        App build: <code style={{ fontSize: 10 }}>{APP_BUILD_LABEL}</code>
        {" · "}
        If features are missing, refresh the Figma Make preview or sync the latest Git commit.
      </p>
    </div>
  );
}
