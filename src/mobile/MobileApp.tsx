import { useEffect, useState } from "react";
import { FetyLogo } from "../FetyLogo";
import UndoToast from "../components/UndoToast";
import { todayISO } from "../lib/fetyCalculations";
import type { FinanceSummary, FetyStore, Transaction } from "../types/fety";
import type { AddTransactionModalActions, AddTransactionPayload } from "../components/AddTransactionModal";
import { ProfileSettingsView } from "../views/ManageViews";
import MobileTabBar from "./MobileTabBar";
import MobileHomeTab from "./MobileHomeTab";
import MobileTransactionsTab from "./MobileTransactionsTab";
import MobileBudgetTab from "./MobileBudgetTab";
import MobileInsightsTab from "./MobileInsightsTab";
import MobileGoalsTab from "./MobileGoalsTab";
import type { MobileTab } from "./types";

export type MobileAppData = {
  addTransaction: (input: AddTransactionPayload) => Transaction;
  updateTransaction: (
    id: string,
    updates: Partial<
      Pick<Transaction, "desc" | "amount" | "type" | "category" | "dateISO" | "fromAccountId" | "toAccountId" | "goalId">
    >,
  ) => void;
  deleteTransaction: (id: string) => void;
  completeTransaction: (id: string, completedAtISO?: string) => void;
  markTransactionUpcoming: (id: string) => void;
  updateProfile: (u: Partial<FetyStore["profile"]>) => void;
  resetAll: () => void;
  startFreshSetup: () => void;
  addCalendarNote: (dateISO: string, text: string) => void;
  deleteCalendarNote: (dateISO: string, noteId: string) => void;
  undoOffer: { label: string } | null;
  undoLastChange: () => void;
  dismissUndo: () => void;
};

export default function MobileApp({
  store,
  summary,
  data,
  addTransactionActions,
}: {
  store: FetyStore;
  summary: FinanceSummary;
  data: MobileAppData;
  addTransactionActions: AddTransactionModalActions;
}) {
  const [tab, setTab] = useState<MobileTab>("home");
  const [selectedDateISO, setSelectedDateISO] = useState(todayISO);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.fetyMobileShell = "1";
    return () => {
      delete document.documentElement.dataset.fetyMobileShell;
    };
  }, []);

  const {
    addTransaction,
    updateTransaction,
    deleteTransaction,
    completeTransaction,
    markTransactionUpcoming,
    updateProfile,
    resetAll,
    startFreshSetup,
    undoOffer,
    undoLastChange,
    dismissUndo,
  } = data;

  return (
    <div className="fety-mobile-shell">
      <header className="fety-mobile-header">
        <div className="fety-mobile-header-brand">
          <FetyLogo />
          <span className="fety-mobile-header-title">
            {tab === "home"
              ? "Daily review"
              : tab === "transactions"
                ? "Transactions"
                : tab === "budget"
                  ? "Budget"
                  : tab === "insights"
                    ? "Insights"
                    : "Goals"}
          </span>
        </div>
        <button
          type="button"
          className="fety-mobile-header-settings"
          aria-label="Account settings"
          onClick={() => setSettingsOpen(true)}
        >
          ⚙
        </button>
      </header>

      <main className="fety-mobile-main">
        {tab === "home" ? (
          <MobileHomeTab
            store={store}
            selectedDateISO={selectedDateISO}
            onSelectedDateChange={setSelectedDateISO}
            onAddTransaction={addTransaction}
            addTransactionActions={addTransactionActions}
            onUpdateTransaction={updateTransaction}
            onDeleteTransaction={deleteTransaction}
            onCompleteTransaction={completeTransaction}
            onMarkTransactionUpcoming={markTransactionUpcoming}
            onAddCalendarNote={data.addCalendarNote}
            onDeleteCalendarNote={data.deleteCalendarNote}
          />
        ) : null}
        {tab === "transactions" ? (
          <MobileTransactionsTab
            store={store}
            onAdd={addTransaction}
            addTransactionActions={addTransactionActions}
            onUpdate={updateTransaction}
            onDelete={deleteTransaction}
            onCompleteTransaction={completeTransaction}
            onMarkTransactionUpcoming={markTransactionUpcoming}
          />
        ) : null}
        {tab === "budget" ? (
          <MobileBudgetTab summary={summary} incomeStreams={store.incomeStreams} store={store} />
        ) : null}
        {tab === "insights" ? (
          <MobileInsightsTab store={store} focusDateISO={selectedDateISO} />
        ) : null}
        {tab === "goals" ? <MobileGoalsTab store={store} /> : null}
      </main>

      <MobileTabBar active={tab} onChange={setTab} />

      {settingsOpen ? (
        <div className="fety-mobile-settings-overlay" role="dialog" aria-label="Account settings">
          <div className="fety-mobile-settings-panel">
            <header className="fety-mobile-settings-head">
              <h2>Settings</h2>
              <button type="button" className="fety-mobile-link-btn" onClick={() => setSettingsOpen(false)}>
                Done
              </button>
            </header>
            <div className="fety-mobile-settings-body">
              <ProfileSettingsView
                profile={store.profile}
                onUpdateProfile={updateProfile}
                onReset={resetAll}
                onRestartSetup={() => {
                  if (confirm("Clear all data and run setup again? This cannot be undone.")) {
                    startFreshSetup();
                    setSettingsOpen(false);
                  }
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {undoOffer ? (
        <UndoToast message={undoOffer.label} onUndo={undoLastChange} onDismiss={dismissUndo} />
      ) : null}
    </div>
  );
}
