import { useEffect, useState } from "react";
import { FetyLogo } from "../FetyLogo";
import UndoToast from "../components/UndoToast";
import { todayISO } from "../lib/fetyCalculations";
import type { FinanceSummary, FetyStore, Transaction } from "../types/fety";
import type { AddTransactionModalActions, AddTransactionPayload } from "../components/AddTransactionModal";
import { NetWorthManageView, ProfileSettingsView } from "../views/ManageViews";
import { MobileSettingsIcon } from "./MobileNavIcons";
import MobileTabBar from "./MobileTabBar";
import MobileHomeTab from "./MobileHomeTab";
import MobileTransactionsTab from "./MobileTransactionsTab";
import MobileBudgetTab from "./MobileBudgetTab";
import MobileInsightsTab from "./MobileInsightsTab";
import MobileGoalsTab from "./MobileGoalsTab";
import type { MobileManageActions, MobileTab } from "./types";

export type MobileAppData = {
  addTransaction: (input: AddTransactionPayload) => Transaction;
  updateTransaction: (
    id: string,
    updates: Partial<
      Pick<
        Transaction,
        | "desc"
        | "amount"
        | "type"
        | "category"
        | "dateISO"
        | "fromAccountId"
        | "toAccountId"
        | "goalId"
        | "postingStatus"
        | "completedAtISO"
      >
    >,
  ) => void;
  deleteTransaction: (id: string) => void;
  completeTransaction: (id: string, completedAtISO?: string) => void;
  markTransactionUpcoming: (id: string) => void;
  updateProfile: (u: Partial<FetyStore["profile"]>) => void;
  resetAll: () => void;
  startFreshSetup: () => void;
  addCalendarNote: (dateISO: string, text: string) => void;
  updateCalendarNote: (dateISO: string, noteId: string, text: string) => void;
  deleteCalendarNote: (dateISO: string, noteId: string) => void;
  undoOffer: { label: string } | null;
  undoLastChange: () => void;
  dismissUndo: () => void;
  manage: MobileManageActions;
};

type SettingsSection = "profile" | "networth";

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
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("profile");
  const [transactionsAccountFilter, setTransactionsAccountFilter] = useState<string | null>(null);

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
    manage,
  } = data;

  const pageTitle =
    tab === "home"
      ? "Daily review"
      : tab === "transactions"
        ? "Transactions"
        : tab === "budget"
          ? "Budget"
          : tab === "insights"
            ? "Insights"
            : "Goals";

  const openTransactionsForAccount = (accountId: string) => {
    setTransactionsAccountFilter(accountId);
    setTab("transactions");
    setSettingsOpen(false);
  };

  return (
    <div className="fety-mobile-shell">
      <header className="fety-mobile-header">
        <div className="fety-mobile-header-slot fety-mobile-header-slot--left">
          <FetyLogo />
        </div>
        <h1 className="fety-mobile-header-title">{pageTitle}</h1>
        <div className="fety-mobile-header-slot fety-mobile-header-slot--right">
          <button
            type="button"
            className="fety-mobile-header-settings"
            aria-label="Account settings"
            onClick={() => {
              setSettingsSection("profile");
              setSettingsOpen(true);
            }}
          >
            <MobileSettingsIcon />
          </button>
        </div>
      </header>

      <main
        className={`fety-mobile-main${tab === "home" ? " fety-mobile-main--home" : ""}${tab === "transactions" ? " fety-mobile-main--transactions" : ""}`}
      >
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
            onUpdateCalendarNote={data.updateCalendarNote}
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
            accountFilter={transactionsAccountFilter}
          />
        ) : null}
        {tab === "budget" ? <MobileBudgetTab summary={summary} store={store} actions={manage} /> : null}
        {tab === "insights" ? <MobileInsightsTab store={store} focusDateISO={selectedDateISO} /> : null}
        {tab === "goals" ? <MobileGoalsTab store={store} actions={manage} /> : null}
      </main>

      <MobileTabBar active={tab} onChange={setTab} />

      {settingsOpen ? (
        <div className="fety-mobile-settings-overlay" role="dialog" aria-label="Settings">
          <div className="fety-mobile-settings-panel">
            <header className="fety-mobile-settings-head">
              <h2>Settings</h2>
              <button type="button" className="fety-mobile-link-btn" onClick={() => setSettingsOpen(false)}>
                Done
              </button>
            </header>
            <div className="fety-mobile-settings-segments" role="tablist" aria-label="Settings sections">
              <button
                type="button"
                role="tab"
                aria-selected={settingsSection === "profile"}
                className={`fety-mobile-settings-segment${settingsSection === "profile" ? " fety-mobile-settings-segment--active" : ""}`}
                onClick={() => setSettingsSection("profile")}
              >
                Profile
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={settingsSection === "networth"}
                className={`fety-mobile-settings-segment${settingsSection === "networth" ? " fety-mobile-settings-segment--active" : ""}`}
                onClick={() => setSettingsSection("networth")}
              >
                Net worth
              </button>
            </div>
            <div className="fety-mobile-settings-body">
              {settingsSection === "profile" ? (
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
              ) : (
                <NetWorthManageView
                  accounts={store.accounts}
                  ledgerStore={store}
                  onUpdateAccount={manage.updateAccount}
                  onAddAccount={manage.addAccount}
                  onDeleteAccount={manage.deleteAccount}
                  onReconcileAccount={manage.reconcileAccount}
                  onOpenTransactionsForAccount={openTransactionsForAccount}
                />
              )}
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
