import { useMemo, useState } from "react";
import CalendarAccountsBreakdown from "../../components/CalendarAccountsBreakdown";
import CalendarNoteIcon from "../../components/CalendarNoteIcon";
import EditTransactionModal from "../../components/EditTransactionModal";
import { notesForCalendarDay } from "../../lib/calendarNotes";
import { calendarEndingBalanceBg, calBalanceColor, calSignedColor } from "../../lib/calendarUi";
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
}: {
  label: string;
  amount: number;
  hasData: boolean;
}) {
  return (
    <div className="fety-home-cal-period-bal-row">
      <span className="fety-home-cal-period-bal-label">{label}</span>
      <p className="fety-home-cal-period-balance" style={{ color: calBalanceColor(amount) }}>
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
  end,
}: {
  label: string;
  amount: number;
  isSelected: boolean;
  hasData: boolean;
  end?: boolean;
}) {
  return (
    <div className="fety-home-cal-eq-bal-row">
      <span className="fety-home-cal-eq-bal-label">{label}</span>
      <p
        className={`fety-home-cal-eq-value${end ? " fety-home-cal-eq-value--end" : ""}`}
        style={{ color: calBalanceColor(amount, isSelected) }}
      >
        {hasData ? usdFull(amount) : "—"}
      </p>
    </div>
  );
}

function DayNotesList({ dateISO, calendarNotes }: { dateISO: string; calendarNotes?: FetyStore["calendarNotes"] }) {
  const notes = notesForCalendarDay(calendarNotes, dateISO);
  if (notes.length === 0) return null;
  return (
    <ul className="fety-home-cal-period-notes">
      {notes.map((note) => (
        <li key={note.id}>{note.text.trim()}</li>
      ))}
    </ul>
  );
}

function DayTransactionsList({
  items,
  emptyLabel = "No transactions on this day.",
  onEditItem,
}: {
  items: CalDayItem[];
  emptyLabel?: string;
  onEditItem: (item: CalDayItem) => void;
}) {
  if (items.length === 0) {
    return <p className="fety-home-cal-period-muted">{emptyLabel}</p>;
  }
  return (
    <ul className="fety-home-cal-period-tx-list">
      {items.map((item) => (
        <li key={item.id}>
          <div
            className="fety-home-cal-period-tx-row fety-home-cal-period-tx-row--interactive"
            role="button"
            tabIndex={0}
            onClick={() => onEditItem(item)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onEditItem(item);
              }
            }}
          >
            <span className="fety-home-cal-period-tx-icon" aria-hidden>
              {item.icon}
            </span>
            <span className="fety-home-cal-period-tx-name">{txLabel(item)}</span>
            <span className="fety-home-cal-period-tx-amt" style={{ color: calSignedColor(item.amount) }}>
              {signedAmount(item.amount)}
            </span>
            <button
              type="button"
              className="fety-home-cal-period-tx-edit"
              onClick={(e) => {
                e.stopPropagation();
                onEditItem(item);
              }}
            >
              Edit
            </button>
          </div>
        </li>
      ))}
    </ul>
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
}: {
  date: Date;
  dateISO: string;
  data?: CalDay;
  calendarNotes?: FetyStore["calendarNotes"];
  store: FetyStore;
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
}) {
  const startBal = data?.startBal ?? 0;
  const endBal = data?.endBal ?? 0;
  const items = data?.items ?? [];
  const txById = useMemo(() => new Map(store.transactions.map((t) => [t.id, t])), [store.transactions]);
  const [editOpen, setEditOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

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
    <div className="fety-home-cal-period fety-home-cal-period--daily">
      <header className="fety-home-cal-period-header">
        <div>
          <p className="fety-label">What this day looks like</p>
          <h3 className="fety-home-cal-period-title">
            {date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </h3>
        </div>
      </header>

      <HomeCalendarTileScroller className="fety-home-cal-tile-scroll-wrap--daily">
        <section className="fety-home-cal-period-section">
          <DailyBalanceRow label="Starting Balance" amount={startBal} hasData={Boolean(data)} />
        </section>

        <section className="fety-home-cal-period-section">
          <h4 className="fety-home-cal-period-section-label">Transactions</h4>
          <DayTransactionsList items={items} onEditItem={openEdit} />
        </section>

        <section className="fety-home-cal-period-section">
          <DailyBalanceRow label="Ending Balance" amount={endBal} hasData={Boolean(data)} />
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
          {notesForCalendarDay(calendarNotes, dateISO).length > 0 ? (
            <DayNotesList dateISO={dateISO} calendarNotes={calendarNotes} />
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
        <EquationBalanceRow label="Start" amount={startBal} isSelected={isSelected} hasData={Boolean(data)} />

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
                  <span className="fety-home-cal-eq-tx-amt" style={{ color: calSignedColor(item.amount, isSelected) }}>
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

        <EquationBalanceRow label="End" amount={endBal} isSelected={isSelected} hasData={Boolean(data)} end />

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
