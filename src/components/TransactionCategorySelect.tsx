import { useMemo } from "react";
import type { CSSProperties } from "react";
import type { FetyStore } from "../types/fety";
import { flowForTransactionType } from "../lib/transactionTypes";
import {
  allTransactionCategoryNames,
  filterPickerGroupsForFlow,
  resolveTransactionCategory,
  transactionCategoryPickerGroups,
} from "../lib/transactionCategories";

export const TRANSACTION_CATEGORY_PLACEHOLDER = "Select Category";

type TransactionCategorySelectProps = {
  store: FetyStore;
  transactionType: string;
  value: string;
  onChange: (value: string) => void;
  style?: CSSProperties;
  required?: boolean;
  disabled?: boolean;
};

export default function TransactionCategorySelect({
  store,
  transactionType,
  value,
  onChange,
  style,
  required,
  disabled,
}: TransactionCategorySelectProps) {
  const groups = useMemo(() => {
    const base = transactionCategoryPickerGroups(store, value);
    const flow = flowForTransactionType(store, transactionType);
    return filterPickerGroupsForFlow(base, flow);
  }, [store, value, transactionType]);
  const resolved = resolveTransactionCategory(groups, value);
  const empty = allTransactionCategoryNames(groups).length === 0;

  const selectStyle = useMemo(() => {
    if (!style) return undefined;
    const {
      padding,
      paddingTop,
      paddingRight,
      paddingBottom,
      paddingLeft,
      paddingBlock,
      paddingInline,
      background,
      backgroundColor,
      backgroundImage,
      ...rest
    } = style;
    return rest;
  }, [style]);

  return (
    <select
      className="fety-transaction-category-select"
      value={resolved}
      onChange={(e) => {
        const next = e.target.value;
        if (!next) return;
        onChange(next);
      }}
      style={selectStyle}
      required={required}
      disabled={disabled || empty}
    >
      <option value="" disabled>
        {TRANSACTION_CATEGORY_PLACEHOLDER}
      </option>
      {empty ? null : (
        <>
          {groups.budget.length > 0 ? (
            <optgroup label="Budget categories">
              {groups.budget.map((name) => (
                <option key={`budget-${name}`} value={name}>
                  {name}
                </option>
              ))}
            </optgroup>
          ) : null}
          {groups.scheduledBills.length > 0 ? (
            <optgroup label="Bills">
              {groups.scheduledBills.map((name) => (
                <option key={`bill-${name}`} value={name}>
                  {name}
                </option>
              ))}
            </optgroup>
          ) : null}
          {groups.scheduledIncome.length > 0 ? (
            <optgroup label="Income">
              {groups.scheduledIncome.map((name) => (
                <option key={`income-${name}`} value={name}>
                  {name}
                </option>
              ))}
            </optgroup>
          ) : null}
          {groups.scheduledRecurring.length > 0 ? (
            <optgroup label="Recurring transactions">
              {groups.scheduledRecurring.map((name) => (
                <option key={`recur-${name}`} value={name}>
                  {name}
                </option>
              ))}
            </optgroup>
          ) : null}
        </>
      )}
    </select>
  );
}
