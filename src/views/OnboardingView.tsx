import { useMemo, useState } from "react";
import { FetyLogo } from "../FetyLogo";
import {
  assignmentsFromGuess,
  mappingFromAssignments,
  parseCsvText,
  rowsToImportDrafts,
  validateImportMapping,
  type ColumnRole,
  type ImportDraftRow,
  type ParsedCsv,
} from "../lib/fetyCsvImport";
import { CsvColumnMapper } from "../components/CsvColumnMapper";
import CurrencyInput, { amountToEditString } from "../components/CurrencyInput";
import { newId } from "../lib/fetyStorage";
import BillScheduleFields from "../components/BillScheduleFields";
import IncomeScheduleFields from "../components/IncomeScheduleFields";
import { getTransactionTypes } from "../lib/transactionTypes";
import type {
  Bill,
  BudgetCategory,
  FetyStore,
  IncomeStream,
  IncomeFrequency,
  RecurringTransaction,
  Transaction,
  TransactionType,
  UserProfile,
  BillFrequency,
} from "../types/fety";

type StepId = "welcome" | "profile" | "budget" | "bills" | "income" | "recurring" | "import" | "map" | "review" | "finish";

const STEPS: { id: StepId; label: string }[] = [
  { id: "welcome", label: "Welcome" },
  { id: "profile", label: "You" },
  { id: "budget", label: "Budget" },
  { id: "bills", label: "Bills" },
  { id: "income", label: "Income" },
  { id: "recurring", label: "Recurring" },
  { id: "import", label: "Import" },
  { id: "map", label: "Map" },
  { id: "review", label: "Review" },
  { id: "finish", label: "Done" },
];

type ScheduleDraftRow = {
  name: string;
  amount: string;
  dueDay: number;
  frequency: BillFrequency;
  category: string;
};

type RecurringDraftRow = ScheduleDraftRow & { transactionType: TransactionType };

type IncomeDraftRow = {
  name: string;
  amount: string;
  dueDay: number;
  frequency: IncomeFrequency;
  category: string;
  semiMonthlyDays: [number, number];
  startDateISO: string;
  endDateISO: string;
};

type BudgetDraftRow = {
  name: string;
  icon: string;
  monthlyBudget: string;
};

const STARTER_BUDGET_ROWS: BudgetDraftRow[] = [
  { name: "Housing", icon: "🏠", monthlyBudget: "" },
  { name: "Groceries", icon: "🛒", monthlyBudget: "" },
  { name: "Dining Out", icon: "🍽️", monthlyBudget: "" },
  { name: "Transportation", icon: "🚗", monthlyBudget: "" },
  { name: "Shopping", icon: "🛍️", monthlyBudget: "" },
  { name: "Bills", icon: "⚡", monthlyBudget: "" },
  { name: "Entertainment", icon: "🎬", monthlyBudget: "" },
  { name: "Personal", icon: "💆", monthlyBudget: "" },
];

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "var(--radius-ctrl)",
  border: "1px solid var(--border)",
  fontSize: 14,
  fontFamily: "inherit",
  background: "var(--surface)",
};

