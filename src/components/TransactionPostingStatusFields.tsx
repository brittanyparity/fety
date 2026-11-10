import { todayISO } from "../lib/fetyCalculations";
import { postingStatusLabel, type TransactionPostingStatus } from "../lib/transactionPosting";
import type { CSSProperties } from "react";

export default function TransactionPostingStatusFields({
  dateISO,
  markCompleted,
  onMarkCompletedChange,
  completedAtISO,
  onCompletedAtISOChange,
  earliestDateISO,
  inputStyle,
}: {
  dateISO: string;
  markCompleted: boolean;
  onMarkCompletedChange: (completed: boolean) => void;
  completedAtISO: string;
  onCompletedAtISOChange: (iso: string) => void;
  earliestDateISO?: string;
  inputStyle?: CSSProperties;
}) {
  const plannedLabel = postingStatusLabel("planned", dateISO);
  const statusPreview = markCompleted ? "Complete" : plannedLabel;

  return (
    <section className="fety-txn-modal-section">
      <h3 className="fety-txn-modal-section-title">Status</h3>
      <p className="fety-txn-modal-section-hint">
        Choose whether this counts in your balances now ({statusPreview.toLowerCase()}).
      </p>
      <div className="fety-modal-pill-row fety-txn-status-pill-row">
        <button
          type="button"
          className={`fety-modal-pill${markCompleted ? " fety-modal-pill--active" : ""}`}
          onClick={() => onMarkCompletedChange(true)}
        >
          Complete
        </button>
        <button
          type="button"
          className={`fety-modal-pill${!markCompleted ? " fety-modal-pill--active" : ""}`}
          onClick={() => onMarkCompletedChange(false)}
        >
          {plannedLabel}
        </button>
      </div>
      {markCompleted ? (
        <div style={{ marginTop: 10 }}>
          <label className="fety-label" htmlFor="fety-tx-completed-on">
            Completed on
          </label>
          <input
            id="fety-tx-completed-on"
            type="date"
            value={completedAtISO}
            min={earliestDateISO || undefined}
            onChange={(e) => onCompletedAtISOChange(e.target.value)}
            style={{ ...(inputStyle ?? {}), marginTop: 6, width: "100%" }}
          />
        </div>
      ) : null}
    </section>
  );
}

export function postingStatusFromForm(markCompleted: boolean): TransactionPostingStatus {
  return markCompleted ? "completed" : "planned";
}

export function markCompletedFromTransaction(
  t: Pick<import("../types/fety").Transaction, "postingStatus" | "dateISO">,
): boolean {
  return t.postingStatus === "completed";
}

export function defaultCompletedAtForTransaction(t: Pick<import("../types/fety").Transaction, "dateISO" | "completedAtISO">): string {
  return t.completedAtISO ?? t.dateISO ?? todayISO();
}
