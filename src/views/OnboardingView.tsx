import { useMemo, useState } from "react";
import { FetyLogo } from "../FetyLogo";
import CurrencyInput, { amountToEditString } from "../components/CurrencyInput";
import DayOfMonthInput from "../components/DayOfMonthInput";
import { todayISO } from "../lib/fetyCalculations";
import { newId } from "../lib/fetyStorage";
import { isRemovedBudgetCategoryName } from "../lib/transactionCategories";
import { everydayToStoredSchedule, roundMoney, type EverydayFrequency } from "../lib/scheduleAmounts";
import type {
  Bill,
  BillFrequency,
  BudgetCategory,
  Goal,
  IncomeFrequency,
  IncomeStream,
  RecurringTransaction,
  TransactionType,
  UserProfile,
} from "../types/fety";

/**
 * Conversational setup mapped directly onto Budget page sections:
 * Income → Income streams
 * Bills → Bills
 * Budget categories → Category budgets
 * Recurring → Recurring expenses / transfers
 * (+ goals + starting balance for the rest of the system / calendar)
 */
type Phase =
  | "welcome"
  | "about"
  | "income-pick"
  | "income-edit"
  | "bills-pick"
  | "bill-edit"
  | "categories-pick"
  | "category-edit"
  | "recurring-pick"
  | "recurring-edit"
  | "goals"
  | "goal-edit"
  | "starting";

const SETUP_STAGES: { label: string; phases: Phase[] }[] = [
  { label: "About you", phases: ["welcome", "about"] },
  { label: "Income", phases: ["income-pick", "income-edit"] },
  { label: "Bills", phases: ["bills-pick", "bill-edit"] },
  { label: "Budget categories", phases: ["categories-pick", "category-edit"] },
  { label: "Recurring items", phases: ["recurring-pick", "recurring-edit"] },
  { label: "Goals & starting point", phases: ["goals", "goal-edit", "starting"] },
];

type IncomeDraft = {
  key: string;
  name: string;
  icon: string;
  amount: string;
  frequency: IncomeFrequency;
  dueDay: number;
  semiMonthlyDays: [number, number];
};

type BillDraft = {
  key: string;
  name: string;
  icon: string;
  category: string;
  amount: string;
  frequency: BillFrequency;
  dueDay: number;
};

type CategoryDraft = {
  key: string;
  name: string;
  icon: string;
  monthlyBudget: string;
};

type RecurringDraft = {
  key: string;
  name: string;
  icon: string;
  category: string;
  amount: string;
  frequency: EverydayFrequency;
  transactionType: TransactionType;
};

const INCOME_PRESETS = [
  { name: "Paycheck", icon: "💵" },
  { name: "Social Security", icon: "🏛️" },
  { name: "Retirement", icon: "🏖️" },
  { name: "Disability", icon: "♿" },
  { name: "Freelance", icon: "💻" },
  { name: "Gig work", icon: "🚗" },
  { name: "Business income", icon: "🏢" },
  { name: "Rental income", icon: "🏠" },
  { name: "Investment income", icon: "📈" },
  { name: "Child support", icon: "👶" },
  { name: "Alimony", icon: "🤝" },
  { name: "Other", icon: "✨" },
] as const;

const BILL_PRESETS = [
  { name: "Rent", icon: "🏠", category: "Housing" },
  { name: "Mortgage", icon: "🏡", category: "Housing" },
  { name: "Electric", icon: "⚡", category: "Utilities" },
  { name: "Gas utility", icon: "🔥", category: "Utilities" },
  { name: "Water", icon: "💧", category: "Utilities" },
  { name: "Insurance", icon: "🛡️", category: "Insurance" },
  { name: "Phone", icon: "📱", category: "Subscriptions" },
  { name: "Internet", icon: "🌐", category: "Subscriptions" },
  { name: "Car payment", icon: "🚗", category: "Transportation" },
  { name: "Debt payment", icon: "💳", category: "Debt" },
  { name: "Tuition", icon: "🎓", category: "Education" },
  { name: "Taxes", icon: "🧾", category: "Taxes" },
] as const;

/** Things the user wants to plan spending for — become Budget categories. */
const CATEGORY_PRESETS = [
  { name: "Groceries", icon: "🛒" },
  { name: "Dining", icon: "🍽️" },
  { name: "Transportation", icon: "⛽" },
  { name: "Shopping", icon: "🛍️" },
  { name: "Entertainment", icon: "🎬" },
  { name: "Personal care", icon: "💆" },
  { name: "Health", icon: "💊" },
  { name: "Pets", icon: "🐾" },
  { name: "Kids", icon: "🧸" },
  { name: "Hobbies", icon: "🎨" },
  { name: "Home", icon: "🧹" },
  { name: "Gifts", icon: "🎁" },
] as const;

