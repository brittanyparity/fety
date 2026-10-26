import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { createPortal } from "react-dom";
import CurrencyInput from "./CurrencyInput";
import EmojiIconPicker from "./EmojiIconPicker";
import { getTransactionTypes, isTransferTransactionType } from "../lib/transactionTypes";
import type { FetyStore, FetyTransactionType, TransactionType } from "../types/fety";

export type AddTransactionPayload = {
  desc: string;
  amount: number;
  type: TransactionType;
  category: string;
  dateISO?: string;
  icon?: string;
  fromAccountId?: string;
  toAccountId?: string;
  goalId?: string;
};

type AddTransactionModalProps = {
  open: boolean;
  dateISO: string;
  store: FetyStore;
  onClose: () => void;
  onSubmit: (input: AddTransactionPayload) => void;
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

function formatModalDate(dateISO: string): string {
  const d = new Date(`${dateISO}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateISO;
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export default function AddTransactionModal({ open, dateISO, store, onClose, onSubmit }: AddTransactionModalProps) {
  const transactionTypes = useMemo(() => getTransactionTypes(store), [store]);
  const categories = store.categories;
  const accounts = store.accounts;
  const goals = store.goals;

  const defaultTypeId = transactionTypes.find((t) => t.id === "expense")?.id ?? transactionTypes[0]?.id ?? "expense";
  const iconForType = (typeId: string) => transactionTypes.find((t) => t.id === typeId)?.icon ?? "💬";

  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<TransactionType>(defaultTypeId);
  const [category, setCategory] = useState(categories[0]?.name ?? "Other");
  const [icon, setIcon] = useState("");
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [goalId, setGoalId] = useState("");

  useEffect(() => {
    if (!open) return;
    setDesc("");
    setAmount("");
    setType(defaultTypeId);
    setCategory(categories[0]?.name ?? "Other");
    setIcon("");
    setFromAccountId("");
    setToAccountId("");
    setGoalId("");
  }, [open, dateISO, defaultTypeId, categories]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const isTransfer = isTransferTransactionType(store, type);
  const acctEmpty = accounts.length === 0 ? "Add accounts on Net Worth" : "Select account";
  const validGoalId = goals.some((g) => g.id === goalId) ? goalId : "";

  const categoryOptions = [...categories.map((c) => c.name), "Income", "Other"].filter(
    (v, i, a) => a.indexOf(v) === i,
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const n = parseFloat(amount);
    if (!desc.trim() || !Number.isFinite(n)) return;
    onSubmit({
      desc: desc.trim(),
      amount: n,
      type,
      category,
      dateISO,
      icon: icon.trim() || undefined,
      fromAccountId: fromAccountId || undefined,
      toAccountId: toAccountId || undefined,
      goalId: validGoalId || undefined,
    });
    onClose();
  };

  if (!open) return null;

  return createPortal(
    <div className="fety-modal" role="dialog" aria-modal="true" aria-labelledby="fety-add-tx-title">
      <button type="button" className="fety-modal-backdrop" aria-label="Close" onClick={onClose} />
      <div className="fety-modal-panel fety-modal-panel--transaction">
        <header className="fety-modal-header">
          <div>
            <p className="fety-modal-eyebrow">Add transaction</p>
            <h2 id="fety-add-tx-title" className="fety-modal-title">
              {formatModalDate(dateISO)}
            </h2>
          </div>
          <button type="button" className="fety-modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>
        <form className="fety-modal-form" onSubmit={handleSubmit}>
          <div className="fety-modal-form-row fety-modal-form-row--icon">
            <EmojiIconPicker value={icon} defaultEmoji={iconForType(type)} onChange={setIcon} compact />
            <div className="fety-form-desc" style={{ flex: 1, minWidth: 0 }}>
              <input
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Description"
                style={panelInput}
                autoFocus
              />
            </div>
          </div>
          <CurrencyInput value={amount} onChange={setAmount} placeholder="0.00" style={{ borderRadius: 8 }} />
          <select value={type} onChange={(e) => setType(e.target.value)} style={panelInput}>
            {transactionTypes.map((tt: FetyTransactionType) => (
              <option key={tt.id} value={tt.id}>
                {tt.name}
              </option>
            ))}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={panelInput}>
            {categoryOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          {isTransfer ? (
            <div className="fety-modal-routing">
              <p className="fety-label">Transfer between accounts</p>
              <select
                value={fromAccountId}
                onChange={(e) => setFromAccountId(e.target.value)}
                style={{ ...panelInput, marginBottom: 8 }}
                disabled={accounts.length === 0}
              >
                <option value="">{acctEmpty} (from)</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <select
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
                style={panelInput}
                disabled={accounts.length === 0}
              >
                <option value="">{acctEmpty} (to)</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div>
            <p className="fety-label" style={{ marginBottom: 6 }}>
              Apply to goal
            </p>
            <select
              value={validGoalId}
              onChange={(e) => setGoalId(e.target.value)}
              style={panelInput}
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
            <button type="button" className="fety-modal-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="fety-modal-btn-primary">
              Save transaction
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
