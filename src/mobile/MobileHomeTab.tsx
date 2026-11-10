import { useCallback, useMemo, useState } from "react";
import AddTransactionModal, {
  type AddTransactionModalActions,
  type AddTransactionPayload,
} from "../components/AddTransactionModal";
import { buildCalendarMap, mergeCalendarMaps, todayISO } from "../lib/fetyCalculations";
import { calendarYearsForHomeView } from "../lib/calendarView";
import type { FetyStore } from "../types/fety";
import { HomeCalendarDailyDetail } from "../views/calendar/homeCalendarPeriodDetail";
import MobileHomeDatePicker from "./MobileHomeDatePicker";

export default function MobileHomeTab({
  store,
  selectedDateISO,
  onSelectedDateChange,
  onAddTransaction,
  addTransactionActions,
  onUpdateTransaction,
  onDeleteTransaction,
  onCompleteTransaction,
  onMarkTransactionUpcoming,
  onAddCalendarNote,
  onUpdateCalendarNote,
  onDeleteCalendarNote,
}: {
  store: FetyStore;
  selectedDateISO: string;
  onSelectedDateChange: (iso: string) => void;
  onAddTransaction: (input: AddTransactionPayload) => void;
  addTransactionActions?: AddTransactionModalActions;
  onUpdateTransaction: Parameters<typeof HomeCalendarDailyDetail>[0]["onUpdateTransaction"];
  onDeleteTransaction: (id: string) => void;
  onCompleteTransaction?: (id: string, completedAtISO?: string) => void;
  onMarkTransactionUpcoming?: (id: string) => void;
  onAddCalendarNote: (dateISO: string, text: string) => void;
  onUpdateCalendarNote: (dateISO: string, noteId: string, text: string) => void;
  onDeleteCalendarNote: (dateISO: string, noteId: string) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const focusDate = useMemo(() => new Date(`${selectedDateISO}T12:00:00`), [selectedDateISO]);
  const calendarYears = useMemo(() => calendarYearsForHomeView("monthly", focusDate), [focusDate]);
  const calendarMap = useMemo(() => mergeCalendarMaps(store, calendarYears), [store, calendarYears]);
  const dayData = calendarMap.get(selectedDateISO);
  const date = useMemo(() => new Date(`${selectedDateISO}T12:00:00`), [selectedDateISO]);

  const endingBalanceForDate = useCallback(
    (dateISO: string) => calendarMap.get(dateISO)?.endBal ?? 0,
    [calendarMap],
  );

  return (
    <div className="fety-mobile-home fety-mobile-home--split">
      <div className="fety-mobile-home-date-dock">
        <div className="fety-mobile-home-top-bar">
          <MobileHomeDatePicker
            selectedISO={selectedDateISO}
            onSelect={onSelectedDateChange}
            endingBalanceForDate={endingBalanceForDate}
          />
          <button
            type="button"
            className="fety-mobile-floating-btn fety-mobile-floating-btn--emphasis"
            onClick={() => setAddOpen(true)}
          >
            Add transaction
          </button>
        </div>
      </div>
      <div className="fety-mobile-home-scroll">
        <div className="fety-mobile-home-day">
          <HomeCalendarDailyDetail
            date={date}
            dateISO={selectedDateISO}
            data={dayData}
            calendarNotes={store.calendarNotes}
            store={store}
            onUpdateTransaction={onUpdateTransaction}
            onDeleteTransaction={onDeleteTransaction}
            onCompleteTransaction={onCompleteTransaction}
            onMarkTransactionUpcoming={onMarkTransactionUpcoming}
            onAddCalendarNote={onAddCalendarNote}
            onUpdateCalendarNote={onUpdateCalendarNote}
            onDeleteCalendarNote={onDeleteCalendarNote}
          />
        </div>
      </div>
      <AddTransactionModal
        open={addOpen}
        dateISO={selectedDateISO || todayISO()}
        store={store}
        onClose={() => setAddOpen(false)}
        onSubmit={onAddTransaction}
        actions={addTransactionActions}
      />
    </div>
  );
}
