import { useMemo, useState, type FormEvent } from "react";
import CurrencyInput from "./CurrencyInput";
import TransactionCategorySelect from "./TransactionCategorySelect";
import TransactionAccountFields from "./TransactionAccountFields";
import type { ExtractedTransactionDraft } from "../lib/transactionImageExtract";
import { flowForTransactionType, getTransactionTypes } from "../lib/transactionTypes";
import {
  filterPickerGroupsForFlow,
  resolveTransactionCategory,
  transactionCategoryPickerGroups,
} from "../lib/transactionCategories";
import type { AddTransactionInput, FetyStore, TransactionType } from "../types/fety";

export default function TransactionPictureReview({
  store,
  draft,
  dateISO,
  onCancel,
  onConfirm,
}: {
  store: FetyStore;
  draft: ExtractedTransactionDraft;
  dateISO: string;
  onCancel: () => void;
  onConfirm: (input: AddTransactionInput) => void;
}) {
  const transactionTypes = useMemo(() => getTransactionTypes(store), [store]);
  const defaultType = draft.type ?? transactionTypes.find((t) => t.id === "expense")?.id ?? "expense";
  const [desc, setDesc] = useState(draft.desc ?? "");
  const [amount, setAmount] = useState(draft.amount != null ? String(Math.abs(draft.amount)) : "");
  const [type, setType] = useState<TransactionType>(defaultType);
  const [category, setCategory] = useState(draft.category ?? "");
  const [transactionDateISO, setTransactionDateISO] = useState(draft.dateISO ?? dateISO);
  const [notes, setNotes] = useState(draft.notes ?? "");
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [markCompleted, setMarkCompleted] = useState(true);

  const txFlow = flowForTransactionType(store, type);
  const categoryGroups = useMemo(
    () => filterPickerGroupsForFlow(transactionCategoryPickerGroups(store, category), txFlow),
    [store, category, txFlow],
  );
  const validCategory = resolveTransactionCategory(categoryGroups, category);

  const uncertain = new Set(draft.uncertainFields);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const n = parseFloat(amount);
    if (!desc.trim() || !Number.isFinite(n) || !validCategory) return;
    onConfirm({
      desc: desc.trim(),
      amount: n,
      type,
      category: validCategory,
      dateISO: transactionDateISO,
      notes: notes.trim() || undefined,
      fromAccountId: fromAccountId || undefined,
      toAccountId: toAccountId || undefined,
      postingStatus: markCompleted ? "completed" : "planned",
      completedAtISO: markCompleted ? transactionDateISO : undefined,
    });
  };

  return (
    <form className="fety-txn-picture-review" onSubmit={handleSubmit}>
      <p className="fety-txn-picture-review-lede">
        Review what we pulled from your picture. Fix anything that looks off, then save. Saving records the
        transaction — it does not mark it paid until you choose that below or use <strong>Mark as Completed</strong>{" "}
        later.
      </p>
      {uncertain.size > 0 ? (
        <p className="fety-txn-picture-review-flag">
          Please double-check: {Array.from(uncertain).join(", ")}.
        </p>
      ) : null}
      <label className="fety-label">
        Name / merchant
        <input
          className="fety-input"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Where was this?"
          required
        />
      </label>
      <label className="fety-label">
        Amount
        <CurrencyInput value={amount} onChange={setAmount} required />
      </label>
      <label className="fety-label">
        Date
        <input
          className="fety-input"
          type="date"
          value={transactionDateISO}
          min={store.profile.balanceAsOfISO}
          onChange={(e) => setTransactionDateISO(e.target.value)}
          required
        />
      </label>
      <label className="fety-label">
        Type
        <select className="fety-input" value={type} onChange={(e) => setType(e.target.value)}>
          {transactionTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.icon} {t.name}
            </option>
          ))}
        </select>
      </label>
      <label className="fety-label">
        Category
        <TransactionCategorySelect
          store={store}
          transactionType={type}
          value={category}
          onChange={setCategory}
        />
      </label>
      <TransactionAccountFields
        store={store}
        transactionType={type}
        accounts={store.accounts}
        fromAccountId={fromAccountId}
        toAccountId={toAccountId}
        onFromAccountId={setFromAccountId}
        onToAccountId={setToAccountId}
      />
      <label className="fety-label">
        Notes (optional)
        <textarea className="fety-input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <label className="fety-txn-posting-choice">
        <input
          type="checkbox"
          checked={markCompleted}
          onChange={(e) => setMarkCompleted(e.target.checked)}
        />
        <span>This has already happened — count it in my balances now</span>
      </label>
      <div className="fety-modal-actions">
        <button type="button" className="fety-btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="fety-btn-primary">
          Save transaction
        </button>
      </div>
    </form>
  );
}
