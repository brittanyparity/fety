import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import AddTransactionModal, { type AddTransactionModalActions } from "../components/AddTransactionModal";
import TransactionDateRangeFilter from "../components/TransactionDateRangeFilter";
import TransactionAccountFields from "../components/TransactionAccountFields";
import TransactionCategorySelect from "../components/TransactionCategorySelect";
import {
  filterBudgetCategories,
  filterPickerGroupsForFlow,
  resolveTransactionCategory,
  allTransactionCategoryNames,
  isRetiredCategoryName,
  transactionCategoryPickerGroups,
} from "../lib/transactionCategories";
import { computeScheduledKindProgress } from "../lib/scheduledKindProgress";
import ScheduledKindProgressTile from "./budget/ScheduledKindProgressTile";
import type {
  Account,
  AccountKind,
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
  TransactionType,
} from "../types/fety";
import { endingBalanceOnDate, formatTransactionGroupDate, todayISO } from "../lib/fetyCalculations";
import { EditableNumber, EditableText } from "../components/EditableField";
import EmojiIconPicker from "../components/EmojiIconPicker";
import BillScheduleFields from "../components/BillScheduleFields";
import IncomeScheduleFields from "../components/IncomeScheduleFields";
import { BILL_FREQUENCY_LABELS, INCOME_FREQUENCY_LABELS } from "../lib/billScheduling";
import { flowForTransactionType, labelForTransactionType } from "../lib/transactionTypes";
import { accountBalanceWithTransactions, accountActivityForAccount, accountBalanceAsOfISO, accountKind, formatAccountBalanceDisplay, formatTransactionCategoryTypeLines, formatTransactionDetailLine, goalContributionsFromTransactions, goalSavedTotal, goalsLinkedToAccount, isDebtAccount, netWorthTotals, normalizeAccountOpeningBalance, transactionListPrimaryTitle } from "../lib/ledger";
import CurrencyInput, { amountToEditString } from "../components/CurrencyInput";
import { formatGoalByline, goalPaceStatus, goalTargetDateForDateInput } from "../lib/goalProgress";
import { formatOrdinalDay } from "../lib/scheduleFormatting";

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const usdF = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const usdGoal = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function accountBalanceAsOfLabel(kind: AccountKind): string {
  return kind === "debt" ? "Debt balance as of" : "Balance as of";
}

function accountOpeningBaselineCopy(account: Account, store: import("../types/fety").FetyStore): string {
  const asOf = accountBalanceAsOfISO(account, store);
  const amount = formatAccountBalanceDisplay(account, account.balance);
  return isDebtAccount(account)
    ? `Baseline ${amount} · tracked from ${asOf}`
    : `Opening ${amount} as of ${asOf}`;
}

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

const { padding: _inputStylePadding, background: _inputStyleBg, ...inputStyleShell } = inputStyle;

type ViewMode = "cards" | "list";

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
        className="fety-transaction-goal-select"
        value={validGoalId}
        onChange={(e) => onGoalId(e.target.value)}
        style={inputStyleShell}
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
  spreadTransfer,
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
  spreadTransfer?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
      <TransactionAccountFields
        store={storeForFlow}
        transactionType={type}
        accounts={accounts}
        fromAccountId={fromAccountId}
        toAccountId={toAccountId}
        onFromAccountId={onFromAccountId}
        onToAccountId={onToAccountId}
        inputStyle={inputStyle}
        spreadTransfer={spreadTransfer}
      />
      <TransactionGoalSelect goals={goals} goalId={goalId} onGoalId={onGoalId} />
    </div>
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

function budgetCategoryBarState(spent: number, budget: number) {
  const over = budget > 0 && spent > budget;
  const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : spent > 0 ? 100 : 0;
  const left = budget - spent;
  const tight = !over && budget > 0 && left <= 10;
  if (over) return { over: true, pct: 100, variant: "over" as const, left };
  if (tight) return { over: false, pct, variant: "tight" as const, left };
  return { over: false, pct, variant: "default" as const, left };
}

