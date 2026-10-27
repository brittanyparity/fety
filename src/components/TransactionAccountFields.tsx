import type { CSSProperties } from "react";
import type { Account, FetyStore } from "../types/fety";
import { flowForTransactionType } from "../lib/transactionTypes";

type TransactionAccountFieldsProps = {
  store: FetyStore;
  transactionType: string;
  accounts: Account[];
  fromAccountId: string;
  toAccountId: string;
  onFromAccountId: (value: string) => void;
  onToAccountId: (value: string) => void;
  inputStyle?: CSSProperties;
  /** Full-width two-column layout for transfer from/to (e.g. inline edit). */
  spreadTransfer?: boolean;
};

const defaultSelectStyle: CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  fontSize: 13,
  fontFamily: "inherit",
  background: "var(--surface)",
};

function AccountSelect({
  label,
  value,
  onChange,
  accounts,
  disabled,
  style,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  accounts: Account[];
  disabled: boolean;
  style: CSSProperties;
}) {
  const empty = accounts.length === 0 ? "Add accounts on Net Worth" : "Select account";
  return (
    <div>
      <label className="fety-label" style={{ display: "block", marginBottom: 4 }}>
        {label}
      </label>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={style} disabled={disabled}>
        <option value="">{empty}</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.icon} {a.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function TransactionAccountFields({
  store,
  transactionType,
  accounts,
  fromAccountId,
  toAccountId,
  onFromAccountId,
  onToAccountId,
  inputStyle,
  spreadTransfer,
}: TransactionAccountFieldsProps) {
  const flow = flowForTransactionType(store, transactionType);
  const selectStyle = inputStyle ?? defaultSelectStyle;
  const disabled = accounts.length === 0;

  if (flow === "transfer") {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: spreadTransfer ? "1fr 1fr" : "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 10,
          padding: spreadTransfer ? "12px 14px" : undefined,
          borderRadius: spreadTransfer ? 12 : undefined,
          border: spreadTransfer ? "1px solid var(--border)" : undefined,
          background: spreadTransfer ? "var(--bg)" : undefined,
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {spreadTransfer ? (
          <p className="fety-label-strong" style={{ gridColumn: "1 / -1", margin: 0 }}>
            Transfer between accounts
          </p>
        ) : null}
        {disabled ? (
          <p style={{ gridColumn: "1 / -1", fontSize: 12, color: "var(--ink-2)", margin: 0 }}>
            Add checking, savings, or other accounts under Net Worth to choose where money moves.
          </p>
        ) : null}
        <AccountSelect
          label="From account"
          value={fromAccountId}
          onChange={onFromAccountId}
          accounts={accounts}
          disabled={disabled}
          style={selectStyle}
        />
        <AccountSelect
          label="To account"
          value={toAccountId}
          onChange={onToAccountId}
          accounts={accounts}
          disabled={disabled}
          style={selectStyle}
        />
      </div>
    );
  }

  if (flow === "income") {
    return (
      <AccountSelect
        label="To account"
        value={toAccountId}
        onChange={onToAccountId}
        accounts={accounts}
        disabled={disabled}
        style={selectStyle}
      />
    );
  }

  return (
    <AccountSelect
      label="From account"
      value={fromAccountId}
      onChange={onFromAccountId}
      accounts={accounts}
      disabled={disabled}
      style={selectStyle}
    />
  );
}