/** Recurring expenses / transfers — become Budget recurring items (+ calendar). */
const RECURRING_PRESETS = [
  { name: "Streaming", icon: "📺", category: "Subscriptions", transactionType: "expense" as const },
  { name: "Gym", icon: "🏋️", category: "Health", transactionType: "expense" as const },
  { name: "Software", icon: "💻", category: "Subscriptions", transactionType: "expense" as const },
  { name: "Coffee habit", icon: "☕", category: "Dining", transactionType: "expense" as const },
  { name: "Allowance", icon: "💵", category: "Personal", transactionType: "expense" as const },
  { name: "Savings transfer", icon: "🏦", category: "Savings", transactionType: "transfer" as const },
  { name: "Investment transfer", icon: "📈", category: "Savings", transactionType: "transfer" as const },
  { name: "Medication", icon: "💊", category: "Health", transactionType: "expense" as const },
] as const;

const GOAL_PRESETS = [
  { name: "Emergency fund", icon: "🛟" },
  { name: "Vacation", icon: "✈️" },
  { name: "Debt payoff", icon: "💳" },
  { name: "Home", icon: "🏠" },
  { name: "Car", icon: "🚗" },
  { name: "Savings", icon: "🎯" },
  { name: "Retirement", icon: "🏖️" },
  { name: "Major purchase", icon: "🎁" },
] as const;

const INCOME_FREQ: { id: IncomeFrequency; label: string }[] = [
  { id: "weekly", label: "Every week" },
  { id: "biweekly", label: "Every 2 weeks" },
  { id: "semimonthly", label: "Twice a month" },
  { id: "monthly", label: "Every month" },
];

const BILL_FREQ: { id: BillFrequency; label: string }[] = [
  { id: "weekly", label: "Every week" },
  { id: "biweekly", label: "Every 2 weeks" },
  { id: "monthly", label: "Every month" },
  { id: "quarterly", label: "Every 3 months" },
];

const RECURRING_FREQ: { id: EverydayFrequency; label: string }[] = [
  { id: "weekday", label: "Every weekday" },
  { id: "weekly", label: "Every week" },
  { id: "biweekly", label: "Every 2 weeks" },
  { id: "monthly", label: "Every month" },
];

function Chip({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon?: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`fety-talk-chip${active ? " fety-talk-chip-active" : ""}`}
      aria-pressed={active}
      onClick={onClick}
    >
      {icon ? <span aria-hidden>{icon}</span> : null}
      <span>{label}</span>
    </button>
  );
}

function Prompt({ title, body }: { title: string; body?: string }) {
  return (
    <div className="fety-talk-prompt">
      <h2>{title}</h2>
      {body ? <p>{body}</p> : null}
    </div>
  );
}

function upsertCategory(
  categories: BudgetCategory[],
  name: string,
  icon: string,
  monthlyBudget: number,
): BudgetCategory[] {
  const trimmed = name.trim();
  if (!trimmed || isRemovedBudgetCategoryName(trimmed)) return categories;
  const existing = categories.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) {
    return categories.map((c) =>
      c.id === existing.id
        ? { ...c, monthlyBudget: roundMoney(Math.max(c.monthlyBudget, monthlyBudget)), icon: c.icon || icon }
        : c,
    );
  }
  return [...categories, { id: newId("cat"), name: trimmed, icon, monthlyBudget: roundMoney(monthlyBudget) }];
}