export function BudgetManageView({
  categories,
  bills,
  incomeStreams,
  recurringTransactions,
  transactions,
  profile,
  transactionTypes,
  viewMode,
  onUpdateBudget,
  onUpdateCategory,
  onAddCategory,
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
  highlightCategoryId,
  highlightBills,
  highlightTarget,
  accounts,
  goals,
  typeIcons,
}: {
  categories: CategoryWithSpent[];
  bills: Bill[];
  incomeStreams: IncomeStream[];
  recurringTransactions: RecurringTransaction[];
  transactions: Transaction[];
  profile: import("../types/fety").UserProfile;
  transactionTypes: FetyTransactionType[];
  viewMode: ViewMode;
  onUpdateBudget: (id: string, monthlyBudget: number) => void;
  onUpdateCategory: (id: string, updates: Partial<Pick<import("../types/fety").BudgetCategory, "monthlyBudget" | "goalId">>) => void;
  onAddCategory: (input: { name: string; icon: string; monthlyBudget: number; goalId?: string }) => void;
  onDeleteCategory: (id: string) => void;
  onUpdateBill: (id: string, updates: Partial<Pick<Bill, "name" | "amount" | "dueDay" | "frequency" | "category" | "icon" | "fromAccountId">>) => void;
  onAddBill: (bill: Omit<Bill, "id">) => void;
  onDeleteBill: (id: string) => void;
  onUpdateIncomeStream: (
    id: string,
    updates: Partial<
      Pick<
        IncomeStream,
        "name" | "amount" | "dueDay" | "frequency" | "category" | "icon" | "startDateISO" | "endDateISO" | "semiMonthlyDays" | "toAccountId"
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
  highlightCategoryId?: string;
  highlightBills?: boolean;
  highlightTarget?: string | null;
  accounts: Account[];
  goals: Goal[];
  typeIcons: import("../types/fety").TypeIconMap;
}) {
  const ledgerStore = { accounts, goals, transactionTypes, typeIcons } as import("../types/fety").FetyStore;
  const [billName, setBillName] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billDue, setBillDue] = useState(1);
  const [billFrequency, setBillFrequency] = useState<BillFrequency>("monthly");
  const [billFromAccountId, setBillFromAccountId] = useState("");
  const [budgetAddMode, setBudgetAddMode] = useState<"bill" | "income" | "recur">("bill");
  const [scheduledAddOpen, setScheduledAddOpen] = useState(false);
  const [editingCategoryCapId, setEditingCategoryCapId] = useState<string | null>(null);
  const [categoryCapDraft, setCategoryCapDraft] = useState("");
  const [categoryGoalDraft, setCategoryGoalDraft] = useState("");
  const [categoryAddOpen, setCategoryAddOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryIcon, setNewCategoryIcon] = useState("📁");
  const [newCategoryCap, setNewCategoryCap] = useState("");
  const [newCategoryGoalId, setNewCategoryGoalId] = useState("");

  useEffect(() => {
    if (!highlightCategoryId) return;
    const cat = categories.find((c) => c.id === highlightCategoryId);
    if (!cat) return;
    setEditingCategoryCapId(cat.id);
    setCategoryCapDraft(amountToEditString(cat.monthlyBudget));
    setCategoryGoalDraft(cat.goalId ?? "");
  }, [highlightCategoryId]); // categories looked up when the highlight target changes

  useEffect(() => {
    const id = highlightTarget
      || (highlightCategoryId ? `budget-category-${highlightCategoryId}` : null)
      || (highlightBills ? "budget-bills" : null);
    if (!id) return;
    const el = document.querySelector(`[data-tour-id="${id}"]`);
    if (el instanceof HTMLElement) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightTarget, highlightCategoryId, highlightBills]);
  const [incomeName, setIncomeName] = useState("");
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeDue, setIncomeDue] = useState(1);
  const [incomeToAccountId, setIncomeToAccountId] = useState("");
  const [incomeFrequency, setIncomeFrequency] = useState<IncomeFrequency>("biweekly");
  const [incomeSemiMonthlyDays, setIncomeSemiMonthlyDays] = useState<[number, number]>([1, 15]);
  const [incomeStartDate, setIncomeStartDate] = useState("");
  const [incomeEndDate, setIncomeEndDate] = useState("");
  const [recurName, setRecurName] = useState("");
  const [recurAmount, setRecurAmount] = useState("");
  const [recurDue, setRecurDue] = useState(1);
  const [recurFrequency, setRecurFrequency] = useState<BillFrequency>("monthly");
  const [recurTransactionType, setRecurTransactionType] = useState<TransactionType>("expense");
  const [recurFromAccountId, setRecurFromAccountId] = useState("");
  const [recurToAccountId, setRecurToAccountId] = useState("");
  const [recurGoalId, setRecurGoalId] = useState("");

  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [billEditDraft, setBillEditDraft] = useState<{
    name: string;
    amount: string;
    frequency: BillFrequency;
    dueDay: number;
    icon: string;
    fromAccountId: string;
  } | null>(null);

  const startEditBill = (b: Bill) => {
    setEditingBillId(b.id);
    setBillEditDraft({
      name: b.name,
      amount: b.amount === 0 ? "" : String(b.amount),
      frequency: b.frequency ?? "monthly",
      dueDay: b.dueDay,
      icon: b.icon || "📄",
      fromAccountId: b.fromAccountId ?? "",
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
      frequency: billEditDraft.frequency,
      dueDay: billEditDraft.dueDay,
      icon: billEditDraft.icon,
      fromAccountId: billEditDraft.fromAccountId || undefined,
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
    frequency: IncomeFrequency;
    dueDay: number;
    semiMonthlyDays: [number, number];
    startDateISO: string;
    endDateISO: string;
    icon: string;
    toAccountId: string;
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
      frequency: s.frequency ?? "monthly",
      dueDay: s.dueDay,
      semiMonthlyDays: s.semiMonthlyDays ?? [s.dueDay, 15],
      startDateISO: s.startDateISO ?? "",
      endDateISO: s.endDateISO ?? "",
      icon: s.icon || "💵",
      toAccountId: s.toAccountId ?? "",
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
      icon: incomeEditDraft.icon,
      toAccountId: incomeEditDraft.toAccountId || undefined,
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
    return `${freq} · on the ${formatOrdinalDay(item.dueDay)}`;
  };

  const billDueSummary = (b: Bill) => scheduleDueSummary(b);

  const incomeDueSummary = (s: IncomeStream) => {
    if (s.frequency === "semimonthly") {
      const [a, b] = s.semiMonthlyDays ?? [s.dueDay, 15];
      return `Twice a month · on the ${formatOrdinalDay(a)} & ${formatOrdinalDay(b)}`;
    }
    const freq = INCOME_FREQUENCY_LABELS[s.frequency ?? "monthly"];
    if (s.frequency === "weekly" || s.frequency === "biweekly") {
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return `${freq} · ${days[s.dueDay] ?? "Mon"}`;
    }
    return `${freq} · on the ${formatOrdinalDay(s.dueDay)}`;
  };

  const recurringTypeOptions = transactionTypes;
  const typeLabel = (id: TransactionType) => transactionTypes.find((t) => t.id === id)?.name ?? id;

  const budgetCategories = filterBudgetCategories(categories);
  const totalBudget = budgetCategories.reduce((s, c) => s + c.monthlyBudget, 0);
  const totalSpent = budgetCategories.reduce((s, c) => s + c.spent, 0);

  const scheduledKindProgress = useMemo(
    () =>
      computeScheduledKindProgress({
        bills,
        incomeStreams,
        recurringTransactions,
        transactions,
        profile,
        transactionTypes,
        typeIcons,
      }),
    [bills, incomeStreams, recurringTransactions, transactions, profile, transactionTypes, typeIcons],
  );
  const [billsProgress, incomeProgress, recurProgress] = scheduledKindProgress;

  const submitBill = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(billAmount);
    if (!billName.trim() || !Number.isFinite(amount)) return;
    onAddBill({
      name: billName.trim(),
      amount,
      dueDay: billDue,
      frequency: billFrequency,
      category: billName.trim(),
      icon: "📄",
      fromAccountId: billFromAccountId || undefined,
    });
    setBillName("");
    setBillAmount("");
    setBillDue(1);
    setBillFrequency("monthly");
    setBillFromAccountId("");
    setScheduledAddOpen(false);
  };

  const submitIncome = () => {
    const amount = parseFloat(incomeAmount);
    if (!incomeName.trim() || !Number.isFinite(amount)) return;
    onAddIncomeStream({
      name: incomeName.trim(),
      amount,
      category: incomeName.trim(),
      icon: "💵",
      toAccountId: incomeToAccountId || undefined,
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
    setIncomeToAccountId("");
    setScheduledAddOpen(false);
  };

  const submitRecur = () => {
    const amount = parseFloat(recurAmount);
    if (!recurName.trim() || !Number.isFinite(amount)) return;
    onAddRecurringTransaction({
      name: recurName.trim(),
      amount,
      dueDay: recurDue,
      frequency: recurFrequency,
      category: recurName.trim(),
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
    setScheduledAddOpen(false);
  };

  useEffect(() => {
    if (!scheduledAddOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setScheduledAddOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scheduledAddOpen]);

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

  const totalRemaining = totalBudget - totalSpent;

  const submitNewCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCategoryName.trim();
    const cap = newCategoryCap === "" ? 0 : parseFloat(newCategoryCap);
    if (!name || !Number.isFinite(cap)) return;
    onAddCategory({
      name,
      icon: newCategoryIcon.trim() || "📁",
      monthlyBudget: cap,
      goalId: newCategoryGoalId || undefined,
    });
    setNewCategoryName("");
    setNewCategoryIcon("📁");
    setNewCategoryCap("");
    setNewCategoryGoalId("");
    setCategoryAddOpen(false);
  };

  return (
    <div className="fety-budget-page">
      <div
        className={`fety-budget-summary-bar${highlightTarget === "budget-summary" ? " fety-tour-ring" : ""}`}
        data-tour-id="budget-summary"
      >
        <div className="fety-budget-summary-cell">
          <p className="fety-budget-summary-label">Monthly budget</p>
          <p className="fety-budget-summary-value">{usd(totalBudget)}</p>
        </div>
        <div className="fety-budget-summary-cell">
          <p className="fety-budget-summary-label">Spent so far</p>
          <p className="fety-budget-summary-value fety-budget-summary-value--with-marker">
            <span className="fety-budget-marker fety-budget-marker--spent" aria-hidden />
            {usd(totalSpent)}
          </p>
        </div>
        <div className="fety-budget-summary-cell">
          <p className="fety-budget-summary-label">Remaining</p>
          <p
            className={`fety-budget-summary-value fety-budget-summary-value--with-marker${totalRemaining < 0 ? " fety-budget-summary-value--over" : " fety-budget-summary-value--remaining"}`}
          >
            <span
              className={`fety-budget-marker${totalRemaining < 0 ? " fety-budget-marker--spent" : " fety-budget-marker--remaining"}`}
              aria-hidden
            />
            {usd(Math.abs(totalRemaining))}
          </p>
        </div>
      </div>

      <div className={`fety-budget-category-grid${viewMode === "list" ? " fety-budget-category-grid--list" : ""}`}>
        {budgetCategories.map((c) => {
          const bar = budgetCategoryBarState(c.spent, c.monthlyBudget);
          const editingCap = editingCategoryCapId === c.id;
          const linkedGoal = c.goalId ? goals.find((g) => g.id === c.goalId) : null;
          return (
            <div
              key={c.id}
              data-tour-id={`budget-category-${c.id}`}
              className={`fety-budget-category-tile${highlightCategoryId === c.id || highlightTarget === `budget-category-${c.id}` ? " fety-tour-ring" : ""}`}
            >
              <div className="fety-budget-category-tile-top">
                <h3 className="fety-budget-category-name">
                  <span className="fety-budget-category-icon" aria-hidden>
                    {c.icon}
                  </span>
                  <span className="fety-budget-category-name-text">{c.name}</span>
                </h3>
                <div className="fety-budget-category-tile-meta">
                  <div className="fety-budget-tile-actions">
                    <button
                      type="button"
                      className="fety-budget-tile-btn"
                      onClick={() => {
                        setEditingCategoryCapId(c.id);
                        setCategoryCapDraft(amountToEditString(c.monthlyBudget));
                        setCategoryGoalDraft(c.goalId ?? "");
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="fety-budget-tile-btn fety-budget-tile-btn--remove"
                      onClick={() => {
                        if (editingCategoryCapId === c.id) setEditingCategoryCapId(null);
                        onDeleteCategory(c.id);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>

              {editingCap ? (
                <div className="fety-budget-category-edit">
                  <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>
                    Monthly cap
                  </label>
                  <CurrencyInput value={categoryCapDraft} onChange={setCategoryCapDraft} placeholder="0.00" />
                  <div style={{ marginTop: 10 }}>
                    <TransactionGoalSelect
                      goals={goals}
                      goalId={categoryGoalDraft}
                      onGoalId={setCategoryGoalDraft}
                    />
                    <p style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 4 }}>
                      New transactions in this category apply to the linked goal when no goal is selected on the transaction.
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={() => {
                        const n = categoryCapDraft === "" ? 0 : parseFloat(categoryCapDraft);
                        if (!Number.isFinite(n)) return;
                        onUpdateCategory(c.id, {
                          monthlyBudget: n,
                          goalId: categoryGoalDraft || undefined,
                        });
                        setEditingCategoryCapId(null);
                        setCategoryCapDraft("");
                        setCategoryGoalDraft("");
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
                        setCategoryGoalDraft("");
                      }}
                      style={{ padding: "6px 12px", borderRadius: "var(--radius-ctrl)", border: "1px solid var(--border)", background: "transparent", fontSize: 11, cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {linkedGoal ? (
                    <p className="fety-budget-category-goal-link" style={{ fontSize: 10, color: "var(--ink-3)", margin: "0 0 6px" }}>
                      Goal: {linkedGoal.icon} {linkedGoal.name}
                    </p>
                  ) : null}
                  <div className="fety-budget-category-amounts">
                    <span className="fety-budget-category-spent">{usd(c.spent)}</span>
                    <span className="fety-budget-category-cap">{usd(c.monthlyBudget)}</span>
                  </div>
                  <div
                    className="fety-budget-category-bar"
                    role="progressbar"
                    aria-valuenow={Math.round(bar.pct)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className={`fety-budget-category-bar-fill fety-budget-category-bar-fill--${bar.variant}`}
                      style={{ width: `${bar.pct}%` }}
                    />
                  </div>
                  <p className={`fety-budget-category-foot${bar.over ? " fety-budget-category-foot--over" : ""}`}>
                    {bar.over ? `${usd(c.spent - c.monthlyBudget)} over` : `${usd(Math.max(0, bar.left))} left`}
                  </p>
                </>
              )}
            </div>
          );
        })}
        <button type="button" className="fety-budget-add-category-btn" onClick={() => setCategoryAddOpen(true)}>
          + Add budget
        </button>
      </div>
      {categoryAddOpen ? (
        <form
          onSubmit={submitNewCategory}
          className="fety-budget-add-category-form"
        >
          <p className="fety-label-strong" style={{ margin: 0 }}>
            New budget category
          </p>
          <div className="fety-budget-add-category-fields">
            <EmojiIconPicker value={newCategoryIcon} onChange={setNewCategoryIcon} />
            <div className="fety-form-desc" style={{ flex: "1 1 160px", minWidth: 140 }}>
              <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>
                Name
              </label>
              <input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                style={inputStyle}
                placeholder="Groceries"
                autoFocus
              />
            </div>
            <div style={{ flex: "1 1 140px", minWidth: 120 }}>
              <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>
                Monthly cap
              </label>
              <CurrencyInput value={newCategoryCap} onChange={setNewCategoryCap} placeholder="0.00" />
            </div>
          </div>
          <div style={{ maxWidth: 320 }}>
            <TransactionGoalSelect goals={goals} goalId={newCategoryGoalId} onGoalId={setNewCategoryGoalId} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="submit"
              style={{
                padding: "8px 14px",
                border: "none",
                background: "var(--ink)",
                color: "#fff",
                borderRadius: "var(--radius-ctrl)",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Create category
            </button>
            <button
              type="button"
              onClick={() => setCategoryAddOpen(false)}
              style={{
                padding: "8px 14px",
                border: "1px solid var(--border)",
                background: "transparent",
                borderRadius: "var(--radius-ctrl)",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="fety-budget-scheduled-section">
        <div className="fety-budget-scheduled-head">
          <h2 className="fety-budget-scheduled-title">Scheduled Items</h2>
          <button
            type="button"
            className="fety-txn-add-btn"
            onClick={() => {
              setBudgetAddMode("bill");
              setScheduledAddOpen(true);
            }}
          >
            Add scheduled item
          </button>
        </div>

      {scheduledAddOpen
        ? createPortal(
            <div className="fety-modal" role="dialog" aria-modal="true" aria-labelledby="fety-add-scheduled-title">
              <button
                type="button"
                className="fety-modal-backdrop"
                aria-label="Close"
                onClick={() => setScheduledAddOpen(false)}
              />
              <div className="fety-modal-panel fety-modal-panel--scheduled">
                <header className="fety-modal-header">
                  <h2 id="fety-add-scheduled-title" className="fety-modal-title">
                    Add scheduled item
                  </h2>
                  <button type="button" className="fety-modal-close" aria-label="Close" onClick={() => setScheduledAddOpen(false)}>
                    ×
                  </button>
                </header>
                <form className="fety-modal-form fety-budget-scheduled-add-form" onSubmit={submitBudgetAdd}>
                  <div className="fety-budget-scheduled-add-tabs">
                    <button type="button" onClick={() => setBudgetAddMode("bill")} style={addModeToggleStyle(budgetAddMode === "bill")}>
                      Bill
                    </button>
                    <button type="button" onClick={() => setBudgetAddMode("income")} style={addModeToggleStyle(budgetAddMode === "income")}>
                      Income
                    </button>
                    <button type="button" onClick={() => setBudgetAddMode("recur")} style={addModeToggleStyle(budgetAddMode === "recur")}>
                      Recurring
                    </button>
                  </div>

        {budgetAddMode === "bill" ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8, alignItems: "end" }}>
              <div className="fety-form-desc">
                <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Name</label>
                <input value={billName} onChange={(e) => setBillName(e.target.value)} style={inputStyle} placeholder="Electric" />
              </div>
              <div>
                <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Amount</label>
                <CurrencyInput value={billAmount} onChange={setBillAmount} placeholder="0.00" />
              </div>
            </div>
            <BillScheduleFields
              frequency={billFrequency}
              dueDay={billDue}
              onFrequencyChange={setBillFrequency}
              onDueDayChange={setBillDue}
              inputStyle={inputStyle}
            />
            <TransactionAccountFields
              store={ledgerStore}
              transactionType="expense"
              accounts={accounts}
              fromAccountId={billFromAccountId}
              toAccountId=""
              onFromAccountId={setBillFromAccountId}
              onToAccountId={() => {}}
              inputStyle={inputStyle}
            />
            <div className="fety-modal-actions">
              <button type="button" className="fety-modal-btn-secondary" onClick={() => setScheduledAddOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="fety-modal-btn-primary">
                Add bill
              </button>
            </div>
          </>
        ) : budgetAddMode === "income" ? (
          <>
            <p style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.45, margin: 0 }}>
              Paychecks and other recurring money in — projected on your calendar and Transactions page.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8, alignItems: "end" }}>
              <div className="fety-form-desc">
                <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Name</label>
                <input value={incomeName} onChange={(e) => setIncomeName(e.target.value)} style={inputStyle} placeholder="Paycheck" />
              </div>
              <div>
                <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Amount</label>
                <CurrencyInput value={incomeAmount} onChange={setIncomeAmount} placeholder="0.00" />
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
            <TransactionAccountFields
              store={ledgerStore}
              transactionType="deposit"
              accounts={accounts}
              fromAccountId=""
              toAccountId={incomeToAccountId}
              onFromAccountId={() => {}}
              onToAccountId={setIncomeToAccountId}
              inputStyle={inputStyle}
            />
            <div className="fety-modal-actions">
              <button type="button" className="fety-modal-btn-secondary" onClick={() => setScheduledAddOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="fety-modal-btn-primary">
                Add income stream
              </button>
            </div>
          </>
        ) : budgetAddMode === "recur" ? (
          <>
            <p style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.45, margin: 0 }}>
              Other repeating transactions (subscriptions, transfers, etc.) — not bills.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8, alignItems: "end" }}>
              <div className="fety-form-desc">
                <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Name</label>
                <input value={recurName} onChange={(e) => setRecurName(e.target.value)} style={inputStyle} placeholder="Gym membership" />
              </div>
              <div>
                <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Amount</label>
                <CurrencyInput value={recurAmount} onChange={setRecurAmount} placeholder="0.00" />
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
            <div className="fety-modal-actions">
              <button type="button" className="fety-modal-btn-secondary" onClick={() => setScheduledAddOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="fety-modal-btn-primary">
                Add recurring transaction
              </button>
            </div>
          </>
        ) : null}
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}

      <div className="fety-budget-scheduled-grid">
      <div className="fety-budget-scheduled-column">
        <ScheduledKindProgressTile row={billsProgress} usd={usd} />
      <div
        data-tour-id="budget-bills"
        className={`fety-budget-scheduled-panel${highlightBills ? " fety-tour-ring" : ""}`}
      >
        <div className="fety-budget-scheduled-list">
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
                        <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Name</label>
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
                    </div>
                    <BillScheduleFields
                      compact
                      frequency={billEditDraft.frequency}
                      dueDay={billEditDraft.dueDay}
                      onFrequencyChange={(frequency) => setBillEditDraft((d) => (d ? { ...d, frequency } : d))}
                      onDueDayChange={(dueDay) => setBillEditDraft((d) => (d ? { ...d, dueDay } : d))}
                      inputStyle={inputStyle}
                    />
                    <TransactionAccountFields
                      store={ledgerStore}
                      transactionType="expense"
                      accounts={accounts}
                      fromAccountId={billEditDraft.fromAccountId}
                      toAccountId=""
                      onFromAccountId={(fromAccountId) => setBillEditDraft((d) => (d ? { ...d, fromAccountId } : d))}
                      onToAccountId={() => {}}
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
                        {usd(b.amount)} · {billDueSummary(b)}
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
            <p style={{ fontSize: 12, color: "var(--ink-3)", margin: 0 }}>No bills yet — use Add scheduled item.</p>
          )}
        </div>
      </div>
      </div>

      <div className="fety-budget-scheduled-column">
        <ScheduledKindProgressTile row={incomeProgress} usd={usd} />
      <div className="fety-budget-scheduled-panel">
        <div className="fety-budget-scheduled-list">
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
                    <TransactionAccountFields
                      store={ledgerStore}
                      transactionType="deposit"
                      accounts={accounts}
                      fromAccountId=""
                      toAccountId={incomeEditDraft.toAccountId}
                      onFromAccountId={() => {}}
                      onToAccountId={(toAccountId) => setIncomeEditDraft((d) => (d ? { ...d, toAccountId } : d))}
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
                        {usd(s.amount)} · {incomeDueSummary(s)}
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
            <p style={{ fontSize: 12, color: "var(--ink-3)", margin: 0 }}>No income streams — use Add scheduled item.</p>
          )}
        </div>
      </div>
      </div>

      <div className="fety-budget-scheduled-column">
        <ScheduledKindProgressTile row={recurProgress} usd={usd} />
      <div className="fety-budget-scheduled-panel">
        <div className="fety-budget-scheduled-list">
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
                        {usd(r.amount)} · {typeLabel(r.transactionType)} · {scheduleDueSummary(r)}
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
      </div>
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
  bills,
  incomeStreams,
  recurringTransactions,
  addTransactionActions,
  initialAccountFilter,
  earliestDateISO,
  endingBalanceForDate: endingBalanceForDateProp,
}: {
  transactions: Transaction[];
  categories: BudgetCategory[];
  bills: Bill[];
  incomeStreams: IncomeStream[];
  recurringTransactions: RecurringTransaction[];
  transactionTypes: FetyTransactionType[];
  accounts: Account[];
  goals: Goal[];
  typeIcons: import("../types/fety").TypeIconMap;
  viewMode: ViewMode;
  addTransactionActions?: AddTransactionModalActions;
  onAdd: (input: import("../types/fety").AddTransactionInput) => void;
  onUpdate: (
    id: string,
    updates: Partial<
      Pick<Transaction, "desc" | "amount" | "type" | "category" | "dateISO" | "icon" | "fromAccountId" | "toAccountId" | "goalId">
    >,
  ) => void;
  onDelete: (id: string) => void;
  initialAccountFilter?: string | null;
  earliestDateISO?: string;
  endingBalanceForDate?: (dateISO: string) => number;
}) {
  const ledgerStore = { accounts, goals, transactionTypes, typeIcons, transactions, profile: { startingBalance: 0, displayName: "", email: "", currency: "USD" } } as import("../types/fety").FetyStore;
  const defaultTypeId = transactionTypes.find((t) => t.id === "expense")?.id ?? transactionTypes[0]?.id ?? "expense";
  const [filter, setFilter] = useState("All");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [dateRangeStartISO, setDateRangeStartISO] = useState("");
  const [dateRangeEndISO, setDateRangeEndISO] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    if (initialAccountFilter) setAccountFilter(initialAccountFilter);
    else if (initialAccountFilter === null) setAccountFilter("all");
  }, [initialAccountFilter]);

  const [addOpen, setAddOpen] = useState(false);
  const [editDesc, setEditDesc] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editType, setEditType] = useState<TransactionType>(defaultTypeId);
  const [editCategory, setEditCategory] = useState("Other");
  const [editFromAccountId, setEditFromAccountId] = useState("");
  const [editToAccountId, setEditToAccountId] = useState("");
  const [editGoalId, setEditGoalId] = useState("");

  const addTxStore = useMemo(
    () =>
      ({
        ...ledgerStore,
        categories,
        bills,
        incomeStreams,
        recurringTransactions,
        transactions,
        profile: {
          ...ledgerStore.profile,
          balanceAsOfISO: earliestDateISO ?? ledgerStore.profile.balanceAsOfISO,
        },
      }) as import("../types/fety").FetyStore,
    [ledgerStore, categories, bills, incomeStreams, recurringTransactions, transactions, earliestDateISO],
  );

  const endingBalanceForDate = useMemo(
    () => endingBalanceForDateProp ?? ((dateISO: string) => endingBalanceOnDate(addTxStore, dateISO)),
    [addTxStore, endingBalanceForDateProp],
  );

  const filterLabels = ["All", ...transactionTypes.map((t) => t.name)];

  const categoryFilterGroups = useMemo(() => {
    const include =
      categoryFilter !== "all" && categoryFilter.trim() ? categoryFilter : undefined;
    const groups = transactionCategoryPickerGroups(addTxStore, include);
    const known = new Set(allTransactionCategoryNames(groups));
    const orphans: string[] = [];
    for (const t of transactions) {
      const name = t.category?.trim();
      if (!name || isRetiredCategoryName(name) || known.has(name)) continue;
      known.add(name);
      orphans.push(name);
    }
    orphans.sort((a, b) => a.localeCompare(b));
    return { ...groups, orphans };
  }, [addTxStore, categoryFilter, transactions]);

  const shown = useMemo(() => {
    return transactions.filter((t) => {
      if (earliestDateISO && t.dateISO < earliestDateISO) return false;
      if (accountFilter !== "all" && t.fromAccountId !== accountFilter && t.toAccountId !== accountFilter) return false;
      if (filter !== "All") {
        const tt = transactionTypes.find((x) => x.id === t.type);
        if (tt?.name !== filter && t.type !== filter) return false;
      }
      if (dateRangeStartISO && dateRangeEndISO) {
        if (t.dateISO < dateRangeStartISO || t.dateISO > dateRangeEndISO) return false;
      }
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      return true;
    });
  }, [
    transactions,
    earliestDateISO,
    accountFilter,
    filter,
    dateRangeStartISO,
    dateRangeEndISO,
    categoryFilter,
    transactionTypes,
  ]);

  const dateGroups = useMemo(() => {
    const byDateISO: Record<string, Transaction[]> = {};
    shown.forEach((t) => {
      (byDateISO[t.dateISO] ||= []).push(t);
    });
    return Object.entries(byDateISO).sort(([a], [b]) => b.localeCompare(a));
  }, [shown]);

  const renderTransactionRow = (t: Transaction) => {
    const meta = formatTransactionCategoryTypeLines(t, addTxStore);
    const detail = formatTransactionDetailLine(t, addTxStore);
    return (
      <div
        key={t.id}
        style={{
          display: "flex",
          alignItems: editId === t.id ? "stretch" : "center",
          padding: "12px 18px",
          borderTop: "1px solid var(--border)",
          gap: 12,
        }}
      >
        {editId === t.id ? (
          <div className="fety-txn-list-edit">
            <div className="fety-txn-list-edit-fields">
              <div className="fety-form-desc">
                <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Name</label>
                <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} style={inputStyle} placeholder="Name" />
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
                <TransactionCategorySelect
                  store={addTxStore}
                  transactionType={editType}
                  value={editCategory}
                  onChange={setEditCategory}
                  style={inputStyle}
                />
              </div>
            </div>
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
              spreadTransfer
            />
            <div className="fety-txn-list-edit-actions">
              <button type="button" onClick={() => setEditId(null)} className="fety-txn-list-edit-btn fety-txn-list-edit-btn--secondary">
                Cancel
              </button>
              <button
                type="button"
                className="fety-txn-list-edit-btn fety-txn-list-edit-btn--primary"
                onClick={() => {
                  const n = parseFloat(editAmount);
                  const categoryGroups = filterPickerGroupsForFlow(
                    transactionCategoryPickerGroups(addTxStore, editCategory),
                    flowForTransactionType(ledgerStore, editType),
                  );
                  const categoryToSave = resolveTransactionCategory(categoryGroups, editCategory);
                  if (!editDesc.trim() || !Number.isFinite(n) || !categoryToSave) return;
                  onUpdate(t.id, {
                    desc: editDesc.trim(),
                    amount: n,
                    type: editType,
                    category: categoryToSave,
                    fromAccountId: editFromAccountId || undefined,
                    toAccountId: editToAccountId || undefined,
                    goalId: editGoalId || undefined,
                  });
                  setEditId(null);
                }}
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{t.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{transactionListPrimaryTitle(t, addTxStore)}</p>
              <p style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}>
                {[meta.subtitle, detail].filter(Boolean).join(" · ")}
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
  };

  const renderDateGroup = (dateISO: string, txns: Transaction[], groupIndex: number) => (
    <div key={dateISO}>
      <div
        className="fety-txn-date-header"
        style={{ borderTop: groupIndex > 0 ? "1px solid var(--border)" : undefined }}
      >
        <span className="fety-label">{formatTransactionGroupDate(dateISO)}</span>
        {dateISO > todayISO() ? <span className="fety-txn-date-header-tag">Upcoming</span> : null}
      </div>
      {txns.map((t) => renderTransactionRow(t))}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="fety-txn-toolbar">
        <div className="fety-txn-toolbar-filters">
          <div className="fety-txn-toolbar-field">
            <span className="fety-label" id="fety-txn-filter-date-label">
              Date
            </span>
            <div className="fety-txn-toolbar-control-row">
              <TransactionDateRangeFilter
                rangeStartISO={dateRangeStartISO}
                rangeEndISO={dateRangeEndISO}
                endingBalanceForDate={endingBalanceForDate}
                onRangeChange={(start, end) => {
                  setDateRangeStartISO(start);
                  setDateRangeEndISO(end);
                }}
              />
            </div>
          </div>
          <div className="fety-txn-toolbar-field">
            <label className="fety-label" htmlFor="fety-txn-filter-category">
              Category
            </label>
            <select
              id="fety-txn-filter-category"
              className="fety-txn-toolbar-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All categories</option>
              {categoryFilterGroups.budget.length > 0 ? (
                <optgroup label="Budget categories">
                  {categoryFilterGroups.budget.map((name) => (
                    <option key={`budget-${name}`} value={name}>
                      {name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {categoryFilterGroups.scheduledBills.length > 0 ? (
                <optgroup label="Bills">
                  {categoryFilterGroups.scheduledBills.map((name) => (
                    <option key={`bill-${name}`} value={name}>
                      {name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {categoryFilterGroups.scheduledIncome.length > 0 ? (
                <optgroup label="Income">
                  {categoryFilterGroups.scheduledIncome.map((name) => (
                    <option key={`income-${name}`} value={name}>
                      {name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {categoryFilterGroups.scheduledRecurring.length > 0 ? (
                <optgroup label="Recurring transactions">
                  {categoryFilterGroups.scheduledRecurring.map((name) => (
                    <option key={`recur-${name}`} value={name}>
                      {name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {categoryFilterGroups.orphans.length > 0 ? (
                <optgroup label="Other">
                  {categoryFilterGroups.orphans.map((name) => (
                    <option key={`orphan-${name}`} value={name}>
                      {name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </div>
          {accounts.length > 0 ? (
            <div className="fety-txn-toolbar-field">
              <label className="fety-label" htmlFor="fety-txn-filter-account">
                Account
              </label>
              <select
                id="fety-txn-filter-account"
                className="fety-txn-toolbar-select"
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value)}
              >
                <option value="all">All accounts</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.icon} {a.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="fety-txn-toolbar-field fety-txn-toolbar-field--types">
            <span className="fety-label">Type</span>
            <div className="fety-txn-toolbar-type-row" role="group" aria-label="Transaction type">
              {filterLabels.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`fety-txn-type-pill${filter === f ? " fety-txn-type-pill--active" : ""}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>
        <button type="button" className="fety-txn-add-btn" onClick={() => setAddOpen(true)}>
          Add transaction
        </button>
      </div>

      <AddTransactionModal
        open={addOpen}
        dateISO={todayISO()}
        store={addTxStore}
        onClose={() => setAddOpen(false)}
        onSubmit={(input) => onAdd(input)}
        actions={addTransactionActions}
      />

      <div style={{ background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)", overflow: "hidden" }}>
        {dateGroups.map(([dateISO, txns], gi) => renderDateGroup(dateISO, txns, gi))}

        {shown.length === 0 ? (
          <p style={{ padding: 24, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
            {transactions.length === 0 ? "No transactions yet." : "No transactions match these filters."}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function GoalsManageView({
  goals,
  accounts,
  goalLedgerStore,
  viewMode,
  highlightGoalId,
  highlightTarget,
  onAdd,
  onUpdate,
  onDelete,
}: {
  goals: Goal[];
  accounts: Account[];
  goalLedgerStore: import("../types/fety").FetyStore;
  viewMode: ViewMode;
  highlightGoalId?: string;
  highlightTarget?: string | null;
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
  const [accountId, setAccountId] = useState("");
  const [editAccountId, setEditAccountId] = useState("");

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
      accountId: accountId || undefined,
    });
    setName("");
    setTarget("");
    setSaved("");
    setTargetDate("");
    setMonthly("");
    setAccountId("");
    setShowForm(false);
  };

  const startEditGoal = (g: Goal) => {
    setEditGoalId(g.id);
    setEditName(g.name);
    setEditSaved(g.saved === 0 ? "" : String(g.saved));
    setEditTarget(g.target === 0 ? "" : String(g.target));
    setEditTargetDate(goalTargetDateForDateInput(g.targetDate));
    setEditMonthly(g.monthlyContribution === 0 ? "" : String(g.monthlyContribution));
    setEditAccountId(g.accountId ?? "");
  };

  useEffect(() => {
    if (!highlightGoalId) return;
    const g = goals.find((goal) => goal.id === highlightGoalId);
    if (g) {
      setEditGoalId(g.id);
      setEditName(g.name);
      setEditSaved(g.saved === 0 ? "" : String(g.saved));
      setEditTarget(g.target === 0 ? "" : String(g.target));
      setEditTargetDate(goalTargetDateForDateInput(g.targetDate));
      setEditMonthly(g.monthlyContribution === 0 ? "" : String(g.monthlyContribution));
      setEditAccountId(g.accountId ?? "");
    }
    const el = document.querySelector(`[data-tour-id="goal-${highlightGoalId}"]`);
    if (el instanceof HTMLElement) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightGoalId]);

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
      accountId: editAccountId || undefined,
    });
    setEditGoalId(null);
  };

  return (
    <div className="fety-goals-page">
      <div className={`fety-goals-grid${viewMode === "list" ? " fety-goals-grid--list" : ""}`}>
        {goals.map((g) => {
          const savedTotal = goalSavedTotal(goalLedgerStore, g);
          const pct = g.target > 0 ? Math.round((savedTotal / g.target) * 100) : 0;
          const toGo = Math.max(0, g.target - savedTotal);
          const pace = goalPaceStatus(savedTotal, g.target, g.targetDate, g.monthlyContribution);
          const byline = formatGoalByline(g.targetDate);
          const editing = editGoalId === g.id;
          return (
            <div
              key={g.id}
              data-tour-id={`goal-${g.id}`}
              className={`fety-goals-card${pace === "behind" ? " fety-goals-card--behind" : ""}${highlightGoalId === g.id || highlightTarget === `goal-${g.id}` ? " fety-tour-ring" : ""}`}
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
                    <input
                      type="date"
                      value={editTargetDate}
                      onChange={(e) => setEditTargetDate(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Monthly Contribution</label>
                    <CurrencyInput value={editMonthly} onChange={setEditMonthly} placeholder="0.00" />
                  </div>
                  <div>
                    <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Linked account</label>
                    <select
                      value={editAccountId}
                      onChange={(e) => setEditAccountId(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">None</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.icon} {a.name}
                        </option>
                      ))}
                    </select>
                    <p style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 4 }}>
                      Link a debt account to show payoff progress on Net Worth when transactions apply to this goal.
                    </p>
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
                  <div className="fety-goals-card-head">
                    <div className="fety-goals-card-head-main">
                      <h3 className="fety-goals-card-name">
                        <span className="fety-goals-card-icon" aria-hidden>
                          {g.icon}
                        </span>
                        <span className="fety-goals-card-name-text">{g.name}</span>
                      </h3>
                      {byline ? <p className="fety-goals-card-byline">{byline}</p> : null}
                    </div>
                    <div className="fety-goals-card-head-side">
                      <span
                        className={`fety-goals-status fety-goals-status--${pace}`}
                        aria-label={pace === "behind" ? "Behind goal" : "On track"}
                      >
                        <span className="fety-goals-status-dot" aria-hidden />
                        {pace === "behind" ? "BEHIND" : "ON TRACK"}
                      </span>
                      <div className="fety-goals-card-actions">
                        <button type="button" className="fety-budget-tile-btn" onClick={() => startEditGoal(g)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="fety-budget-tile-btn fety-budget-tile-btn--remove"
                          onClick={() => onDelete(g.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="fety-goals-amount-row">
                    <p className="fety-goals-saved">{usdGoal(savedTotal)}</p>
                    <p className="fety-goals-target">of {usdGoal(g.target)}</p>
                  </div>
                  <div className="fety-goals-bar" aria-hidden>
                    <div className="fety-goals-bar-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <p className="fety-goals-foot">
                    {pct}% · {usdGoal(toGo)} to go
                  </p>
                </>
              )}
            </div>
          );
        })}
        <button type="button" className="fety-goals-add-btn" onClick={() => setShowForm(true)}>
          + Add a goal
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
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Monthly Contribution</label>
              <CurrencyInput value={monthly} onChange={setMonthly} placeholder="0.00" />
            </div>
            <div>
              <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Linked account</label>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} style={inputStyle}>
                <option value="">None</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.icon} {a.name}
                  </option>
                ))}
              </select>
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

export function ProfileSettingsView({
  profile,
  onUpdateProfile,
  onReset,
  onRestartSetup,
  onOpenTestPlanner,
}: {
  profile: { displayName: string; email: string; currency: string; startingBalance: number };
  onUpdateProfile: (u: Partial<{ displayName: string; email: string; currency: string; startingBalance: number }>) => void;
  onReset: () => void;
  onRestartSetup?: () => void;
  onOpenTestPlanner?: () => void;
}) {
  const [profileEdit, setProfileEdit] = useState(false);
  const [pName, setPName] = useState(profile.displayName);
  const [pEmail, setPEmail] = useState(profile.email);
  const [pCurrency, setPCurrency] = useState(profile.currency);
  const [pStart, setPStart] = useState(String(profile.startingBalance));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
      <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", padding: "18px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <p className="fety-label-strong">Personal info</p>
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

      <button type="button" onClick={() => { if (confirm("Reset all local data to demo sample data?")) onReset(); }} style={{ padding: "10px 16px", borderRadius: "var(--radius-ctrl)", border: "1px solid var(--trouble-dk)", background: "transparent", color: "var(--trouble-dk)", cursor: "pointer", fontWeight: 600 }}>
        Load demo sample data
      </button>
      {onRestartSetup && (
        <button type="button" onClick={onRestartSetup} style={{ padding: "10px 16px", borderRadius: "var(--radius-ctrl)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", cursor: "pointer", fontWeight: 600 }}>
          Run setup wizard again
        </button>
      )}
      {onOpenTestPlanner ? (
        <button type="button" className="fety-profile-test-planner" onClick={onOpenTestPlanner}>
          Test planner
        </button>
      ) : null}
    </div>
  );
}

export function NetWorthManageView({
  accounts,
  ledgerStore,
  onUpdateAccount,
  onAddAccount,
  onDeleteAccount,
  onOpenTransactionsForAccount,
}: {
  accounts: Account[];
  ledgerStore: import("../types/fety").FetyStore;
  onUpdateAccount: (id: string, u: Partial<Pick<Account, "name" | "type" | "balance" | "icon" | "kind" | "balanceAsOfISO">>) => void;
  onAddAccount: (input: Omit<Account, "id">) => void;
  onDeleteAccount: (id: string) => void;
  onOpenTransactionsForAccount?: (accountId: string) => void;
}) {
  const totals = netWorthTotals(ledgerStore);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("");
  const [editKind, setEditKind] = useState<AccountKind>("asset");
  const [editBalance, setEditBalance] = useState("");
  const [editBalanceAsOf, setEditBalanceAsOf] = useState(() => todayISO());
  const [editIcon, setEditIcon] = useState("🏦");
  const [showAdd, setShowAdd] = useState(false);
  const [newAcctName, setNewAcctName] = useState("");
  const [newAcctType, setNewAcctType] = useState("Checking");
  const [newAcctKind, setNewAcctKind] = useState<AccountKind>("asset");
  const [newAcctBalance, setNewAcctBalance] = useState("");
  const [newAcctBalanceAsOf, setNewAcctBalanceAsOf] = useState(() => todayISO());
  const [newAcctIcon, setNewAcctIcon] = useState("🏦");

  const openAddForm = (kind: AccountKind) => {
    setNewAcctKind(kind);
    setNewAcctType(kind === "debt" ? "Credit card" : "Checking");
    setNewAcctIcon(kind === "debt" ? "💳" : "🏦");
    setNewAcctName("");
    setNewAcctBalance("");
    setNewAcctBalanceAsOf(todayISO());
    setShowAdd(true);
  };

  const resetAddForm = () => {
    setShowAdd(false);
    setNewAcctName("");
    setNewAcctType("Checking");
    setNewAcctKind("asset");
    setNewAcctBalance("");
    setNewAcctBalanceAsOf(todayISO());
    setNewAcctIcon("🏦");
  };

  const startEdit = (a: Account) => {
    setEditingId(a.id);
    setEditName(a.name);
    setEditType(a.type);
    setEditKind(accountKind(a));
    setEditIcon(a.icon);
    setEditBalance(amountToEditString(isDebtAccount(a) ? Math.abs(a.balance) : a.balance));
    setEditBalanceAsOf(a.balanceAsOfISO ?? accountBalanceAsOfISO(a, ledgerStore));
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = (id: string) => {
    const kind = editKind;
    onUpdateAccount(id, {
      name: editName.trim() || "Account",
      type: editType.trim() || "Account",
      kind,
      icon: editIcon || "🏦",
      balance: normalizeAccountOpeningBalance(kind, parseFloat(editBalance) || 0),
      balanceAsOfISO: editBalanceAsOf || todayISO(),
    });
    cancelEdit();
  };

  const sorted = [...accounts].sort((a, b) => {
    const ka = accountKind(a);
    const kb = accountKind(b);
    if (ka !== kb) return ka === "asset" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 720 }} className="fety-networth-manage">
      <div className="fety-networth-summary-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px" }}>
          <p className="fety-label" style={{ marginBottom: 6 }}>Assets</p>
          <p style={{ fontSize: 22, fontWeight: 600, color: "var(--ink)" }}>{usdF(totals.assets)}</p>
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px" }}>
          <p className="fety-label" style={{ marginBottom: 6 }}>Debts</p>
          <p style={{ fontSize: 22, fontWeight: 600, color: "var(--trouble-dk)" }}>{usdF(totals.debts)}</p>
        </div>
        <div style={{ background: "var(--paper)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px" }}>
          <p className="fety-label" style={{ marginBottom: 6 }}>Net worth</p>
          <p style={{ fontSize: 22, fontWeight: 600, color: "var(--ink)" }}>{usdF(totals.net)}</p>
        </div>
      </div>

      <p style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.45 }}>
        Set each account&apos;s opening amount and as-of date (assets and debt). That baseline is the balance on that day; linked transactions update it afterward.
      </p>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: showAdd ? 12 : 0 }}>
          <p className="fety-label-strong" style={{ margin: 0 }}>Add account or debt</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => openAddForm("asset")} style={{ ...editBtnStyle, height: 32 }}>
              Add asset
            </button>
            <button
              type="button"
              onClick={() => openAddForm("debt")}
              style={{ ...editBtnStyle, height: 32, color: "var(--trouble-dk)", borderColor: "var(--border-soft)" }}
            >
              Add debt
            </button>
          </div>
        </div>
        {showAdd ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newAcctName.trim()) return;
              const kind = newAcctKind;
              onAddAccount({
                name: newAcctName.trim(),
                type: newAcctType.trim() || (kind === "debt" ? "Debt" : "Account"),
                balance: normalizeAccountOpeningBalance(kind, parseFloat(newAcctBalance) || 0),
                icon: newAcctIcon || (kind === "debt" ? "💳" : "🏦"),
                kind,
                balanceAsOfISO: newAcctBalanceAsOf || todayISO(),
              });
              resetAddForm();
            }}
            className="fety-networth-add-form"
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, alignItems: "end", paddingTop: 4, borderTop: "1px solid var(--border-soft)" }}
          >
            <div>
              <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Name</label>
              <input
                value={newAcctName}
                onChange={(e) => setNewAcctName(e.target.value)}
                style={inputStyle}
                placeholder={newAcctKind === "debt" ? "Chase Visa" : "Chase Checking"}
                autoFocus
              />
            </div>
            <div>
              <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Type</label>
              <input value={newAcctType} onChange={(e) => setNewAcctType(e.target.value)} style={inputStyle} placeholder={newAcctKind === "debt" ? "Credit card" : "Checking"} />
            </div>
            <div>
              <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Category</label>
              <select value={newAcctKind} onChange={(e) => setNewAcctKind(e.target.value as AccountKind)} style={inputStyle}>
                <option value="asset">Asset</option>
                <option value="debt">Debt</option>
              </select>
            </div>
            <div>
              <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>
                {newAcctKind === "debt" ? "Amount owed" : "Opening balance"}
              </label>
              <CurrencyInput value={newAcctBalance} onChange={setNewAcctBalance} placeholder="0.00" />
            </div>
            <div>
              <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>{accountBalanceAsOfLabel(newAcctKind)}</label>
              <input
                type="date"
                value={newAcctBalanceAsOf}
                onChange={(e) => setNewAcctBalanceAsOf(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
              <EmojiIconPicker value={newAcctIcon} onChange={setNewAcctIcon} />
              <button type="submit" style={{ ...editBtnStyle, background: "var(--ink)", color: "#fff", border: "none", height: 36, padding: "0 14px" }}>
                Save
              </button>
              <button type="button" onClick={resetAddForm} style={{ ...editBtnStyle, height: 36 }}>
                Cancel
              </button>
            </div>
          </form>
        ) : null}
      </div>

      {sorted.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--ink-3)" }}>No accounts yet. Use Add asset or Add debt above.</p>
      ) : (
        (() => {
          const assetAccounts = sorted.filter((a) => !isDebtAccount(a));
          const debtAccounts = sorted.filter((a) => isDebtAccount(a));

          const renderAccountCard = (a: Account) => {
          const current = accountBalanceWithTransactions(ledgerStore, a.id);
          const activity = accountActivityForAccount(ledgerStore, a.id, 12);
          const linkedGoals = goalsLinkedToAccount(ledgerStore, a.id);
          const editing = editingId === a.id;
          const debt = isDebtAccount(a);

          return (
            <div key={a.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: editing ? 14 : 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{a.name}</p>
                    <span style={{ fontSize: 22, lineHeight: 1 }} aria-hidden>
                      {a.icon}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: "var(--paper)", color: "var(--ink-3)" }}>
                      {debt ? "Debt" : "Asset"} · {a.type}
                    </span>
                  </div>
                  {!editing ? (
                    <>
                      <p style={{ fontSize: 28, fontWeight: 500, color: debt ? "var(--trouble-dk)" : "var(--ink)", marginTop: 8, letterSpacing: "-0.02em" }}>
                        {formatAccountBalanceDisplay(a, current)}
                      </p>
                      <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 6 }}>
                        {accountOpeningBaselineCopy(a, ledgerStore)}
                      </p>
                    </>
                  ) : null}
                  {linkedGoals.length > 0 && !editing ? (
                    <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 6 }}>
                      Goals: {linkedGoals.map((g) => g.name).join(", ")}
                      {debt ? " — payments toward this account reduce the balance owed." : ""}
                    </p>
                  ) : null}
                </div>
                {!editing ? (
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button type="button" onClick={() => startEdit(a)} style={editBtnStyle}>
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Remove ${a.name || "this account"}?`)) onDeleteAccount(a.id);
                      }}
                      style={{ ...editBtnStyle, color: "var(--trouble-dk)", borderColor: "var(--border-soft)" }}
                    >
                      Remove
                    </button>
                  </div>
                ) : null}
              </div>

              {editing ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 14 }}>
                  <div>
                    <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Name</label>
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Type</label>
                    <input value={editType} onChange={(e) => setEditType(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>Category</label>
                    <select value={editKind} onChange={(e) => setEditKind(e.target.value as AccountKind)} style={inputStyle}>
                      <option value="asset">Asset</option>
                      <option value="debt">Debt</option>
                    </select>
                  </div>
                  <div>
                    <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>
                      {editKind === "debt" ? "Amount owed" : "Opening balance"}
                    </label>
                    <CurrencyInput value={editBalance} onChange={setEditBalance} placeholder="0.00" />
                  </div>
                  <div>
                    <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>{accountBalanceAsOfLabel(editKind)}</label>
                    <input type="date" value={editBalanceAsOf} onChange={(e) => setEditBalanceAsOf(e.target.value)} style={inputStyle} />
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                    <EmojiIconPicker value={editIcon} onChange={setEditIcon} />
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                    <button type="button" onClick={() => saveEdit(a.id)} style={{ ...editBtnStyle, background: "var(--ink)", color: "#fff", border: "none" }}>
                      Save
                    </button>
                    <button type="button" onClick={cancelEdit} style={editBtnStyle}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}

              {!editing && activity.length > 0 ? (
                <div style={{ borderTop: "1px solid var(--border-soft)", paddingTop: 12 }}>
                  <p className="fety-label" style={{ marginBottom: 8 }}>Recent activity</p>
                  <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                    {activity.map(({ transaction: t, delta, direction }) => {
                      const typeLabel = labelForTransactionType(ledgerStore, t.type);
                      return (
                        <li
                          key={t.id}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            gap: 12,
                            fontSize: 12,
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontWeight: 500, color: "var(--ink)" }}>{transactionListPrimaryTitle(t, ledgerStore)}</p>
                            <p style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}>
                              {formatTransactionGroupDate(t.dateISO)} · {typeLabel}
                            </p>
                          </div>
                          <span
                            style={{
                              fontWeight: 600,
                              flexShrink: 0,
                              color: direction === "in" ? "var(--ink)" : "var(--trouble-dk)",
                            }}
                          >
                            {direction === "in" ? "+" : "−"}
                            {usdF(Math.abs(delta))}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  {onOpenTransactionsForAccount ? (
                    <button
                      type="button"
                      onClick={() => onOpenTransactionsForAccount(a.id)}
                      style={{ marginTop: 10, border: "none", background: "transparent", color: "var(--ink-2)", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0 }}
                    >
                      View all in Transactions →
                    </button>
                  ) : null}
                </div>
              ) : !editing ? (
                <p style={{ fontSize: 11, color: "var(--ink-3)", borderTop: "1px solid var(--border-soft)", paddingTop: 12 }}>
                  No transaction activity on this account yet.
                </p>
              ) : null}
            </div>
          );
          };

          return (
            <>
              {assetAccounts.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <p className="fety-label-strong" style={{ margin: 0 }}>Asset accounts</p>
                  {assetAccounts.map(renderAccountCard)}
                </div>
              ) : null}
              {debtAccounts.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <p className="fety-label-strong" style={{ margin: 0 }}>Debt accounts</p>
                  <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: -6, lineHeight: 1.45 }}>
                    Set amount owed and debt balance as of date; payments and transfers to this account reduce what you owe after that date.
                  </p>
                  {debtAccounts.map(renderAccountCard)}
                </div>
              ) : null}
            </>
          );
        })()
      )}
    </div>
  );
}
