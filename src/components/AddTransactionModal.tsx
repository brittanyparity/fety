import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { createPortal } from "react-dom";
import CurrencyInput from "./CurrencyInput";
import EmojiIconPicker from "./EmojiIconPicker";
import TransactionAccountFields from "./TransactionAccountFields";
import TransactionCategorySelect from "./TransactionCategorySelect";
import BillScheduleFields from "./BillScheduleFields";
import IncomeScheduleFields from "./IncomeScheduleFields";
import { incomeScheduleFromDraft } from "../lib/incomeScheduleDraft";
import { flowForTransactionType, getTransactionTypes } from "../lib/transactionTypes";
import {
  dueDayFromDateISO,
  getScheduledItemOption,
  scheduledItemDiffersFromTransaction,
} from "../lib/scheduledItemCatalog";
import {
  allTransactionCategoryNames,
  filterPickerGroupsForFlow,
  resolveTransactionCategory,
  goalIdForBudgetCategory,
  scheduledItemRefForCategory,
  transactionCategoryPickerGroups,
} from "../lib/transactionCategories";
import type {
  AddTransactionInput,
  BillFrequency,
  FetyStore,
  FetyTransactionType,
  IncomeFrequency,
  TransactionType,
} from "../types/fety";

export type AddTransactionPayload = AddTransactionInput;

export type AddTransactionModalActions = {
  onAddCategory?: (input: { name: string; icon: string; monthlyBudget: number; goalId?: string }) => void;
  onAddBill?: (bill: Omit<import("../types/fety").Bill, "id">) => void;
  onAddIncomeStream?: (stream: Omit<import("../types/fety").IncomeStream, "id">) => void;
  onAddRecurringTransaction?: (item: Omit<import("../types/fety").RecurringTransaction, "id">) => void;
};

type AddTransactionModalProps = {
  open: boolean;
  dateISO: string;
  store: FetyStore;
  onClose: () => void;
  onSubmit: (input: AddTransactionPayload) => void;
  actions?: AddTransactionModalActions;
};

const panelInput: CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  fontSize: 13,
  fontFamily: "inherit",
  background: "var(--surface)",
};

const { padding: _panelInputPadding, background: _panelInputBg, ...panelInputShell } = panelInput;

function pillClass(active: boolean): string {
  return `fety-modal-pill${active ? " fety-modal-pill--active" : ""}`;
}

function typePillClass(active: boolean): string {
  return `fety-modal-pill${active ? " fety-modal-pill--type-active" : ""}`;
}