export function OnboardingView({
  onFinishSetup,
}: {
  onFinishSetup: (payload: {
    profile: UserProfile;
    categories: BudgetCategory[];
    bills: Bill[];
    incomeStreams: IncomeStream[];
    recurringTransactions: RecurringTransaction[];
    goals: Goal[];
  }) => void;
}) {
  const [phase, setPhase] = useState<Phase>("welcome");
  const [displayName, setDisplayName] = useState("");
  const [incomes, setIncomes] = useState<IncomeDraft[]>([]);
  const [incomeIndex, setIncomeIndex] = useState(0);
  const [customIncome, setCustomIncome] = useState("");
  const [bills, setBills] = useState<BillDraft[]>([]);
  const [billIndex, setBillIndex] = useState(0);
  const [customBill, setCustomBill] = useState("");
  const [categories, setCategories] = useState<CategoryDraft[]>([]);
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [customCategory, setCustomCategory] = useState("");
  const [recurring, setRecurring] = useState<RecurringDraft[]>([]);
  const [recurringIndex, setRecurringIndex] = useState(0);
  const [customRecurring, setCustomRecurring] = useState("");
  const [goalName, setGoalName] = useState("");
  const [goalIcon, setGoalIcon] = useState("🎯");
  const [goalTarget, setGoalTarget] = useState("");
  const [customGoal, setCustomGoal] = useState("");
  const [startingBalance, setStartingBalance] = useState("");
  const [balanceAsOfISO, setBalanceAsOfISO] = useState(todayISO);

  const phaseOrder: Phase[] = useMemo(
    () => [
      "welcome",
      "about",
      "income-pick",
      "income-edit",
      "bills-pick",
      "bill-edit",
      "categories-pick",
      "category-edit",
      "recurring-pick",
      "recurring-edit",
      "goals",
      "goal-edit",
      "starting",
    ],
    [],
  );

  const go = (next: Phase) => setPhase(next);
  const back = () => {
    if (phase === "income-edit" && incomeIndex > 0) {
      setIncomeIndex((n) => n - 1);
      return;
    }
    if (phase === "bill-edit" && billIndex > 0) {
      setBillIndex((n) => n - 1);
      return;
    }
    if (phase === "category-edit" && categoryIndex > 0) {
      setCategoryIndex((n) => n - 1);
      return;
    }
    if (phase === "recurring-edit" && recurringIndex > 0) {
      setRecurringIndex((n) => n - 1);
      return;
    }
    const skip: Partial<Record<Phase, Phase>> = {
      "income-edit": "income-pick",
      "bill-edit": "bills-pick",
      "category-edit": "categories-pick",
      "recurring-edit": "recurring-pick",
      "goal-edit": "goals",
      "bills-pick": incomes.length ? "income-edit" : "income-pick",
      "categories-pick": bills.length ? "bill-edit" : "bills-pick",
      "recurring-pick": categories.length ? "category-edit" : "categories-pick",
      goals: recurring.length ? "recurring-edit" : "recurring-pick",
      starting: goalName ? "goal-edit" : "goals",
    };
    const fallback = skip[phase];
    if (fallback) {
      setPhase(fallback);
      return;
    }
    const i = phaseOrder.indexOf(phase);
    if (i > 0) setPhase(phaseOrder[i - 1]);
  };

  const toggleIncome = (preset: (typeof INCOME_PRESETS)[number]) => {
    setIncomes((rows) => {
      const exists = rows.some((r) => r.name === preset.name);
      if (exists) return rows.filter((r) => r.name !== preset.name);
      return [
        ...rows,
        {
          key: newId("inc"),
          name: preset.name,
          icon: preset.icon,
          amount: "",
          frequency: preset.name === "Paycheck" ? "semimonthly" : "monthly",
          dueDay: 1,
          semiMonthlyDays: [1, 15],
        },
      ];
    });
  };

  const addCustomIncome = () => {
    const name = customIncome.trim();
    if (!name) return;
    setIncomes((rows) => [
      ...rows,
      {
        key: newId("inc"),
        name,
        icon: "✨",
        amount: "",
        frequency: "monthly",
        dueDay: 1,
        semiMonthlyDays: [1, 15],
      },
    ]);
    setCustomIncome("");
  };

  const toggleBill = (preset: (typeof BILL_PRESETS)[number]) => {
    setBills((rows) => {
      const exists = rows.some((r) => r.name === preset.name);
      if (exists) return rows.filter((r) => r.name !== preset.name);
      return [
        ...rows,
        {
          key: newId("bill"),
          name: preset.name,
          icon: preset.icon,
          category: preset.category,
          amount: "",
          frequency: "monthly",
          dueDay: 1,
        },
      ];
    });
  };

  const addCustomBill = () => {
    const name = customBill.trim();
    if (!name) return;
    setBills((rows) => [
      ...rows,
      {
        key: newId("bill"),
        name,
        icon: "✨",
        category: name,
        amount: "",
        frequency: "monthly",
        dueDay: 1,
      },
    ]);
    setCustomBill("");
  };

  const toggleCategory = (preset: (typeof CATEGORY_PRESETS)[number]) => {
    setCategories((rows) => {
      const exists = rows.some((r) => r.name === preset.name);
      if (exists) return rows.filter((r) => r.name !== preset.name);
      return [
        ...rows,
        {
          key: newId("catd"),
          name: preset.name,
          icon: preset.icon,
          monthlyBudget: "",
        },
      ];
    });
  };

  const addCustomCategory = () => {
    const name = customCategory.trim();
    if (!name) return;
    setCategories((rows) => [
      ...rows,
      {
        key: newId("catd"),
        name,
        icon: "✨",
        monthlyBudget: "",
      },
    ]);
    setCustomCategory("");
  };

  const toggleRecurring = (preset: (typeof RECURRING_PRESETS)[number]) => {
    setRecurring((rows) => {
      const exists = rows.some((r) => r.name === preset.name);
      if (exists) return rows.filter((r) => r.name !== preset.name);
      return [
        ...rows,
        {
          key: newId("recd"),
          name: preset.name,
          icon: preset.icon,
          category: preset.category,
          amount: "",
          frequency: "monthly",
          transactionType: preset.transactionType,
        },
      ];
    });
  };

  const addCustomRecurring = () => {
    const name = customRecurring.trim();
    if (!name) return;
    setRecurring((rows) => [
      ...rows,
      {
        key: newId("recd"),
        name,
        icon: "✨",
        category: name,
        amount: "",
        frequency: "monthly",
        transactionType: "expense",
      },
    ]);
    setCustomRecurring("");
  };

  const finish = () => {
    let nextCategories: BudgetCategory[] = [];

    const startISO = balanceAsOfISO || todayISO();
    const streams: IncomeStream[] = incomes
      .filter((row) => parseFloat(row.amount) > 0)
      .map((row) => ({
        id: newId("income"),
        name: row.name,
        amount: parseFloat(row.amount) || 0,
        dueDay: row.dueDay,
        frequency: row.frequency,
        category: "Income",
        icon: row.icon,
        startDateISO: startISO,
        semiMonthlyDays: row.frequency === "semimonthly" ? row.semiMonthlyDays : undefined,
      }));

    const nextBills: Bill[] = bills
      .filter((row) => parseFloat(row.amount) > 0)
      .map((row) => {
        // Bills get a category stub so Budget grouping stays coherent; amounts live on the bill.
        nextCategories = upsertCategory(nextCategories, row.category, row.icon, 0);
        return {
          id: newId("bill"),
          name: row.name,
          amount: parseFloat(row.amount) || 0,
          dueDay: row.dueDay,
          frequency: row.frequency,
          category: row.category,
          icon: row.icon,
        };
      });

    for (const row of categories) {
      const monthly = parseFloat(row.monthlyBudget) || 0;
      nextCategories = upsertCategory(nextCategories, row.name, row.icon, monthly);
    }

    const nextRecurring: RecurringTransaction[] = recurring
      .filter((row) => parseFloat(row.amount) > 0)
      .map((row) => {
        const raw = parseFloat(row.amount) || 0;
        const stored = everydayToStoredSchedule(raw, row.frequency);
        // Keep category list complete when a recurring item references one.
        nextCategories = upsertCategory(nextCategories, row.category, row.icon, 0);
        return {
          id: newId("recur"),
          name: row.name,
          amount: stored.amount,
          dueDay: 1,
          frequency: stored.frequency,
          category: row.category,
          icon: row.icon,
          transactionType: row.transactionType,
        };
      });

    const goals: Goal[] =
      goalName.trim() && parseFloat(goalTarget) > 0
        ? [
            {
              id: newId("goal"),
              name: goalName.trim(),
              icon: goalIcon,
              target: parseFloat(goalTarget) || 0,
              saved: 0,
              targetDate: "",
              monthlyContribution: 0,
            },
          ]
        : [];

    onFinishSetup({
      profile: {
        displayName: displayName.trim() || "Friend",
        email: "",
        currency: "USD",
        startingBalance: parseFloat(startingBalance) || 0,
        balanceAsOfISO: balanceAsOfISO || todayISO(),
      },
      categories: nextCategories,
      incomeStreams: streams,
      bills: nextBills,
      recurringTransactions: nextRecurring,
      goals,
    });
  };

  const stageIndex = Math.max(0, SETUP_STAGES.findIndex((s) => s.phases.includes(phase)));
  const stage = SETUP_STAGES[stageIndex];
  const stagePct = Math.round(((stageIndex + 1) / SETUP_STAGES.length) * 100);
  const currentIncome = incomes[incomeIndex];
  const currentBill = bills[billIndex];
  const currentCategory = categories[categoryIndex];
  const currentRecurring = recurring[recurringIndex];

  const actions = (opts: {
    back?: boolean;
    skip?: () => void;
    nextLabel?: string;
    onNext: () => void;
    nextDisabled?: boolean;
  }) => (
    <div className="fety-talk-actions">
      {opts.back !== false && phase !== "welcome" ? (
        <button type="button" className="fety-splash-btn-ghost" onClick={back}>
          Back
        </button>
      ) : null}
      {opts.skip ? (
        <button type="button" className="fety-talk-skip" onClick={opts.skip}>
          Skip for now
        </button>
      ) : null}
      <button
        type="button"
        className="fety-splash-btn-primary fety-splash-btn-lg"
        onClick={opts.onNext}
        disabled={opts.nextDisabled}
      >
        {opts.nextLabel ?? "Continue"}
      </button>
    </div>
  );

  return (
    <div className="fety-onboarding fety-talk">
      <header className="fety-onboarding-header">
        <FetyLogo />
      </header>
      <div className="fety-onboarding-scroll">
        <div className="fety-talk-inner">
          <div className="fety-talk-progress" aria-label={`Setup progress: ${stage.label}`}>
            <p className="fety-talk-progress-kicker">We'll set up your Budget as we go.</p>
            <div className="fety-talk-progress-row">
              <span className="fety-label">{stage.label}</span>
              <span className="fety-talk-progress-count">
                {stageIndex + 1} of {SETUP_STAGES.length}
              </span>
            </div>
            <div
              className="fety-talk-progress-track"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={SETUP_STAGES.length}
              aria-valuenow={stageIndex + 1}
              aria-valuetext={`${stage.label}, step ${stageIndex + 1} of ${SETUP_STAGES.length}`}
            >
              <div className="fety-talk-progress-fill" style={{ width: `${stagePct}%` }} />
            </div>
          </div>

          {phase === "welcome" && (
            <>
              <Prompt
                title="Let's set up your Budget together."
                body="I'll ask about income, bills, the categories you want to plan for, and any recurring expenses or transfers. Everything you add here shows up on your Budget page and on the calendar."
              />
              {actions({ back: false, nextLabel: "Let's get started", onNext: () => go("about") })}
            </>
          )}

          {phase === "about" && (
            <>
              <Prompt title="What should I call you?" body="This stays on this device. You can skip it if you'd rather not say." />
              <label className="fety-talk-field">
                <span className="fety-label">Name</span>
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Alex" autoComplete="name" />
              </label>
              {actions({ skip: () => go("income-pick"), onNext: () => go("income-pick") })}
            </>
          )}

          {phase === "income-pick" && (
            <>
              <Prompt
                title="Where does your money come from?"
                body="These become your Income items on the Budget page — and they show up on the calendar when they're due."
              />
              <div className="fety-talk-chips">
                {INCOME_PRESETS.map((p) => (
                  <Chip key={p.name} icon={p.icon} label={p.name} active={incomes.some((r) => r.name === p.name)} onClick={() => toggleIncome(p)} />
                ))}
              </div>
              <div className="fety-talk-custom">
                <input
                  value={customIncome}
                  onChange={(e) => setCustomIncome(e.target.value)}
                  placeholder="Add your own income type"
                  onKeyDown={(e) => e.key === "Enter" && addCustomIncome()}
                />
                <button type="button" className="fety-splash-btn-ghost" onClick={addCustomIncome}>
                  Add
                </button>
              </div>
              {actions({
                skip: () => {
                  setIncomes([]);
                  go("bills-pick");
                },
                nextLabel: incomes.length ? "Next" : "I don't get regular income",
                onNext: () => {
                  if (incomes.length === 0) go("bills-pick");
                  else {
                    setIncomeIndex(0);
                    go("income-edit");
                  }
                },
              })}
            </>
          )}

          {phase === "income-edit" && currentIncome && (
            <>
              <Prompt
                title={`About how much do you usually receive from ${currentIncome.name}?`}
                body={`${incomeIndex + 1} of ${incomes.length}. I'm not sure is okay — skip this one and keep going.`}
              />
              <label className="fety-talk-field">
                <span className="fety-label">Amount</span>
                <CurrencyInput
                  value={currentIncome.amount}
                  onChange={(v) => setIncomes((rows) => rows.map((r, i) => (i === incomeIndex ? { ...r, amount: v } : r)))}
                  placeholder="0.00"
                />
              </label>
              <p className="fety-label" style={{ marginBottom: 8 }}>
                How often does it come in?
              </p>
              <div className="fety-talk-chips">
                {INCOME_FREQ.map((f) => (
                  <Chip
                    key={f.id}
                    label={f.label}
                    active={currentIncome.frequency === f.id}
                    onClick={() => setIncomes((rows) => rows.map((r, i) => (i === incomeIndex ? { ...r, frequency: f.id } : r)))}
                  />
                ))}
              </div>
              {currentIncome.frequency === "semimonthly" ? (
                <div className="fety-talk-two">
                  <label className="fety-talk-field">
                    <span className="fety-label">First payday</span>
                    <DayOfMonthInput
                      aria-label="First payday"
                      value={currentIncome.semiMonthlyDays[0]}
                      onChange={(day) =>
                        setIncomes((rows) =>
                          rows.map((r, i) => (i === incomeIndex ? { ...r, semiMonthlyDays: [day, r.semiMonthlyDays[1]] } : r)),
                        )
                      }
                    />
                  </label>
                  <label className="fety-talk-field">
                    <span className="fety-label">Second payday</span>
                    <DayOfMonthInput
                      aria-label="Second payday"
                      value={currentIncome.semiMonthlyDays[1]}
                      onChange={(day) =>
                        setIncomes((rows) =>
                          rows.map((r, i) => (i === incomeIndex ? { ...r, semiMonthlyDays: [r.semiMonthlyDays[0], day] } : r)),
                        )
                      }
                    />
                  </label>
                </div>
              ) : currentIncome.frequency !== "weekly" && currentIncome.frequency !== "biweekly" ? (
                <label className="fety-talk-field">
                  <span className="fety-label">When do you usually receive it?</span>
                  <DayOfMonthInput
                    aria-label="Usual receive day"
                    value={currentIncome.dueDay}
                    onChange={(day) => setIncomes((rows) => rows.map((r, i) => (i === incomeIndex ? { ...r, dueDay: day } : r)))}
                  />
                </label>
              ) : (
                <p className="fety-talk-hint">Weekly pay is tracked from the start of each week.</p>
              )}
              {actions({
                skip: () => {
                  if (incomeIndex + 1 < incomes.length) setIncomeIndex((n) => n + 1);
                  else go("bills-pick");
                },
                nextLabel: incomeIndex + 1 < incomes.length ? "Next income" : "Continue",
                onNext: () => {
                  if (incomeIndex + 1 < incomes.length) setIncomeIndex((n) => n + 1);
                  else go("bills-pick");
                },
              })}
            </>
          )}

          {phase === "bills-pick" && (
            <>
              <Prompt
                title="What bills do you pay regularly?"
                body="Rent, utilities, insurance, and similar commitments. These become your Bills on the Budget page and appear on the calendar."
              />
              <div className="fety-talk-chips">
                {BILL_PRESETS.map((p) => (
                  <Chip key={p.name} icon={p.icon} label={p.name} active={bills.some((r) => r.name === p.name)} onClick={() => toggleBill(p)} />
                ))}
              </div>
              <div className="fety-talk-custom">
                <input
                  value={customBill}
                  onChange={(e) => setCustomBill(e.target.value)}
                  placeholder="Add your own bill"
                  onKeyDown={(e) => e.key === "Enter" && addCustomBill()}
                />
                <button type="button" className="fety-splash-btn-ghost" onClick={addCustomBill}>
                  Add
                </button>
              </div>
              {actions({
                skip: () => {
                  setBills([]);
                  go("categories-pick");
                },
                nextLabel: bills.length ? "Next" : "I'll add these later",
                onNext: () => {
                  if (bills.length === 0) go("categories-pick");
                  else {
                    setBillIndex(0);
                    go("bill-edit");
                  }
                },
              })}
            </>
          )}

          {phase === "bill-edit" && currentBill && (
            <>
              <Prompt title={`What's your ${currentBill.name.toLowerCase()} payment?`} body={`${billIndex + 1} of ${bills.length}. Skip if you're not sure.`} />
              <label className="fety-talk-field">
                <span className="fety-label">Amount</span>
                <CurrencyInput
                  value={currentBill.amount}
                  onChange={(v) => setBills((rows) => rows.map((r, i) => (i === billIndex ? { ...r, amount: v } : r)))}
                  placeholder="0.00"
                />
              </label>
              <p className="fety-label" style={{ marginBottom: 8 }}>
                How often?
              </p>
              <div className="fety-talk-chips">
                {BILL_FREQ.map((f) => (
                  <Chip
                    key={f.id}
                    label={f.label}
                    active={currentBill.frequency === f.id}
                    onClick={() => setBills((rows) => rows.map((r, i) => (i === billIndex ? { ...r, frequency: f.id } : r)))}
                  />
                ))}
              </div>
              {currentBill.frequency !== "weekly" && currentBill.frequency !== "biweekly" ? (
                <label className="fety-talk-field">
                  <span className="fety-label">Which day of the month?</span>
                  <DayOfMonthInput
                    aria-label="Due day of month"
                    value={currentBill.dueDay}
                    onChange={(day) => setBills((rows) => rows.map((r, i) => (i === billIndex ? { ...r, dueDay: day } : r)))}
                  />
                </label>
              ) : null}
              {actions({
                skip: () => {
                  if (billIndex + 1 < bills.length) setBillIndex((n) => n + 1);
                  else go("categories-pick");
                },
                nextLabel: billIndex + 1 < bills.length ? "Next bill" : "Continue",
                onNext: () => {
                  if (billIndex + 1 < bills.length) setBillIndex((n) => n + 1);
                  else go("categories-pick");
                },
              })}
            </>
          )}

          {phase === "categories-pick" && (
            <>
              <Prompt
                title="What kinds of things do you want in your budget?"
                body="These become your Budget categories — the envelopes you plan spending with. You can set monthly amounts next."
              />
              <div className="fety-talk-chips">
                {CATEGORY_PRESETS.map((p) => (
                  <Chip
                    key={p.name}
                    icon={p.icon}
                    label={p.name}
                    active={categories.some((r) => r.name === p.name)}
                    onClick={() => toggleCategory(p)}
                  />
                ))}
              </div>
              <div className="fety-talk-custom">
                <input
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Add your own category"
                  onKeyDown={(e) => e.key === "Enter" && addCustomCategory()}
                />
                <button type="button" className="fety-splash-btn-ghost" onClick={addCustomCategory}>
                  Add
                </button>
              </div>
              {actions({
                skip: () => {
                  setCategories([]);
                  go("recurring-pick");
                },
                nextLabel: categories.length ? "Next" : "I'll add categories later",
                onNext: () => {
                  if (categories.length === 0) go("recurring-pick");
                  else {
                    setCategoryIndex(0);
                    go("category-edit");
                  }
                },
              })}
            </>
          )}

          {phase === "category-edit" && currentCategory && (
            <>
              <Prompt
                title={`How much do you want to budget for ${currentCategory.name.toLowerCase()} each month?`}
                body={`${categoryIndex + 1} of ${categories.length}. An estimate is fine — you can change it anytime on Budget.`}
              />
              <label className="fety-talk-field">
                <span className="fety-label">Monthly budget</span>
                <CurrencyInput
                  value={currentCategory.monthlyBudget}
                  onChange={(v) =>
                    setCategories((rows) => rows.map((r, i) => (i === categoryIndex ? { ...r, monthlyBudget: v } : r)))
                  }
                  placeholder="0.00"
                />
              </label>
              {actions({
                skip: () => {
                  if (categoryIndex + 1 < categories.length) setCategoryIndex((n) => n + 1);
                  else go("recurring-pick");
                },
                nextLabel: categoryIndex + 1 < categories.length ? "Next category" : "Continue",
                onNext: () => {
                  if (categoryIndex + 1 < categories.length) setCategoryIndex((n) => n + 1);
                  else go("recurring-pick");
                },
              })}
            </>
          )}

          {phase === "recurring-pick" && (
            <>
              <Prompt
                title="Any recurring expenses or transfers to account for?"
                body="Streaming, gym, savings transfers, and similar — these become Recurring items on Budget and show on the calendar. Skip habits you already covered as bills."
              />
              <div className="fety-talk-chips">
                {RECURRING_PRESETS.map((p) => (
                  <Chip
                    key={p.name}
                    icon={p.icon}
                    label={p.name}
                    active={recurring.some((r) => r.name === p.name)}
                    onClick={() => toggleRecurring(p)}
                  />
                ))}
              </div>
              <div className="fety-talk-custom">
                <input
                  value={customRecurring}
                  onChange={(e) => setCustomRecurring(e.target.value)}
                  placeholder="Add your own recurring item"
                  onKeyDown={(e) => e.key === "Enter" && addCustomRecurring()}
                />
                <button type="button" className="fety-splash-btn-ghost" onClick={addCustomRecurring}>
                  Add
                </button>
              </div>
              {actions({
                skip: () => {
                  setRecurring([]);
                  go("goals");
                },
                nextLabel: recurring.length ? "Next" : "No recurring items for now",
                onNext: () => {
                  if (recurring.length === 0) go("goals");
                  else {
                    setRecurringIndex(0);
                    go("recurring-edit");
                  }
                },
              })}
            </>
          )}

          {phase === "recurring-edit" && currentRecurring && (
            <>
              <Prompt
                title={`About how much is ${currentRecurring.name.toLowerCase()}?`}
                body={`${recurringIndex + 1} of ${recurring.length}. ${
                  currentRecurring.transactionType === "transfer" ? "This will be saved as a transfer." : "This will be saved as a recurring expense."
                }`}
              />
              <label className="fety-talk-field">
                <span className="fety-label">Amount</span>
                <CurrencyInput
                  value={currentRecurring.amount}
                  onChange={(v) =>
                    setRecurring((rows) => rows.map((r, i) => (i === recurringIndex ? { ...r, amount: v } : r)))
                  }
                  placeholder="0.00"
                />
              </label>
              <p className="fety-label" style={{ marginBottom: 8 }}>
                How often?
              </p>
              <div className="fety-talk-chips">
                {RECURRING_FREQ.map((f) => (
                  <Chip
                    key={f.id}
                    label={f.label}
                    active={currentRecurring.frequency === f.id}
                    onClick={() =>
                      setRecurring((rows) => rows.map((r, i) => (i === recurringIndex ? { ...r, frequency: f.id } : r)))
                    }
                  />
                ))}
              </div>
              {actions({
                skip: () => {
                  if (recurringIndex + 1 < recurring.length) setRecurringIndex((n) => n + 1);
                  else go("goals");
                },
                nextLabel: recurringIndex + 1 < recurring.length ? "Next item" : "Continue",
                onNext: () => {
                  if (recurringIndex + 1 < recurring.length) setRecurringIndex((n) => n + 1);
                  else go("goals");
                },
              })}
            </>
          )}

          {phase === "goals" && (
            <>
              <Prompt
                title="Is there something you'd like your money to help you accomplish?"
                body="A goal gives the rest of your Budget a destination. You can skip this."
              />
              <div className="fety-talk-chips">
                {GOAL_PRESETS.map((p) => (
                  <Chip
                    key={p.name}
                    icon={p.icon}
                    label={p.name}
                    active={goalName === p.name}
                    onClick={() => {
                      setGoalName(p.name);
                      setGoalIcon(p.icon);
                    }}
                  />
                ))}
                <Chip label="Nothing right now" active={goalName === ""} onClick={() => setGoalName("")} />
              </div>
              <div className="fety-talk-custom">
                <input
                  value={customGoal}
                  onChange={(e) => setCustomGoal(e.target.value)}
                  placeholder="Add your own goal"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customGoal.trim()) {
                      setGoalName(customGoal.trim());
                      setGoalIcon("🎯");
                      setCustomGoal("");
                    }
                  }}
                />
                <button
                  type="button"
                  className="fety-splash-btn-ghost"
                  onClick={() => {
                    if (!customGoal.trim()) return;
                    setGoalName(customGoal.trim());
                    setGoalIcon("🎯");
                    setCustomGoal("");
                  }}
                >
                  Add
                </button>
              </div>
              {actions({
                skip: () => {
                  setGoalName("");
                  go("starting");
                },
                onNext: () => {
                  if (goalName) go("goal-edit");
                  else go("starting");
                },
              })}
            </>
          )}

          {phase === "goal-edit" && (
            <>
              <Prompt title={`How much would you like to save for ${goalName.toLowerCase()}?`} />
              <label className="fety-talk-field">
                <span className="fety-label">Target</span>
                <CurrencyInput value={goalTarget} onChange={setGoalTarget} placeholder={amountToEditString(5000)} />
              </label>
              {actions({ skip: () => go("starting"), onNext: () => go("starting") })}
            </>
          )}

          {phase === "starting" && (
            <>
              <Prompt
                title="About how much money do you have available right now?"
                body="This is your starting point. Fety records activity from this date forward — and your Budget is already filled with what you just told me."
              />
              <label className="fety-talk-field">
                <span className="fety-label">Available now</span>
                <CurrencyInput value={startingBalance} onChange={setStartingBalance} placeholder="0.00" />
              </label>
              <label className="fety-talk-field">
                <span className="fety-label">What date does that balance represent?</span>
                <input type="date" value={balanceAsOfISO} onChange={(e) => setBalanceAsOfISO(e.target.value)} />
              </label>
              {actions({
                skip: () => finish(),
                nextLabel: "See my Budget",
                onNext: () => finish(),
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
