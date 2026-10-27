import { useMemo } from "react";
import { calNetWorthColor } from "../lib/calendarUi";
import {
  accountBalanceAsOfISO,
  accountBalanceProjectedThrough,
  formatAccountBalanceDisplay,
  isDebtAccount,
  netWorthTotalsProjectedOnDate,
} from "../lib/ledger";
import { formatUsd } from "../lib/scheduleAmounts";
import type { FetyStore } from "../types/fety";

export default function CalendarAccountsBreakdown({
  store,
  dateISO,
  compact,
}: {
  store: FetyStore;
  dateISO: string;
  compact?: boolean;
}) {
  const accounts = store.accounts;
  const rows = useMemo(() => {
    return [...accounts]
      .filter((a) => dateISO >= accountBalanceAsOfISO(a, store))
      .sort((a, b) => {
        const da = isDebtAccount(a) ? 1 : 0;
        const db = isDebtAccount(b) ? 1 : 0;
        if (da !== db) return da - db;
        return a.name.localeCompare(b.name);
      })
      .map((a) => ({
        account: a,
        balance: accountBalanceProjectedThrough(store, a.id, dateISO),
      }));
  }, [accounts, store, dateISO]);

  const totals = useMemo(() => netWorthTotalsProjectedOnDate(store, dateISO), [store, dateISO]);

  if (accounts.length === 0) {
    return (
      <p style={{ fontSize: 10, color: "var(--ink-3)", margin: compact ? "8px 0 0" : "10px 0 0", lineHeight: 1.4 }}>
        Add accounts on Net Worth to see balances by account here.
      </p>
    );
  }

  const assets = rows.filter((r) => !isDebtAccount(r.account));
  const debts = rows.filter((r) => isDebtAccount(r.account));
  const pending = accounts.filter((a) => dateISO < accountBalanceAsOfISO(a, store));

  return (
    <details className={`fety-cal-acct-details${compact ? " fety-cal-acct-details-compact" : ""}`}>
      <summary>
        <span className="fety-cal-acct-details-label">Accounts &amp; net worth</span>
        <span className="fety-cal-acct-details-meta" style={{ color: calNetWorthColor(totals.net) }}>
          {formatUsd(totals.net)}
        </span>
      </summary>
      <div className="fety-cal-acct-details-body">
        <p className="fety-cal-acct-details-explainer">
          Each line is that account&apos;s <strong>end-of-day balance</strong> on this date (after transactions and
          scheduled activity). Assets and debt below add up to net worth — the same total you see on the Net Worth page.
        </p>
        {rows.length === 0 && pending.length > 0 ? (
          <p style={{ fontSize: 10, color: "var(--ink-3)", margin: 0, lineHeight: 1.4 }}>
            No accounts active on this date yet. Earliest balance as of{" "}
            {pending
              .map((a) => accountBalanceAsOfISO(a, store))
              .sort()[0]}
            .
          </p>
        ) : null}
        {assets.length > 0 ? (
          <div className="fety-cal-acct-details-group">
            <p className="fety-cal-acct-details-heading">Assets</p>
            {assets.map(({ account, balance }) => (
              <div key={account.id} className="fety-cal-acct-details-row">
                <span className="fety-cal-acct-details-name">
                  {account.icon} {account.name}
                </span>
                <span className="fety-cal-acct-details-amt">{formatAccountBalanceDisplay(account, balance)}</span>
              </div>
            ))}
          </div>
        ) : null}
        {debts.length > 0 ? (
          <div className="fety-cal-acct-details-group">
            <p className="fety-cal-acct-details-heading">Debt</p>
            {debts.map(({ account, balance }) => (
              <div key={account.id} className="fety-cal-acct-details-row">
                <span className="fety-cal-acct-details-name">
                  {account.icon} {account.name}
                </span>
                <span className="fety-cal-acct-details-amt fety-cal-acct-details-amt-debt">
                  {formatAccountBalanceDisplay(account, balance)}
                </span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="fety-cal-acct-details-totals">
          <span>Total Assets {formatUsd(totals.assets)}</span>
          <span>Total Debts {formatUsd(totals.debts)}</span>
        </div>
      </div>
    </details>
  );
}
