import { useMemo, useRef, useState } from "react";
import { useForwardWheelToMainScroll } from "../../hooks/useForwardWheelToMainScroll";
import CalendarAccountsBreakdown from "../../components/CalendarAccountsBreakdown";
import CalendarNoteIcon from "../../components/CalendarNoteIcon";
import DayNotesPanel from "../../components/DayNotesPanel";
import EditTransactionModal from "../../components/EditTransactionModal";
import TransactionListTile from "../../components/TransactionListTile";
import { isManualStoredTransaction } from "../../lib/transactionPosting";
import { notesForCalendarDay } from "../../lib/calendarNotes";
import { calendarEndingBalanceBg, calDayBalanceColor, calFigureColor } from "../../lib/calendarUi";
import { actualCashBalance } from "../../lib/affordability";
import { todayISO } from "../../lib/fetyCalculations";
import type { CalDay, CalDayItem, FetyStore, Transaction } from "../../types/fety";
import HomeCalendarTileScroller from "./HomeCalendarTileScroller";
import HomeOpenDayButton from "./HomeOpenDayButton";

const usdFull = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

function formatEquationDayHead(date: Date): string {
  const month = date.toLocaleDateString("en-US", { month: "short" });
  return `${month} ${date.getDate()}`;
}

function txLabel(item: CalDayItem): string {
  const name = item.desc.trim() || item.category || "Transaction";
  if (item.type === "bill") return `${name} due`;
  return name;
}

function signedAmount(amount: number): string {
  const abs = usdFull(Math.abs(amount));
  if (amount > 0) return `+${abs}`;
  if (amount < 0) return `−${abs}`;
  return abs;
}

function DailyBalanceRow({
  label,
  amount,
  hasData,
  dayEndBalance,
}: {
  label: string;
  amount: number;
  hasData: boolean;
  dayEndBalance: number;
}) {
  return (
    <div className="fety-home-cal-period-bal-row">
      <span className="fety-home-cal-period-bal-label">{label}</span>
      <p className="fety-home-cal-period-balance" style={{ color: calDayBalanceColor(amount, dayEndBalance) }}>
        {hasData ? usdFull(amount) : "—"}
      </p>
    </div>
  );
}

function EquationBalanceRow({
  label,
  amount,
  isSelected,
  hasData,
  dayEndBalance,
  end,
}: {
  label: string;
  amount: number;
  isSelected: boolean;
  hasData: boolean;
  dayEndBalance: number;
  end?: boolean;
}) {
  return (
    <div className="fety-home-cal-eq-bal-row">
      <span className="fety-home-cal-eq-bal-label">{label}</span>
      <p
        className={`fety-home-cal-eq-value${end ? " fety-home-cal-eq-value--end" : ""}`}
        style={{ color: calDayBalanceColor(amount, dayEndBalance, isSelected) }}
      >
        {hasData ? usdFull(amount) : "—"}
      </p>
    </div>
  );
}

function transactionForDayItem(
  item: CalDayItem,
  dateISO: string,
  txById: Map<string, Transaction>,
): Transaction {
  const stored = txById.get(item.id);
  if (stored) return stored;
  return {
    id: item.id,
    dateISO,
    desc: item.desc,
    category: item.category,
    amount: item.amount,
    type: item.txnType,
    icon: item.icon,
  };
}

function TransactionsSectionChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      className={open ? "fety-home-cal-tx-chevron fety-home-cal-tx-chevron--open" : "fety-home-cal-tx-chevron"}
      aria-hidden
    >
      <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DayTransactionsSection({
  items,
  emptyLabel = "No transactions on this day.",
  dateISO,
  store,
  onEditItem,
  onDeleteItem,
  txById,
}: {
  items: CalDayItem[];
  emptyLabel?: string;
  dateISO: string;
  store: FetyStore;
  onEditItem: (item: CalDayItem) => void;
  onDeleteItem?: (id: string) => void;
  txById: Map<string, Transaction>;
}) {
  const [open, setOpen] = useState(true);

  return (
    <section className="fety-home-cal-period-section fety-home-cal-period-section--transactions">
      <div className="fety-home-cal-tx-section-head">
        <h4 className="fety-home-cal-period-section-label">Transactions</h4>
        <button
          type="button"
          className="fety-home-cal-tx-section-toggle"
          aria-expanded={open}
          aria-label={open ? "Collapse transactions" : "Expand transactions"}
          onClick={() => setOpen((v) => !v)}
        >
          <TransactionsSectionChevron open={open} />
        </button>
      </div>
      {open ? (
        items.length === 0 ? (
          <p className="fety-home-cal-period-muted fety-home-cal-tx-section-empty">{emptyLabel}</p>
        ) : (
          <ul className="fety-mobile-txn-list fety-home-cal-tx-tile-list">
            {items.map((item) => {
              const stored = txById.get(item.id);
              const transaction = transactionForDayItem(item, dateISO, txById);
              const canDelete = Boolean(onDeleteItem && stored && isManualStoredTransaction(stored));
              return (
                <TransactionListTile
                  key={item.id}
                  transaction={transaction}
                  store={store}
                  onEdit={() => onEditItem(item)}
                  onDelete={canDelete ? () => onDeleteItem!(item.id) : undefined}
                />
              );
            })}
          </ul>
        )
      ) : null}
    </section>
  );
}