export default function AddTransactionModal({
  open,
  dateISO,
  store,
  onClose,
  onSubmit,
  actions,
}: AddTransactionModalProps) {
  const transactionTypes = useMemo(() => getTransactionTypes(store), [store]);
  const accounts = store.accounts;
  const goals = store.goals;

  const defaultTypeId = transactionTypes.find((t) => t.id === "expense")?.id ?? transactionTypes[0]?.id ?? "expense";

  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<TransactionType>(defaultTypeId);
  const [category, setCategory] = useState("");
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [goalId, setGoalId] = useState("");
  const [transactionDateISO, setTransactionDateISO] = useState(dateISO);
  const [scheduleMismatch, setScheduleMismatch] = useState<AddTransactionPayload | null>(null);

  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryIcon, setNewCategoryIcon] = useState("📁");
  const [newCategoryCap, setNewCategoryCap] = useState("");
  const [newCategoryRecurring, setNewCategoryRecurring] = useState(false);
  const [newCategoryScheduleKind, setNewCategoryScheduleKind] = useState<"bill" | "income" | "recur">("bill");
  const [newCategorySchedAmount, setNewCategorySchedAmount] = useState("");
  const [newCategorySchedDue, setNewCategorySchedDue] = useState(1);
  const [newCategorySchedFrequency, setNewCategorySchedFrequency] = useState<BillFrequency>("monthly");
  const [newCategoryIncomeFrequency, setNewCategoryIncomeFrequency] = useState<IncomeFrequency>("monthly");
  const [newCategoryIncomeSemiDays, setNewCategoryIncomeSemiDays] = useState<[number, number]>([1, 15]);
  const [newCategoryIncomeStartDate, setNewCategoryIncomeStartDate] = useState("");
  const [newCategoryIncomeEndDate, setNewCategoryIncomeEndDate] = useState("");
  const [newCategoryRecurType, setNewCategoryRecurType] = useState<TransactionType>(defaultTypeId);

  const earliestDateISO = store.profile.balanceAsOfISO ?? "";

  useEffect(() => {
    if (!open) return;
    setTransactionDateISO(dateISO);
    setDesc("");
    setAmount("");
    setType(defaultTypeId);
    setCategory("");
    setFromAccountId("");
    setToAccountId("");
    setGoalId("");
    setScheduleMismatch(null);
    setShowAddCategory(false);
    setNewCategoryRecurring(false);
    setNewCategoryScheduleKind("bill");
  }, [open, dateISO, defaultTypeId, store]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (scheduleMismatch) setScheduleMismatch(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, scheduleMismatch]);

  const validGoalId = goals.some((g) => g.id === goalId) ? goalId : "";

  const txFlow = flowForTransactionType(store, type);
  const categoryGroups = useMemo(() => {
    const base = transactionCategoryPickerGroups(store, category);
    return filterPickerGroupsForFlow(base, txFlow);
  }, [store, category, txFlow]);
  const categoryOptions = useMemo(() => allTransactionCategoryNames(categoryGroups), [categoryGroups]);
  const validCategory = resolveTransactionCategory(categoryGroups, category);

  useEffect(() => {
    if (!open) return;
    if (category && !validCategory) setCategory("");
  }, [open, category, validCategory]);

  useEffect(() => {
    if (!open) return;
    if (txFlow === "income") setNewCategoryScheduleKind("income");
    else if (newCategoryScheduleKind === "income") setNewCategoryScheduleKind("bill");
  }, [open, txFlow]);

  useEffect(() => {
    if (!open || !validCategory) return;
    const linkedGoal = goalIdForBudgetCategory(store, validCategory);
    if (linkedGoal) setGoalId(linkedGoal);
  }, [open, validCategory, store]);

  useEffect(() => {
    if (!open || !validCategory) return;
    const ref = scheduledItemRefForCategory(store, validCategory);
    if (!ref) return;
    if (ref.kind === "income") setType("deposit");
    else if (ref.kind === "bill") setType("expense");
    else {
      const recur = store.recurringTransactions?.find((r) => r.id === ref.id);
      if (recur?.transactionType) setType(recur.transactionType);
    }
  }, [open, validCategory, store]);

  const buildPayload = (): AddTransactionPayload | null => {
    const n = parseFloat(amount);
    if (!desc.trim() || !Number.isFinite(n) || !validCategory) return null;
    const ref = scheduledItemRefForCategory(store, validCategory);
    return {
      desc: desc.trim(),
      amount: n,
      type,
      category: validCategory,
      dateISO: transactionDateISO,
      fromAccountId: fromAccountId || undefined,
      toAccountId: toAccountId || undefined,
      goalId: validGoalId || undefined,
      scheduledItemKind: ref?.kind,
      scheduledItemId: ref?.id,
    };
  };

  const finishSubmit = (payload: AddTransactionPayload, updateScheduledItem: boolean) => {
    onSubmit({ ...payload, updateScheduledItem });
    onClose();
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const payload = buildPayload();
    if (!payload) return;
    if (payload.scheduledItemKind && payload.scheduledItemId) {
      const item = getScheduledItemOption(store, {
        kind: payload.scheduledItemKind,
        id: payload.scheduledItemId,
      });
      if (item) {
        const diff = scheduledItemDiffersFromTransaction(item, payload.amount, payload.dateISO ?? transactionDateISO);
        if (diff.shouldPrompt) {
          setScheduleMismatch(payload);
          return;
        }
      }
    }
    finishSubmit(payload, false);
  };

  const submitNewCategory = (e: FormEvent) => {
    e.preventDefault();
    const name = newCategoryName.trim();
    const cap = newCategoryCap === "" ? 0 : parseFloat(newCategoryCap);
    if (!name || !Number.isFinite(cap) || !actions?.onAddCategory) return;

    actions.onAddCategory({ name, icon: newCategoryIcon.trim() || "📁", monthlyBudget: cap });

    if (newCategoryRecurring) {
      const txAmount = parseFloat(amount);
      const schedAmount = newCategorySchedAmount === "" ? NaN : parseFloat(newCategorySchedAmount);
      const n = Number.isFinite(schedAmount) ? schedAmount : Number.isFinite(txAmount) ? txAmount : cap;
      if (!Number.isFinite(n)) return;

      const dueDay = newCategorySchedDue || dueDayFromDateISO(transactionDateISO);
      const schedCategory = name;
      const icon = newCategoryIcon.trim() || "📁";

      if (newCategoryScheduleKind === "bill" && actions.onAddBill) {
        actions.onAddBill({
          name,
          amount: n,
          dueDay,
          frequency: newCategorySchedFrequency,
          category: schedCategory,
          icon,
        });
      } else if (newCategoryScheduleKind === "income" && actions.onAddIncomeStream) {
        actions.onAddIncomeStream({
          name,
          amount: n,
          category: schedCategory,
          icon,
          ...incomeScheduleFromDraft({
            frequency: newCategoryIncomeFrequency,
            dueDay,
            semiMonthlyDays: newCategoryIncomeSemiDays,
            startDateISO: newCategoryIncomeStartDate,
            endDateISO: newCategoryIncomeEndDate,
          }),
        });
      } else if (newCategoryScheduleKind === "recur" && actions.onAddRecurringTransaction) {
        actions.onAddRecurringTransaction({
          name,
          amount: n,
          dueDay,
          frequency: newCategorySchedFrequency,
          category: schedCategory,
          icon,
          transactionType: newCategoryRecurType,
        });
      }
    }

    setCategory(name);
    setNewCategoryName("");
    setNewCategoryCap("");
    setNewCategorySchedAmount("");
    setNewCategoryRecurring(false);
    setShowAddCategory(false);
  };

  if (!open) return null;

  return createPortal(
    <div className="fety-modal" role="dialog" aria-modal="true" aria-labelledby="fety-add-tx-title">
      <button type="button" className="fety-modal-backdrop" aria-label="Close" onClick={onClose} />
      <div className="fety-modal-panel fety-modal-panel--transaction">
        <header className="fety-modal-header">
          <div>
            <h2 id="fety-add-tx-title" className="fety-modal-title">
              Add Transaction
            </h2>
          </div>
          <button type="button" className="fety-modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>
        <form className="fety-modal-form" onSubmit={handleSubmit}>
          <div>
            <label className="fety-label" htmlFor="fety-add-tx-date">
              Date
            </label>
            <input
              id="fety-add-tx-date"
              type="date"
              value={transactionDateISO}
              min={earliestDateISO || undefined}
              onChange={(e) => setTransactionDateISO(e.target.value)}
              style={{ ...panelInput, marginTop: 6 }}
              required
            />
          </div>
          <div>
            <label className="fety-label" htmlFor="fety-add-tx-desc">
              Name
            </label>
            <input
              id="fety-add-tx-desc"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Name"
              style={{ ...panelInput, marginTop: 6 }}
              autoFocus
            />
          </div>
          <CurrencyInput value={amount} onChange={setAmount} placeholder="0.00" style={{ borderRadius: 8 }} />

          <section className="fety-txn-modal-section">
            <h3 className="fety-txn-modal-section-title">Type</h3>
            <div className="fety-modal-pill-row">
              {transactionTypes.map((tt: FetyTransactionType) => (
                <button
                  key={tt.id}
                  type="button"
                  className={typePillClass(type === tt.id)}
                  onClick={() => setType(tt.id)}
                >
                  {tt.name}
                </button>
              ))}
            </div>
          </section>

          <section className="fety-txn-modal-section">
            <h3 className="fety-txn-modal-section-title">Category</h3>
            <div className="fety-txn-modal-section-row">
              <TransactionCategorySelect
                store={store}
                transactionType={type}
                value={category}
                onChange={setCategory}
                style={panelInput}
                required
                disabled={categoryOptions.length === 0}
              />
              {actions?.onAddCategory ? (
                <button
                  type="button"
                  className="fety-modal-pill fety-modal-pill--add-category"
                  onClick={() => setShowAddCategory((v) => !v)}
                >
                  + Add Category
                </button>
              ) : null}
            </div>
            {showAddCategory && actions?.onAddCategory ? (
              <div className="fety-txn-modal-inline-form">
                <div className="fety-txn-modal-inline-fields">
                  <EmojiIconPicker value={newCategoryIcon} onChange={setNewCategoryIcon} compact />
                  <input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Name"
                    style={panelInput}
                  />
                  <CurrencyInput value={newCategoryCap} onChange={setNewCategoryCap} placeholder="Monthly cap" />
                </div>
                <label className="fety-txn-modal-check">
                  <input
                    type="checkbox"
                    checked={newCategoryRecurring}
                    onChange={(e) => setNewCategoryRecurring(e.target.checked)}
                  />
                  <span>Recurring scheduled item</span>
                </label>
                {newCategoryRecurring ? (
                  <>
                    <div className="fety-modal-pill-row">
                      {txFlow !== "income" ? (
                        <button
                          type="button"
                          className={pillClass(newCategoryScheduleKind === "bill")}
                          onClick={() => setNewCategoryScheduleKind("bill")}
                        >
                          Bills
                        </button>
                      ) : null}
                      {txFlow === "income" ? (
                        <button
                          type="button"
                          className={pillClass(newCategoryScheduleKind === "income")}
                          onClick={() => setNewCategoryScheduleKind("income")}
                        >
                          Income
                        </button>
                      ) : null}
                      {txFlow !== "income" ? (
                        <button
                          type="button"
                          className={pillClass(newCategoryScheduleKind === "recur")}
                          onClick={() => setNewCategoryScheduleKind("recur")}
                        >
                          Recurring
                        </button>
                      ) : null}
                    </div>
                    <CurrencyInput
                      value={newCategorySchedAmount}
                      onChange={setNewCategorySchedAmount}
                      placeholder="Amount per occurrence"
                    />
                    {newCategoryScheduleKind === "bill" || newCategoryScheduleKind === "recur" ? (
                      <BillScheduleFields
                        frequency={newCategorySchedFrequency}
                        dueDay={newCategorySchedDue}
                        onFrequencyChange={setNewCategorySchedFrequency}
                        onDueDayChange={setNewCategorySchedDue}
                        inputStyle={panelInput}
                        compact
                      />
                    ) : (
                      <IncomeScheduleFields
                        frequency={newCategoryIncomeFrequency}
                        dueDay={newCategorySchedDue}
                        semiMonthlyDays={newCategoryIncomeSemiDays}
                        startDateISO={newCategoryIncomeStartDate}
                        endDateISO={newCategoryIncomeEndDate}
                        onFrequencyChange={setNewCategoryIncomeFrequency}
                        onDueDayChange={setNewCategorySchedDue}
                        onSemiMonthlyDaysChange={setNewCategoryIncomeSemiDays}
                        onStartDateISOChange={setNewCategoryIncomeStartDate}
                        onEndDateISOChange={setNewCategoryIncomeEndDate}
                        inputStyle={panelInput}
                        compact
                      />
                    )}
                    {newCategoryScheduleKind === "recur" ? (
                      <select
                        value={newCategoryRecurType}
                        onChange={(e) => setNewCategoryRecurType(e.target.value)}
                        style={panelInput}
                      >
                        {transactionTypes.map((tt) => (
                          <option key={tt.id} value={tt.id}>
                            {tt.name}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </>
                ) : null}
                <button type="button" className="fety-modal-pill fety-modal-pill--active" onClick={submitNewCategory}>
                  Save category
                </button>
              </div>
            ) : null}
          </section>

          <section>
            <p className="fety-label" style={{ marginBottom: 6 }}>
              Account
            </p>
            <TransactionAccountFields
              store={store}
              transactionType={type}
              accounts={accounts}
              fromAccountId={fromAccountId}
              toAccountId={toAccountId}
              onFromAccountId={setFromAccountId}
              onToAccountId={setToAccountId}
              inputStyle={panelInput}
            />
          </section>
          <div>
            <p className="fety-label" style={{ marginBottom: 6 }}>
              Apply to goal
            </p>
            <select
              className="fety-transaction-goal-select"
              value={validGoalId}
              onChange={(e) => setGoalId(e.target.value)}
              style={panelInputShell}
              disabled={goals.length === 0}
            >
              <option value="">{goals.length === 0 ? "Create goals on Goals page" : "— None —"}</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.icon} {g.name}
                </option>
              ))}
            </select>
          </div>

          {scheduleMismatch ? (
            <div className="fety-txn-schedule-prompt" role="status">
              <p className="fety-txn-schedule-prompt-title">Update scheduled item?</p>
              <p className="fety-txn-schedule-prompt-copy">
                This transaction&apos;s amount and date differ from the scheduled item. You can update the scheduled item to
                match, or keep the schedule unchanged.
              </p>
              <div className="fety-modal-pill-row">
                <button
                  type="button"
                  className="fety-modal-pill fety-modal-pill--active"
                  onClick={() => {
                    finishSubmit(scheduleMismatch, true);
                    setScheduleMismatch(null);
                  }}
                >
                  Update scheduled item
                </button>
                <button
                  type="button"
                  className="fety-modal-pill"
                  onClick={() => {
                    finishSubmit(scheduleMismatch, false);
                    setScheduleMismatch(null);
                  }}
                >
                  Keep schedule as-is
                </button>
                <button type="button" className="fety-modal-pill fety-modal-pill--outline" onClick={() => setScheduleMismatch(null)}>
                  Back
                </button>
              </div>
            </div>
          ) : null}

          <div className="fety-modal-actions">
            <button type="button" className="fety-modal-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="fety-modal-btn-primary" disabled={!!scheduleMismatch}>
              Save transaction
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