const btnPrimary: React.CSSProperties = {
  padding: "10px 18px",
  borderRadius: 99,
  border: "none",
  background: "var(--ink)",
  color: "#fff",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  padding: "10px 18px",
  borderRadius: 99,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

export function OnboardingView({
  store,
  onUpdateProfile,
  onReplaceCategories,
  onReplaceBills,
  onReplaceIncomeStreams,
  onReplaceRecurringTransactions,
  onImportTransactionsBulk,
  onComplete,
}: {
  store: FetyStore;
  onUpdateProfile: (u: Partial<UserProfile>) => void;
  onReplaceCategories: (categories: BudgetCategory[]) => void;
  onReplaceBills: (bills: Bill[]) => void;
  onReplaceIncomeStreams: (streams: IncomeStream[]) => void;
  onReplaceRecurringTransactions: (items: RecurringTransaction[]) => void;
  onImportTransactionsBulk: (txns: Omit<Transaction, "id">[]) => void;
  onComplete: () => void;
}) {
  const [step, setStep] = useState<StepId>("welcome");
  const [displayName, setDisplayName] = useState(store.profile.displayName);
  const [email, setEmail] = useState(store.profile.email);
  const [currency, setCurrency] = useState(store.profile.currency || "USD");
  const [startingBalance, setStartingBalance] = useState(() => amountToEditString(store.profile.startingBalance));

  const [budgetRows, setBudgetRows] = useState<BudgetDraftRow[]>(() =>
    store.categories.length > 0
      ? store.categories.map((c) => ({
          name: c.name,
          icon: c.icon,
          monthlyBudget: amountToEditString(c.monthlyBudget),
        }))
      : STARTER_BUDGET_ROWS,
  );

  const [billRows, setBillRows] = useState<ScheduleDraftRow[]>([]);
  const [incomeRows, setIncomeRows] = useState<IncomeDraftRow[]>([]);
  const [recurringRows, setRecurringRows] = useState<RecurringDraftRow[]>([]);

  const recurringTypeOptions = useMemo(
    () => getTransactionTypes(store).filter((t) => t.id !== "bill"),
    [store],
  );

  const [rawCsvText, setRawCsvText] = useState<string | null>(null);
  const [parsedCsv, setParsedCsv] = useState<ParsedCsv | null>(null);
  const [headerRowIndex, setHeaderRowIndex] = useState(0);
  const [columnAssignments, setColumnAssignments] = useState<ColumnRole[]>([]);
  const [importDrafts, setImportDrafts] = useState<ImportDraftRow[]>([]);
  const [importError, setImportError] = useState<string | null>(null);

  const reparseCsv = (text: string, headerIdx: number) => {
    const parsed = parseCsvText(text, { headerRowIndex: headerIdx });
    setParsedCsv(parsed);
    setColumnAssignments(assignmentsFromGuess(parsed.headers));
    return parsed;
  };

  const applyMappingAndPreview = () => {
    if (!parsedCsv) return false;
    const mapping = mappingFromAssignments(columnAssignments);
    const errors = validateImportMapping(mapping);
    if (errors.length > 0) {
      setImportError(errors[0]);
      return false;
    }
    const drafts = rowsToImportDrafts(parsedCsv, mapping, categoryNames);
    if (drafts.length === 0) {
      setImportError("No transaction rows found. Try another header row or column mapping.");
      return false;
    }
    setImportError(null);
    setImportDrafts(drafts);
    return true;
  };

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const categoryNames = useMemo(() => budgetRows.map((r) => r.name).filter(Boolean), [budgetRows]);

  const goNext = () => {
    const next = STEPS[stepIndex + 1]?.id;
    if (next) setStep(next);
  };

  const goBack = () => {
    const prev = STEPS[stepIndex - 1]?.id;
    if (prev) setStep(prev);
  };

  const saveProfile = () => {
    onUpdateProfile({
      displayName: displayName.trim() || "Friend",
      email: email.trim(),
      currency: currency.trim() || "USD",
      startingBalance: parseFloat(startingBalance) || 0,
    });
    goNext();
  };

  const saveBudget = () => {
    const categories: BudgetCategory[] = budgetRows
      .filter((r) => r.name.trim())
      .map((r) => ({
        id: newId("cat"),
        name: r.name.trim(),
        icon: r.icon || "📁",
        monthlyBudget: parseFloat(r.monthlyBudget) || 0,
      }));
    onReplaceCategories(categories);
    goNext();
  };

  const saveBills = () => {
    const bills: Bill[] = billRows
      .filter((b) => b.name.trim() && parseFloat(b.amount))
      .map((b) => ({
        id: newId("bill"),
        name: b.name.trim(),
        amount: parseFloat(b.amount) || 0,
        dueDay: b.dueDay,
        frequency: b.frequency,
        category: b.category.trim() || "Bills",
        icon: "📄",
      }));
    onReplaceBills(bills);
    goNext();
  };

  const saveIncomeStreams = () => {
    const streams: IncomeStream[] = incomeRows
      .filter((b) => b.name.trim() && parseFloat(b.amount))
      .map((b) => ({
        id: newId("income"),
        name: b.name.trim(),
        amount: parseFloat(b.amount) || 0,
        dueDay: b.dueDay,
        frequency: b.frequency,
        category: b.category.trim() || "Income",
        icon: "💵",
        semiMonthlyDays: b.frequency === "semimonthly" ? b.semiMonthlyDays : undefined,
        startDateISO: b.startDateISO.trim() || undefined,
        endDateISO: b.endDateISO.trim() || undefined,
      }));
    onReplaceIncomeStreams(streams);
    goNext();
  };

  const saveRecurringTransactions = () => {
    const items: RecurringTransaction[] = recurringRows
      .filter((b) => b.name.trim() && parseFloat(b.amount))
      .map((b) => ({
        id: newId("recur"),
        name: b.name.trim(),
        amount: parseFloat(b.amount) || 0,
        dueDay: b.dueDay,
        frequency: b.frequency,
        category: b.category.trim() || "Other",
        icon: "🔄",
        transactionType: b.transactionType || "expense",
      }));
    onReplaceRecurringTransactions(items);
    goNext();
  };

  const handleCsvFile = async (file: File) => {
    setImportError(null);
    const text = await file.text();
    setRawCsvText(text);
    const parsed = parseCsvText(text);
    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      setImportError("Could not read rows from that file. Export as CSV (comma or tab separated) with a header row.");
      return;
    }
    setHeaderRowIndex(parsed.headerRowIndex);
    setParsedCsv(parsed);
    setColumnAssignments(assignmentsFromGuess(parsed.headers));
    setStep("map");
  };

  const skipImport = () => {
    setImportDrafts([]);
    setStep("finish");
  };

  const commitImport = () => {
    const selected = importDrafts.filter((d) => d.include);
    const extraCategories = new Set<string>();
    selected.forEach((d) => {
      if (d.category && !categoryNames.includes(d.category) && d.category !== "Income") {
        extraCategories.add(d.category);
      }
    });
    if (extraCategories.size > 0) {
      const merged = [
        ...store.categories,
        ...[...extraCategories].map((name) => ({
          id: newId("cat"),
          name,
          icon: "📁",
          monthlyBudget: 0,
        })),
      ];
      onReplaceCategories(merged);
    }
    onImportTransactionsBulk(
      selected.map((d) => ({
        dateISO: d.dateISO,
        desc: d.desc,
        amount: d.amount,
        type: d.type,
        category: d.category,
        icon: d.icon,
      })),
    );
    setStep("finish");
  };

  const finishSetup = () => {
    onComplete();
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <header style={{ padding: "20px 28px", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
        <FetyLogo />
      </header>

      <div style={{ flex: 1, overflowY: "auto", padding: "32px 24px 48px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 28 }}>
            {STEPS.map((s, i) => (
              <div
                key={s.id}
                style={{
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  padding: "6px 10px",
                  borderRadius: 99,
                  border: `1px solid ${i <= stepIndex ? "var(--ink)" : "var(--border)"}`,
                  background: i === stepIndex ? "var(--ink)" : i < stepIndex ? "var(--paper)" : "transparent",
                  color: i === stepIndex ? "#fff" : "var(--ink-2)",
                }}
              >
                {s.label}
              </div>
            ))}
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-card)", padding: "28px 32px" }}>
            {step === "welcome" && (
              <>
                <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.03em", color: "var(--ink)", marginBottom: 10 }}>
                  Set up Fety from scratch
                </h1>
                <p style={{ fontSize: 15, color: "var(--ink-2)", lineHeight: 1.55, marginBottom: 20 }}>
                  We will walk you through your baseline balance, monthly budget categories, recurring bills and income, other repeating transactions, and optional CSV import.
                  Everything stays on this device until you change it.
                </p>
                <ul style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.7, marginBottom: 24, paddingLeft: 18 }}>
                  <li>Profile and starting balance</li>
                  <li>Monthly category caps</li>
                  <li>Bills, paychecks, and other schedules</li>
                  <li>Import past transactions from a bank CSV</li>
                </ul>
                <button type="button" style={btnPrimary} onClick={goNext}>
                  Get started
                </button>
              </>
            )}

            {step === "profile" && (
              <>
                <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>About you</h2>
                <p style={{ fontSize: 14, color: "var(--ink-2)", marginBottom: 20 }}>This powers greetings and your baseline cash position.</p>
                <div style={{ display: "grid", gap: 14 }}>
                  <div>
                    <label className="fety-label" style={{ display: "block", marginBottom: 6 }}>Display name</label>
                    <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={inputStyle} placeholder="Alex" />
                  </div>
                  <div>
                    <label className="fety-label" style={{ display: "block", marginBottom: 6 }}>Email (optional)</label>
                    <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" style={inputStyle} placeholder="you@example.com" />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 12 }}>
                    <div>
                      <label className="fety-label" style={{ display: "block", marginBottom: 6 }}>Starting balance</label>
                      <CurrencyInput value={startingBalance} onChange={setStartingBalance} placeholder="0.00" />
                    </div>
                    <div>
                      <label className="fety-label" style={{ display: "block", marginBottom: 6 }}>Currency</label>
                      <input value={currency} onChange={(e) => setCurrency(e.target.value)} style={inputStyle} placeholder="USD" />
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                  <button type="button" style={btnSecondary} onClick={goBack}>Back</button>
                  <button type="button" style={btnPrimary} onClick={saveProfile}>Continue</button>
                </div>
              </>
            )}

            {step === "budget" && (
              <>
                <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Monthly budget</h2>
                <p style={{ fontSize: 14, color: "var(--ink-2)", marginBottom: 16 }}>Set a monthly cap per category. You can edit these anytime in Budget.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 340, overflowY: "auto" }}>
                  {budgetRows.map((row, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "40px 1fr minmax(120px, 140px)", gap: 8, alignItems: "center" }}>
                      <input
                        value={row.icon}
                        onChange={(e) => {
                          const next = [...budgetRows];
                          next[i] = { ...next[i], icon: e.target.value };
                          setBudgetRows(next);
                        }}
                        style={{ ...inputStyle, textAlign: "center", padding: "8px" }}
                        aria-label="Icon"
                      />
                      <input
                        value={row.name}
                        onChange={(e) => {
                          const next = [...budgetRows];
                          next[i] = { ...next[i], name: e.target.value };
                          setBudgetRows(next);
                        }}
                        style={inputStyle}
                        placeholder="Category name"
                      />
                      <CurrencyInput
                        compact
                        value={row.monthlyBudget}
                        onChange={(monthlyBudget) => {
                          const next = [...budgetRows];
                          next[i] = { ...next[i], monthlyBudget };
                          setBudgetRows(next);
                        }}
                        placeholder="0.00"
                      />
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  style={{ ...btnSecondary, marginTop: 12 }}
                  onClick={() => setBudgetRows((r) => [...r, { name: "", icon: "📁", monthlyBudget: "" }])}
                >
                  + Add category
                </button>
                <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                  <button type="button" style={btnSecondary} onClick={goBack}>Back</button>
                  <button type="button" style={btnPrimary} onClick={saveBudget}>Continue</button>
                </div>
              </>
            )}

            {step === "bills" && (
              <>
                <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Recurring bills</h2>
                <p style={{ fontSize: 14, color: "var(--ink-2)", marginBottom: 16 }}>
                  Optional — add rent, utilities, and subscriptions. Choose how often each bill is due and which day it repeats; we&apos;ll add them to your calendar and transaction list automatically.
                </p>
                {billRows.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 12 }}>No bills yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 12 }}>
                    {billRows.map((b, i) => (
                      <div key={i} style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 12, background: "var(--surface)" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 100px 1fr auto", gap: 8, marginBottom: 10 }}>
                          <input value={b.name} onChange={(e) => { const n = [...billRows]; n[i].name = e.target.value; setBillRows(n); }} style={inputStyle} placeholder="Rent" />
                          <CurrencyInput
                            compact
                            value={b.amount}
                            onChange={(amount) => {
                              const n = [...billRows];
                              n[i].amount = amount;
                              setBillRows(n);
                            }}
                            placeholder="0.00"
                          />
                          <input value={b.category} onChange={(e) => { const n = [...billRows]; n[i].category = e.target.value; setBillRows(n); }} style={inputStyle} placeholder="Category" />
                          <button type="button" onClick={() => setBillRows(billRows.filter((_, j) => j !== i))} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--ink-3)" }}>×</button>
                        </div>
                        <BillScheduleFields
                          compact
                          frequency={b.frequency}
                          dueDay={b.dueDay}
                          onFrequencyChange={(frequency) => {
                            const n = [...billRows];
                            n[i].frequency = frequency;
                            setBillRows(n);
                          }}
                          onDueDayChange={(dueDay) => {
                            const n = [...billRows];
                            n[i].dueDay = dueDay;
                            setBillRows(n);
                          }}
                          inputStyle={inputStyle}
                        />
                      </div>
                    ))}
                  </div>
                )}
                <button type="button" style={btnSecondary} onClick={() => setBillRows((r) => [...r, { name: "", amount: "", dueDay: 1, frequency: "monthly", category: "Bills" }])}>
                  + Add bill
                </button>
                <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                  <button type="button" style={btnSecondary} onClick={goBack}>Back</button>
                  <button type="button" style={btnSecondary} onClick={() => { onReplaceBills([]); goNext(); }}>Skip</button>
                  <button type="button" style={btnPrimary} onClick={saveBills}>Continue</button>
                </div>
              </>
            )}

            {step === "income" && (
              <>
                <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Income streams</h2>
                <p style={{ fontSize: 14, color: "var(--ink-2)", marginBottom: 16 }}>
                  Optional — add paychecks, freelance deposits, or other money that arrives on a schedule. These show up on your calendar and Transactions list like bills.
                </p>
                {incomeRows.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 12 }}>No income streams yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 12 }}>
                    {incomeRows.map((b, i) => (
                      <div key={i} style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 12, background: "var(--surface)" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 100px 1fr auto", gap: 8, marginBottom: 10 }}>
                          <input value={b.name} onChange={(e) => { const n = [...incomeRows]; n[i].name = e.target.value; setIncomeRows(n); }} style={inputStyle} placeholder="Paycheck" />
                          <CurrencyInput
                            compact
                            value={b.amount}
                            onChange={(amount) => {
                              const n = [...incomeRows];
                              n[i].amount = amount;
                              setIncomeRows(n);
                            }}
                            placeholder="0.00"
                          />
                          <input value={b.category} onChange={(e) => { const n = [...incomeRows]; n[i].category = e.target.value; setIncomeRows(n); }} style={inputStyle} placeholder="Category" />
                          <button type="button" onClick={() => setIncomeRows(incomeRows.filter((_, j) => j !== i))} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--ink-3)" }}>×</button>
                        </div>
                        <IncomeScheduleFields
                          compact
                          frequency={b.frequency}
                          dueDay={b.dueDay}
                          semiMonthlyDays={b.semiMonthlyDays}
                          startDateISO={b.startDateISO}
                          endDateISO={b.endDateISO}
                          onFrequencyChange={(frequency) => {
                            const n = [...incomeRows];
                            n[i].frequency = frequency;
                            setIncomeRows(n);
                          }}
                          onDueDayChange={(dueDay) => {
                            const n = [...incomeRows];
                            n[i].dueDay = dueDay;
                            setIncomeRows(n);
                          }}
                          onSemiMonthlyDaysChange={(semiMonthlyDays) => {
                            const n = [...incomeRows];
                            n[i].semiMonthlyDays = semiMonthlyDays;
                            setIncomeRows(n);
                          }}
                          onStartDateISOChange={(startDateISO) => {
                            const n = [...incomeRows];
                            n[i].startDateISO = startDateISO;
                            setIncomeRows(n);
                          }}
                          onEndDateISOChange={(endDateISO) => {
                            const n = [...incomeRows];
                            n[i].endDateISO = endDateISO;
                            setIncomeRows(n);
                          }}
                          inputStyle={inputStyle}
                        />
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  style={btnSecondary}
                  onClick={() =>
                    setIncomeRows((r) => [
                      ...r,
                      {
                        name: "",
                        amount: "",
                        dueDay: 1,
                        frequency: "biweekly",
                        category: "Income",
                        semiMonthlyDays: [1, 15],
                        startDateISO: "",
                        endDateISO: "",
                      },
                    ])
                  }
                >
                  + Add income stream
                </button>
                <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                  <button type="button" style={btnSecondary} onClick={goBack}>Back</button>
                  <button type="button" style={btnSecondary} onClick={() => { onReplaceIncomeStreams([]); goNext(); }}>Skip</button>
                  <button type="button" style={btnPrimary} onClick={saveIncomeStreams}>Continue</button>
                </div>
              </>
            )}

            {step === "recurring" && (
              <>
                <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Recurring transactions</h2>
                <p style={{ fontSize: 14, color: "var(--ink-2)", marginBottom: 16 }}>
                  Optional — subscriptions, gym memberships, transfers, or anything else that repeats but is not a bill. Pick the transaction type so amounts flow the right way.
                </p>
                {recurringRows.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 12 }}>No recurring transactions yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 12 }}>
                    {recurringRows.map((b, i) => (
                      <div key={i} style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 12, background: "var(--surface)" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 100px 1fr 140px auto", gap: 8, marginBottom: 10 }}>
                          <input value={b.name} onChange={(e) => { const n = [...recurringRows]; n[i].name = e.target.value; setRecurringRows(n); }} style={inputStyle} placeholder="Gym" />
                          <CurrencyInput
                            compact
                            value={b.amount}
                            onChange={(amount) => {
                              const n = [...recurringRows];
                              n[i].amount = amount;
                              setRecurringRows(n);
                            }}
                            placeholder="0.00"
                          />
                          <input value={b.category} onChange={(e) => { const n = [...recurringRows]; n[i].category = e.target.value; setRecurringRows(n); }} style={inputStyle} placeholder="Category" />
                          <select
                            value={b.transactionType}
                            onChange={(e) => {
                              const n = [...recurringRows];
                              n[i].transactionType = e.target.value;
                              setRecurringRows(n);
                            }}
                            style={inputStyle}
                          >
                            {recurringTypeOptions.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.icon} {t.name}
                              </option>
                            ))}
                          </select>
                          <button type="button" onClick={() => setRecurringRows(recurringRows.filter((_, j) => j !== i))} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--ink-3)" }}>×</button>
                        </div>
                        <BillScheduleFields
                          compact
                          frequency={b.frequency}
                          dueDay={b.dueDay}
                          onFrequencyChange={(frequency) => {
                            const n = [...recurringRows];
                            n[i].frequency = frequency;
                            setRecurringRows(n);
                          }}
                          onDueDayChange={(dueDay) => {
                            const n = [...recurringRows];
                            n[i].dueDay = dueDay;
                            setRecurringRows(n);
                          }}
                          inputStyle={inputStyle}
                        />
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  style={btnSecondary}
                  onClick={() =>
                    setRecurringRows((r) => [
                      ...r,
                      { name: "", amount: "", dueDay: 1, frequency: "monthly", category: "Other", transactionType: "expense" },
                    ])
                  }
                >
                  + Add recurring transaction
                </button>
                <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                  <button type="button" style={btnSecondary} onClick={goBack}>Back</button>
                  <button type="button" style={btnSecondary} onClick={() => { onReplaceRecurringTransactions([]); goNext(); }}>Skip</button>
                  <button type="button" style={btnPrimary} onClick={saveRecurringTransactions}>Continue</button>
                </div>
              </>
            )}

            {step === "import" && (
              <>
                <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Import CSV</h2>
                <p style={{ fontSize: 14, color: "var(--ink-2)", marginBottom: 16, lineHeight: 1.55 }}>
                  Bank exports and custom spreadsheets both work. Save your sheet as CSV, then map your columns on the next step — daily cash-flow trackers, separate In/Out columns, and odd header names are fine.
                </p>
                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: 32,
                    border: "2px dashed var(--border)",
                    borderRadius: 14,
                    cursor: "pointer",
                    background: "var(--bg)",
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Choose CSV file</span>
                  <span style={{ fontSize: 11, color: "var(--ink-3)" }}>.csv or tab-separated export from Excel / Sheets</span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleCsvFile(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                {importError && <p style={{ color: "var(--trouble-dk)", fontSize: 12, marginTop: 12 }}>{importError}</p>}
                {parsedCsv && parsedCsv.headers.length > 0 && step === "import" && (
                  <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 12 }}>
                    Detected columns: {parsedCsv.headers.join(", ")}
                  </p>
                )}
                <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                  <button type="button" style={btnSecondary} onClick={goBack}>Back</button>
                  <button type="button" style={btnSecondary} onClick={skipImport}>Skip import</button>
                  {parsedCsv && (
                    <button type="button" style={btnPrimary} onClick={() => setStep("map")}>
                      Map columns
                    </button>
                  )}
                </div>
              </>
            )}

            {step === "map" && parsedCsv && rawCsvText && (
              <>
                <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Match your columns</h2>
                <p style={{ fontSize: 14, color: "var(--ink-2)", marginBottom: 16, lineHeight: 1.55 }}>
                  Tell Fety which column is the date, what happened, and where money in/out lives. We guessed from your headers — adjust anything that does not match your sheet.
                </p>
                <CsvColumnMapper
                  parsed={parsedCsv}
                  headerRowIndex={headerRowIndex}
                  onHeaderRowIndexChange={(idx) => {
                    setHeaderRowIndex(idx);
                    reparseCsv(rawCsvText, idx);
                  }}
                  columnAssignments={columnAssignments}
                  onColumnAssignmentsChange={setColumnAssignments}
                />
                {importError && <p style={{ color: "var(--trouble-dk)", fontSize: 12, marginTop: 12 }}>{importError}</p>}
                <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                  <button type="button" style={btnSecondary} onClick={() => setStep("import")}>Back</button>
                  <button
                    type="button"
                    style={btnPrimary}
                    onClick={() => {
                      if (applyMappingAndPreview()) setStep("review");
                    }}
                  >
                    Preview rows
                  </button>
                </div>
              </>
            )}

            {step === "review" && (
              <>
                <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Review import</h2>
                <p style={{ fontSize: 14, color: "var(--ink-2)", marginBottom: 12 }}>
                  Uncheck rows to exclude. Edit fields to fix dates, amounts, or categories before saving.
                </p>
                <p style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 12 }}>
                  {importDrafts.filter((d) => d.include).length} of {importDrafts.length} rows selected
                </p>
                <div style={{ maxHeight: 360, overflow: "auto", border: "1px solid var(--border)", borderRadius: 12 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: "var(--bg)", textAlign: "left" }}>
                        <th style={{ padding: 8, width: 32 }} />
                        <th style={{ padding: 8 }}>Date</th>
                        <th style={{ padding: 8 }}>Description</th>
                        <th style={{ padding: 8 }}>Type</th>
                        <th style={{ padding: 8 }}>Category</th>
                        <th style={{ padding: 8 }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importDrafts.map((row) => (
                        <tr key={row.draftId} style={{ borderTop: "1px solid var(--border)" }}>
                          <td style={{ padding: 6, textAlign: "center" }}>
                            <input
                              type="checkbox"
                              checked={row.include}
                              onChange={(e) =>
                                setImportDrafts((rows) =>
                                  rows.map((r) => (r.draftId === row.draftId ? { ...r, include: e.target.checked } : r)),
                                )
                              }
                            />
                          </td>
                          <td style={{ padding: 4 }}>
                            <input
                              type="date"
                              value={row.dateISO}
                              onChange={(e) =>
                                setImportDrafts((rows) =>
                                  rows.map((r) => (r.draftId === row.draftId ? { ...r, dateISO: e.target.value } : r)),
                                )
                              }
                              style={{ ...inputStyle, padding: "4px 6px", fontSize: 11 }}
                            />
                          </td>
                          <td style={{ padding: 4 }}>
                            <input
                              value={row.desc}
                              onChange={(e) =>
                                setImportDrafts((rows) =>
                                  rows.map((r) => (r.draftId === row.draftId ? { ...r, desc: e.target.value } : r)),
                                )
                              }
                              style={{ ...inputStyle, padding: "4px 6px", fontSize: 11 }}
                            />
                          </td>
                          <td style={{ padding: 4 }}>
                            <select
                              value={row.type}
                              onChange={(e) => {
                                const type = e.target.value as TransactionType;
                                setImportDrafts((rows) =>
                                  rows.map((r) =>
                                    r.draftId === row.draftId
                                      ? {
                                          ...r,
                                          type,
                                          amount: type === "income" ? Math.abs(r.amount) : -Math.abs(r.amount),
                                        }
                                      : r,
                                  ),
                                );
                              }}
                              style={{ ...inputStyle, padding: "4px 6px", fontSize: 11 }}
                            >
                              <option value="expense">Expense</option>
                              <option value="income">Income</option>
                              <option value="bill">Bill</option>
                              <option value="transfer">Transfer</option>
                            </select>
                          </td>
                          <td style={{ padding: 4 }}>
                            <input
                              value={row.category}
                              onChange={(e) =>
                                setImportDrafts((rows) =>
                                  rows.map((r) => (r.draftId === row.draftId ? { ...r, category: e.target.value } : r)),
                                )
                              }
                              style={{ ...inputStyle, padding: "4px 6px", fontSize: 11 }}
                            />
                          </td>
                          <td style={{ padding: 4 }}>
                            <CurrencyInput
                              compact
                              value={row.amount === 0 ? "" : String(Math.abs(row.amount))}
                              placeholder="0.00"
                              onChange={(v) => {
                                const n = v === "" || v === "." ? 0 : parseFloat(v);
                                if (v !== "" && v !== "." && !Number.isFinite(n)) return;
                                setImportDrafts((rows) =>
                                  rows.map((r) =>
                                    r.draftId === row.draftId
                                      ? {
                                          ...r,
                                          amount:
                                            r.type === "income"
                                              ? Math.abs(n)
                                              : -Math.abs(n),
                                        }
                                      : r,
                                  ),
                                );
                              }}
                              style={{ padding: "4px 6px", fontSize: 11, width: 90, borderRadius: 6 }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                  <button type="button" style={btnSecondary} onClick={() => setStep("map")}>Back</button>
                  <button type="button" style={btnPrimary} onClick={commitImport}>Import selected</button>
                </div>
              </>
            )}

            {step === "finish" && (
              <>
                <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>You are ready</h2>
                <p style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.55, marginBottom: 20 }}>
                  Your profile, budget, scheduled bills and income{importDrafts.length ? ", and imported transactions" : ""} are saved locally.
                  Use the chat to log new spending, or open Transactions and Calendar anytime.
                </p>
                <button type="button" style={btnPrimary} onClick={finishSetup}>
                  Open Fety
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
