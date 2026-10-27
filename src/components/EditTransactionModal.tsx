import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { createPortal } from "react-dom";
import CurrencyInput, { amountToEditString } from "./CurrencyInput";
import TransactionAccountFields from "./TransactionAccountFields";
import TransactionCategorySelect from "./TransactionCategorySelect";
import { flowForTransactionType, getTransactionTypes } from "../lib/transactionTypes";
import {
  filterPickerGroupsForFlow,
  resolveTransactionCategory,
  transactionCategoryPickerGroups,
} from "../lib/transactionCategories";
import type { FetyStore, FetyTransactionType, Transaction, TransactionType } from "../types/fety";

type EditTransactionModalProps = {
  open: boolean;
  transaction: Transaction | null;
  store: FetyStore;
  onClose: () => void;
  onSave: (
    id: string,
    updates: Partial<
      Pick<
        Transaction,
        "desc" | "amount" | "type" | "category" | "dateISO" | "fromAccountId" | "toAccountId" | "goalId"
      >
    >,
  ) => void;
  onDelete?: (id: string) => void;
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

function typePillClass(active: boolean): string {
  return `fety-modal-pill${active ? " fety-modal-pill--type-active" : ""}`;
}

export default function EditTransactionModal({
  open,
  transaction,
  store,
  onClose,
  onSave,
  onDelete,
}: EditTransactionModalProps) {
  const transactionTypes = useMemo(() => getTransactionTypes(store), [store]);
  const accounts = store.accounts;
  const goals = store.goals;
  const earliestDateISO = store.profile.balanceAsOfISO ?? "";

  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<TransactionType>("expense");
  const [category, setCategory] = useState("");
  const [dateISO, setDateISO] = useState("");
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [goalId, setGoalId] = useState("");

  useEffect(() => {
    if (!open || !transaction) return;
    setDesc(transaction.desc);
    setAmount(amountToEditString(transaction.amount));
    setType(transaction.type);
    setCategory(transaction.category);
    setDateISO(transaction.dateISO);
    setFromAccountId(transaction.fromAccountId ?? "");
    setToAccountId(transaction.toAccountId ?? "");
    setGoalId(transaction.goalId ?? "");
  }, [open, transaction]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const txFlow = flowForTransactionType(store, type);
  const categoryGroups = useMemo(() => {
    const base = transactionCategoryPickerGroups(store, category);
    return filterPickerGroupsForFlow(base, txFlow);
  }, [store, category, txFlow]);
  const validCategory = resolveTransactionCategory(categoryGroups, category);
  const validGoalId = goals.some((g) => g.id === goalId) ? goalId : "";

  useEffect(() => {
    if (!open) return;
    if (category && !validCategory) setCategory("");
  }, [open, category, validCategory]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!transaction) return;
    const n = parseFloat(amount);
    const categoryToSave = resolveTransactionCategory(categoryGroups, category);
    if (!desc.trim() || !Number.isFinite(n) || !categoryToSave || !dateISO) return;
    onSave(transaction.id, {
      desc: desc.trim(),
      amount: n,
      type,
      category: categoryToSave,
      dateISO,
      fromAccountId: fromAccountId || undefined,
      toAccountId: toAccountId || undefined,
      goalId: validGoalId || undefined,
    });
    onClose();
  };

  if (!open || !transaction) return null;

  return createPortal(
    <div className="fety-modal" role="dialog" aria-modal="true" aria-labelledby="fety-edit-tx-title">
      <button type="button" className="fety-modal-backdrop" aria-label="Close" onClick={onClose} />
      <div className="fety-modal-panel fety-modal-panel--transaction">
        <header className="fety-modal-header">
          <div>
            <h2 id="fety-edit-tx-title" className="fety-modal-title">
              Edit transaction
            </h2>
          </div>
          <button type="button" className="fety-modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>
        <form className="fety-modal-form" onSubmit={handleSubmit}>
          <div>
            <label className="fety-label" htmlFor="fety-edit-tx-date">
              Date
            </label>
            <input
              id="fety-edit-tx-date"
              type="date"
              value={dateISO}
              min={earliestDateISO || undefined}
              onChange={(e) => setDateISO(e.target.value)}
              style={{ ...panelInput, marginTop: 6 }}
              required
            />
          </div>
          <div>
            <label className="fety-label" htmlFor="fety-edit-tx-desc">
              Name
            </label>
            <input
              id="fety-edit-tx-desc"
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
            <TransactionCategorySelect
              store={store}
              transactionType={type}
              value={category}
              onChange={setCategory}
              style={panelInput}
              required
            />
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

          <div className="fety-modal-actions">
            {onDelete ? (
              <button
                type="button"
                className="fety-modal-btn-secondary"
                style={{ marginRight: "auto", color: "var(--trouble-dk)" }}
                onClick={() => {
                  onDelete(transaction.id);
                  onClose();
                }}
              >
                Delete
              </button>
            ) : null}
            <button type="button" className="fety-modal-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="fety-modal-btn-primary">
              Save changes
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