export function HomeCalendarDailyDetail({
  date,
  dateISO,
  data,
  calendarNotes,
  store,
  onUpdateTransaction,
  onDeleteTransaction,
  onCompleteTransaction,
  onMarkTransactionUpcoming,
  onAddCalendarNote,
  onUpdateCalendarNote,
  onDeleteCalendarNote,
}: {
  date: Date;
  dateISO: string;
  data?: CalDay;
  calendarNotes?: FetyStore["calendarNotes"];
  store: FetyStore;
  onAddCalendarNote?: (dateISO: string, text: string) => void;
  onUpdateCalendarNote?: (dateISO: string, noteId: string, text: string) => void;
  onDeleteCalendarNote?: (dateISO: string, noteId: string) => void;
  onUpdateTransaction: (
    id: string,
    updates: Partial<
      Pick<
        Transaction,
        "desc" | "amount" | "type" | "category" | "dateISO" | "fromAccountId" | "toAccountId" | "goalId"
      >
    >,
  ) => void;
  onDeleteTransaction: (id: string) => void;
  onCompleteTransaction?: (id: string, completedAtISO?: string) => void;
  onMarkTransactionUpcoming?: (id: string) => void;
}) {
  const startBal = data?.startBal ?? 0;
  const endBal = data?.endBal ?? 0;
  const today = todayISO();
  const showActualVsPlanned = dateISO > today;
  const actualToday = useMemo(() => actualCashBalance(store), [store]);
  const items = data?.items ?? [];
  const txById = useMemo(() => new Map(store.transactions.map((t) => [t.id, t])), [store.transactions]);
  const [editOpen, setEditOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const dailyRootRef = useRef<HTMLDivElement>(null);
  useForwardWheelToMainScroll(dailyRootRef);

  const openEdit = (item: CalDayItem) => {
    const stored = txById.get(item.id);
    setEditingTransaction(
      stored ?? {
        id: item.id,
        dateISO,
        desc: item.desc,
        category: item.category,
        amount: item.amount,
        type: item.txnType,
        icon: item.icon,
      },
    );
    setEditOpen(true);
  };

  return (
    <div ref={dailyRootRef} className="fety-home-cal-period fety-home-cal-period--daily">
      <header className="fety-home-cal-period-header">
        <div>
          <p className="fety-label">What this day looks like</p>
          <h3 className="fety-home-cal-period-title">
            {date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </h3>
        </div>
      </header>

      {showActualVsPlanned ? (
        <p className="fety-balance-actual-planned fety-home-cal-period-muted">
          <strong>Actual today:</strong> {usdFull(actualToday)} · <strong>Planned this day:</strong>{" "}
          {usdFull(endBal)} ending balance (includes scheduled money not yet posted).
        </p>
      ) : null}

      <HomeCalendarTileScroller className="fety-home-cal-tile-scroll-wrap--daily">
        <section className="fety-home-cal-period-section">
          <DailyBalanceRow
            label={showActualVsPlanned ? "Starting balance (planned)" : "Starting Balance"}
            amount={startBal}
            hasData={Boolean(data)}
            dayEndBalance={endBal}
          />
        </section>

        <DayTransactionsSection
          items={items}
          dateISO={dateISO}
          store={store}
          onEditItem={openEdit}
          onDeleteItem={onDeleteTransaction}
          txById={txById}
        />

        <section className="fety-home-cal-period-section">
          <DailyBalanceRow
            label={showActualVsPlanned ? "Ending balance (planned)" : "Ending Balance"}
            amount={endBal}
            hasData={Boolean(data)}
            dayEndBalance={endBal}
          />
        </section>

        <section className="fety-home-cal-period-section fety-home-cal-period-section--accounts">
          <h4 className="fety-home-cal-period-section-label">Where your money sits</h4>
          <p className="fety-home-cal-period-muted fety-home-cal-period-accounts-lede">
            End-of-day balance by account — rolls up to net worth for this date.
          </p>
          <CalendarAccountsBreakdown store={store} dateISO={dateISO} compact />
        </section>

        <section className="fety-home-cal-period-section fety-home-cal-period-section--notes">
          <h4 className="fety-home-cal-period-section-label fety-home-cal-section-label--with-icon">
            <CalendarNoteIcon size={11} />
            Notes
          </h4>
          {onAddCalendarNote ? (
            <DayNotesPanel
              dateISO={dateISO}
              notes={notesForCalendarDay(calendarNotes, dateISO)}
              onAddNote={onAddCalendarNote}
              onUpdateNote={onUpdateCalendarNote}
              onDeleteNote={onDeleteCalendarNote}
              compact
            />
          ) : notesForCalendarDay(calendarNotes, dateISO).length > 0 ? (
            <ul className="fety-home-cal-period-notes">
              {notesForCalendarDay(calendarNotes, dateISO).map((note) => (
                <li key={note.id}>{note.text.trim()}</li>
              ))}
            </ul>
          ) : (
            <p className="fety-home-cal-period-muted">No notes for this day.</p>
          )}
        </section>
      </HomeCalendarTileScroller>

      <EditTransactionModal
        open={editOpen}
        transaction={editingTransaction}
        store={store}
        onClose={() => {
          setEditOpen(false);
          setEditingTransaction(null);
        }}
        onSave={onUpdateTransaction}
        onDelete={onDeleteTransaction}
      />
    </div>
  );
}

export function HomeCalendarEquationDay({
  date,
  dateISO,
  data,
  calendarNotes,
  density,
  isSelected,
  isToday,
  onSelect,
  onOpenDay,
}: {
  date: Date;
  dateISO: string;
  data?: CalDay;
  calendarNotes?: FetyStore["calendarNotes"];
  density: "weekly" | "biweekly";
  isSelected: boolean;
  isToday: boolean;
  onSelect: (dateISO: string) => void;
  onOpenDay: (dateISO: string) => void;
}) {
  const startBal = data?.startBal ?? 0;
  const endBal = data?.endBal ?? 0;
  const items = data?.items ?? [];
  const notes = notesForCalendarDay(calendarNotes, dateISO);

  const dayHead = formatEquationDayHead(date);

  const tileBg = data || isSelected ? calendarEndingBalanceBg(endBal, isSelected) : "var(--surface)";

  return (
    <div
      role="button"
      tabIndex={0}
      className={`fety-home-cal-eq fety-home-cal-eq--${density}${isSelected ? " fety-home-cal-eq--selected" : ""}${isToday ? " fety-home-cal-eq--today" : ""}`}
      style={{ background: tileBg }}
      onClick={() => onSelect(dateISO)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(dateISO);
        }
      }}
      aria-pressed={isSelected}
    >
      <p className="fety-home-cal-eq-head">{dayHead}</p>

      <HomeCalendarTileScroller className="fety-home-cal-tile-scroll-wrap--eq">
        <EquationBalanceRow
          label="Start"
          amount={startBal}
          isSelected={isSelected}
          hasData={Boolean(data)}
          dayEndBalance={endBal}
        />

        <div className="fety-home-cal-eq-rule" aria-hidden />

        {items.length > 0 ? (
          <ul className="fety-home-cal-eq-tx">
            {items.map((item) => (
              <li key={item.id} className="fety-home-cal-eq-tx-line">
                <div className="fety-home-cal-eq-tx-title">
                  <span className="fety-home-cal-eq-tx-icon" aria-hidden>
                    {item.icon}
                  </span>
                  <span className="fety-home-cal-eq-tx-desc">{txLabel(item)}</span>
                </div>
                <div className="fety-home-cal-eq-tx-amt-row">
                  <span className="fety-home-cal-eq-tx-amt" style={{ color: calFigureColor(item.amount, endBal, isSelected) }}>
                    {signedAmount(item.amount)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="fety-home-cal-eq-empty">No transactions</p>
        )}

        <div className="fety-home-cal-eq-rule" aria-hidden />

        <EquationBalanceRow
          label="End"
          amount={endBal}
          isSelected={isSelected}
          hasData={Boolean(data)}
          dayEndBalance={endBal}
          end
        />

        {notes.length > 0 ? (
          <div className="fety-home-cal-eq-notes-block">
            <p className="fety-home-cal-eq-notes-label fety-home-cal-section-label--with-icon">
              <CalendarNoteIcon size={density === "biweekly" ? 8 : 9} />
              Notes
            </p>
            <ul className={`fety-home-cal-eq-notes${density === "biweekly" ? " fety-home-cal-eq-notes--compact" : ""}`}>
              {notes.map((note) => (
                <li key={note.id}>{note.text.trim()}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </HomeCalendarTileScroller>

      {isSelected ? (
        <div className="fety-home-cal-eq-foot">
          <HomeOpenDayButton dateISO={dateISO} onOpen={onOpenDay} className="fety-home-open-day-btn--eq" />
        </div>
      ) : null}
    </div>
  );
}
