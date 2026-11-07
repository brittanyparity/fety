import { useMemo, useState } from "react";
import AddTransactionModal, {
  type AddTransactionModalActions,
  type AddTransactionPayload,
} from "../components/AddTransactionModal";
import { buildCalendarMap, mergeCalendarMaps, todayISO } from "../lib/fetyCalculations";
import { calendarYearsForHomeView } from "../lib/calendarView";
import type { FetyStore } from "../types/fety";
import { HomeCalendarDailyDetail } from "../views/calendar/homeCalendarPeriodDetail";
import MobileDateStrip from "./MobileDateStrip";

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
  onDeleteCalendarNote: (dateISO: string, noteId: string) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const focusDate = useMemo(() => new Date(`${selectedDateISO}T12:00:00`), [selectedDateISO]);
  const calendarYears = useMemo(() => calendarYearsForHomeView("monthly", focusDate), [focusDate]);
  const calendarMap = useMemo(() => mergeCalendarMaps(store, calendarYears), [store, calendarYears]);
  const dayData = calendarMap.get(selectedDateISO);
  const date = useMemo(() => new Date(`${selectedDateISO}T12:00:00`), [selectedDateISO]);

  return (
    <div className="fety-mobile-home">
      <MobileDateStrip selectedISO={selectedDateISO} onSelect={onSelectedDateChange} calendarMap={calendarMap} />
      <div className="fety-mobile-home-toolbar">
        <button type="button" className="fety-mobile-primary-btn" onClick={() => setAddOpen(true)}>
          Add transaction
        </button>
      </div>
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
        />
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
