import { useMemo, useState } from "react";
import { FetyLogo } from "../FetyLogo";
import CurrencyInput, { amountToEditString } from "../components/CurrencyInput";
import { todayISO } from "../lib/fetyCalculations";
import { newId } from "../lib/fetyStorage";
import { everydayToStoredSchedule, type EverydayFrequency } from "../lib/scheduleAmounts";
import type {
  Bill,
  BillFrequency,
  BudgetCategory,
  Goal,
  IncomeFrequency,
  IncomeStream,
  RecurringTransaction,
  UserProfile,
} from "../types/fety";

type Phase =
  | "welcome"
  | "about"
  | "income-pick"
  | "income-edit"
  | "obligations-pick"
  | "obligation-edit"
  | "everyday-pick"
  | "everyday-edit"
  | "goals"
  | "goal-edit"
  | "starting";

type IncomeDraft = {
  key: string;
  name: string;
  icon: string;
  amount: string;
  frequency: IncomeFrequency;
  dueDay: number;
  semiMonthlyDays: [number, number];
};

type ObligationDraft = {
  key: string;
  name: string;
  icon: string;
  category: string;
  amount: string;
  frequency: BillFrequency;
  dueDay: number;
};

type EverydayDraft = {
  key: string;
  name: string;
  icon: string;
  category: string;
  amount: string;
  frequency: EverydayFrequency;
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

const OBLIGATION_PRESETS = [
  { name: "Rent", icon: "🏠", category: "Housing" },
  { name: "Mortgage", icon: "🏡", category: "Housing" },
  { name: "Utilities", icon: "⚡", category: "Utilities" },
  { name: "Insurance", icon: "🛡️", category: "Insurance" },
  { name: "Phone", icon: "📱", category: "Subscriptions" },
  { name: "Internet", icon: "🌐", category: "Subscriptions" },
  { name: "Car payment", icon: "🚗", category: "Transportation" },
  { name: "Debt payment", icon: "💳", category: "Debt" },
  { name: "Subscription", icon: "📺", category: "Subscriptions" },
  { name: "Taxes", icon: "🧾", category: "Taxes" },
  { name: "Tuition", icon: "🎓", category: "Education" },
] as const;

const EVERYDAY_PRESETS = [
  { name: "Coffee", icon: "☕", category: "Coffee" },
  { name: "Eating out", icon: "🍽️", category: "Dining" },
  { name: "Snacks", icon: "🍩", category: "Dining" },
  { name: "Gas", icon: "⛽", category: "Transportation" },
  { name: "Groceries", icon: "🛒", category: "Groceries" },
  { name: "Shopping", icon: "🛍️", category: "Shopping" },
  { name: "Entertainment", icon: "🎬", category: "Entertainment" },
  { name: "Hobbies", icon: "🎨", category: "Hobbies" },
  { name: "Personal care", icon: "💆", category: "Personal" },
  { name: "Pet expenses", icon: "🐾", category: "Pets" },
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

const EVERYDAY_FREQ: { id: EverydayFrequency; label: string }[] = [
  { id: "weekday", label: "Every weekday" },
  { id: "weekly", label: "Every week" },
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
  if (!trimmed) return categories;
  const existing = categories.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) {
    return categories.map((c) =>
      c.id === existing.id ? { ...c, monthlyBudget: c.monthlyBudget + monthlyBudget, icon: c.icon || icon } : c,
    );
  }
  return [...categories, { id: newId("cat"), name: trimmed, icon, monthlyBudget }];
}

export function OnboardingView({
  onUpdateProfile,
  onReplaceCategories,
  onReplaceBills,
  onReplaceIncomeStreams,
  onReplaceRecurringTransactions,
  onReplaceGoals,
  onComplete,
}: {
  onUpdateProfile: (u: Partial<UserProfile>) => void;
  onReplaceCategories: (categories: BudgetCategory[]) => void;
  onReplaceBills: (bills: Bill[]) => void;
  onReplaceIncomeStreams: (streams: IncomeStream[]) => void;
  onReplaceRecurringTransactions: (items: RecurringTransaction[]) => void;
  onReplaceGoals: (goals: Goal[]) => void;
  onComplete: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("welcome");
  const [displayName, setDisplayName] = useState("");
  const [incomes, setIncomes] = useState<IncomeDraft[]>([]);
  const [incomeIndex, setIncomeIndex] = useState(0);
  const [customIncome, setCustomIncome] = useState("");
  const [obligations, setObligations] = useState<ObligationDraft[]>([]);
  const [obligationIndex, setObligationIndex] = useState(0);
  const [customObligation, setCustomObligation] = useState("");
  const [everyday, setEveryday] = useState<EverydayDraft[]>([]);
  const [everydayIndex, setEverydayIndex] = useState(0);
  const [customEveryday, setCustomEveryday] = useState("");
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
      "obligations-pick",
      "obligation-edit",
      "everyday-pick",
      "everyday-edit",
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
    if (phase === "obligation-edit" && obligationIndex > 0) {
      setObligationIndex((n) => n - 1);
      return;
    }
    if (phase === "everyday-edit" && everydayIndex > 0) {
      setEverydayIndex((n) => n - 1);
      return;
    }
    const skip: Partial<Record<Phase, Phase>> = {
      "income-edit": "income-pick",
      "obligation-edit": "obligations-pick",
      "everyday-edit": "everyday-pick",
      "goal-edit": "goals",
      "obligations-pick": incomes.length ? "income-edit" : "income-pick",
      "everyday-pick": obligations.length ? "obligation-edit" : "obligations-pick",
      goals: everyday.length ? "everyday-edit" : "everyday-pick",
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

  const toggleObligation = (preset: (typeof OBLIGATION_PRESETS)[number]) => {
    setObligations((rows) => {
      const exists = rows.some((r) => r.name === preset.name);
      if (exists) return rows.filter((r) => r.name !== preset.name);
      return [
        ...rows,
        {
          key: newId("ob"),
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

  const addCustomObligation = () => {
    const name = customObligation.trim();
    if (!name) return;
    setObligations((rows) => [
      ...rows,
      {
        key: newId("ob"),
        name,
        icon: "✨",
        category: name,
        amount: "",
        frequency: "monthly",
        dueDay: 1,
      },
    ]);
    setCustomObligation("");
  };

  const toggleEveryday = (preset: (typeof EVERYDAY_PRESETS)[number]) => {
    setEveryday((rows) => {
      const exists = rows.some((r) => r.name === preset.name);
      if (exists) return rows.filter((r) => r.name !== preset.name);
      return [
        ...rows,
        {
          key: newId("ev"),
          name: preset.name,
          icon: preset.icon,
          category: preset.category,
          amount: "",
          frequency: preset.name === "Coffee" ? "weekday" : "weekly",
        },
      ];
    });
  };

  const addCustomEveryday = () => {
    const name = customEveryday.trim();
    if (!name) return;
    setEveryday((rows) => [
      ...rows,
      {
        key: newId("ev"),
        name,
        icon: "✨",
        category: name,
        amount: "",
        frequency: "weekly",
      },
    ]);
    setCustomEveryday("");
  };

  const finish = () => {
    let categories: BudgetCategory[] = [{ id: newId("cat"), name: "Income", icon: "💵", monthlyBudget: 0 }];

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
        semiMonthlyDays: row.frequency === "semimonthly" ? row.semiMonthlyDays : undefined,
      }));

    const bills: Bill[] = obligations
      .filter((row) => parseFloat(row.amount) > 0)
      .map((row) => {
        categories = upsertCategory(categories, row.category, row.icon, 0);
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

    const recurring: RecurringTransaction[] = everyday
      .filter((row) => parseFloat(row.amount) > 0)
      .map((row) => {
        const raw = parseFloat(row.amount) || 0;
        const stored = everydayToStoredSchedule(raw, row.frequency);
        const monthly =
          row.frequency === "weekday"
            ? (raw * 5 * 52) / 12
            : row.frequency === "weekly"
              ? (raw * 52) / 12
              : raw;
        categories = upsertCategory(categories, row.category, row.icon, monthly);
        return {
          id: newId("recur"),
          name: row.name,
          amount: stored.amount,
          dueDay: 1,
          frequency: stored.frequency,
          category: row.category,
          icon: row.icon,
          transactionType: "expense" as const,
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

    onUpdateProfile({
      displayName: displayName.trim() || "Friend",
      email: "",
      currency: "USD",
      startingBalance: parseFloat(startingBalance) || 0,
      balanceAsOfISO: balanceAsOfISO || todayISO(),
    });
    onReplaceCategories(categories.filter((c) => c.name !== "Income" || streams.length > 0));
    onReplaceIncomeStreams(streams);
    onReplaceBills(bills);
    onReplaceRecurringTransactions(recurring);
    onReplaceGoals(goals);
    onComplete();
  };

  const currentIncome = incomes[incomeIndex];
  const currentObligation = obligations[obligationIndex];
  const currentEveryday = everyday[everydayIndex];

  const actions = (opts: { back?: boolean; skip?: () => void; nextLabel?: string; onNext: () => void; nextDisabled?: boolean }) => (
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
      <button type="button" className="fety-splash-btn-primary fety-splash-btn-lg" onClick={opts.onNext} disabled={opts.nextDisabled}>
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
          {phase === "welcome" && (
            <>
              <Prompt
                title="Let's get to know your money."
                body="I'll ask you a few questions about your income, bills, everyday spending, and goals. Then I'll show you what I find."
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
              <Prompt title="How does money usually come into your household?" body="Pick everything that applies. Don't see yours? Add your own." />
              <div className="fety-talk-chips">
                {INCOME_PRESETS.map((p) => (
                  <Chip key={p.name} icon={p.icon} label={p.name} active={incomes.some((r) => r.name === p.name)} onClick={() => toggleIncome(p)} />
                ))}
              </div>
              <div className="fety-talk-custom">
                <input value={customIncome} onChange={(e) => setCustomIncome(e.target.value)} placeholder="Add your own income type" onKeyDown={(e) => e.key === "Enter" && addCustomIncome()} />
                <button type="button" className="fety-splash-btn-ghost" onClick={addCustomIncome}>
                  Add
                </button>
              </div>
              {actions({
                skip: () => { setIncomes([]); go("obligations-pick"); },
                nextLabel: incomes.length ? "Next" : "I don't get regular income",
                onNext: () => {
                  if (incomes.length === 0) go("obligations-pick");
                  else { setIncomeIndex(0); go("income-edit"); }
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
                <CurrencyInput value={currentIncome.amount} onChange={(v) => setIncomes((rows) => rows.map((r, i) => (i === incomeIndex ? { ...r, amount: v } : r)))} placeholder="0.00" />
              </label>
              <p className="fety-label" style={{ marginBottom: 8 }}>How often does it come in?</p>
              <div className="fety-talk-chips">
                {INCOME_FREQ.map((f) => (
                  <Chip key={f.id} label={f.label} active={currentIncome.frequency === f.id} onClick={() => setIncomes((rows) => rows.map((r, i) => (i === incomeIndex ? { ...r, frequency: f.id } : r)))} />
                ))}
              </div>
              {currentIncome.frequency === "semimonthly" ? (
                <div className="fety-talk-two">
                  <label className="fety-talk-field">
                    <span className="fety-label">First payday</span>
                    <input type="number" min={1} max={31} value={currentIncome.semiMonthlyDays[0]} onChange={(e) => setIncomes((rows) => rows.map((r, i) => (i === incomeIndex ? { ...r, semiMonthlyDays: [Number(e.target.value) || 1, r.semiMonthlyDays[1]] } : r)))} />
                  </label>
                  <label className="fety-talk-field">
                    <span className="fety-label">Second payday</span>
                    <input type="number" min={1} max={31} value={currentIncome.semiMonthlyDays[1]} onChange={(e) => setIncomes((rows) => rows.map((r, i) => (i === incomeIndex ? { ...r, semiMonthlyDays: [r.semiMonthlyDays[0], Number(e.target.value) || 15] } : r)))} />
                  </label>
                </div>
              ) : currentIncome.frequency !== "weekly" && currentIncome.frequency !== "biweekly" ? (
                <label className="fety-talk-field">
                  <span className="fety-label">When do you usually receive it?</span>
                  <input type="number" min={1} max={31} value={currentIncome.dueDay} onChange={(e) => setIncomes((rows) => rows.map((r, i) => (i === incomeIndex ? { ...r, dueDay: Number(e.target.value) || 1 } : r)))} />
                </label>
              ) : (
                <p className="fety-talk-hint">Weekly pay is tracked from the start of each week.</p>
              )}
              {actions({
                skip: () => {
                  if (incomeIndex + 1 < incomes.length) setIncomeIndex((n) => n + 1);
                  else go("obligations-pick");
                },
                nextLabel: incomeIndex + 1 < incomes.length ? "Next income" : "Continue",
                onNext: () => {
                  if (incomeIndex + 1 < incomes.length) setIncomeIndex((n) => n + 1);
                  else go("obligations-pick");
                },
              })}
            </>
          )}

          {phase === "obligations-pick" && (
            <>
              <Prompt title="What do you have to pay regularly?" body="Housing, utilities, insurance, subscriptions — anything you're committed to. Add your own if it isn't listed." />
              <div className="fety-talk-chips">
                {OBLIGATION_PRESETS.map((p) => (
                  <Chip key={p.name} icon={p.icon} label={p.name} active={obligations.some((r) => r.name === p.name)} onClick={() => toggleObligation(p)} />
                ))}
              </div>
              <div className="fety-talk-custom">
                <input value={customObligation} onChange={(e) => setCustomObligation(e.target.value)} placeholder="Add your own" onKeyDown={(e) => e.key === "Enter" && addCustomObligation()} />
                <button type="button" className="fety-splash-btn-ghost" onClick={addCustomObligation}>Add</button>
              </div>
              {actions({
                skip: () => { setObligations([]); go("everyday-pick"); },
                nextLabel: obligations.length ? "Next" : "I'll add these later",
                onNext: () => {
                  if (obligations.length === 0) go("everyday-pick");
                  else { setObligationIndex(0); go("obligation-edit"); }
                },
              })}
            </>
          )}

          {phase === "obligation-edit" && currentObligation && (
            <>
              <Prompt title={`What's your ${currentObligation.name.toLowerCase()} payment?`} body={`${obligationIndex + 1} of ${obligations.length}. Skip if you're not sure.`} />
              <label className="fety-talk-field">
                <span className="fety-label">Amount</span>
                <CurrencyInput value={currentObligation.amount} onChange={(v) => setObligations((rows) => rows.map((r, i) => (i === obligationIndex ? { ...r, amount: v } : r)))} placeholder="0.00" />
              </label>
              <p className="fety-label" style={{ marginBottom: 8 }}>How often?</p>
              <div className="fety-talk-chips">
                {BILL_FREQ.map((f) => (
                  <Chip key={f.id} label={f.label} active={currentObligation.frequency === f.id} onClick={() => setObligations((rows) => rows.map((r, i) => (i === obligationIndex ? { ...r, frequency: f.id } : r)))} />
                ))}
              </div>
              {currentObligation.frequency !== "weekly" && currentObligation.frequency !== "biweekly" ? (
                <label className="fety-talk-field">
                  <span className="fety-label">Which day of the month?</span>
                  <input type="number" min={1} max={31} value={currentObligation.dueDay} onChange={(e) => setObligations((rows) => rows.map((r, i) => (i === obligationIndex ? { ...r, dueDay: Number(e.target.value) || 1 } : r)))} />
                </label>
              ) : null}
              {actions({
                skip: () => {
                  if (obligationIndex + 1 < obligations.length) setObligationIndex((n) => n + 1);
                  else go("everyday-pick");
                },
                nextLabel: obligationIndex + 1 < obligations.length ? "Next payment" : "Continue",
                onNext: () => {
                  if (obligationIndex + 1 < obligations.length) setObligationIndex((n) => n + 1);
                  else go("everyday-pick");
                },
              })}
            </>
          )}

          {phase === "everyday-pick" && (
            <>
              <Prompt
                title="Now let's think about everyday spending."
                body="Things you buy regularly that aren't bills — coffee, eating out, gas, shopping, hobbies. Don't see yours? Add your own."
              />
              <div className="fety-talk-chips">
                {EVERYDAY_PRESETS.map((p) => (
                  <Chip key={p.name} icon={p.icon} label={p.name} active={everyday.some((r) => r.name === p.name)} onClick={() => toggleEveryday(p)} />
                ))}
              </div>
              <div className="fety-talk-custom">
                <input value={customEveryday} onChange={(e) => setCustomEveryday(e.target.value)} placeholder="Add your own" onKeyDown={(e) => e.key === "Enter" && addCustomEveryday()} />
                <button type="button" className="fety-splash-btn-ghost" onClick={addCustomEveryday}>Add</button>
              </div>
              {actions({
                skip: () => { setEveryday([]); go("goals"); },
                nextLabel: everyday.length ? "Next" : "I'll add this later",
                onNext: () => {
                  if (everyday.length === 0) go("goals");
                  else { setEverydayIndex(0); go("everyday-edit"); }
                },
              })}
            </>
          )}

          {phase === "everyday-edit" && currentEveryday && (
            <>
              <Prompt title={`About how much do you usually spend on ${currentEveryday.name.toLowerCase()}?`} body={`${everydayIndex + 1} of ${everyday.length}. An estimate is plenty.`} />
              <label className="fety-talk-field">
                <span className="fety-label">Amount</span>
                <CurrencyInput value={currentEveryday.amount} onChange={(v) => setEveryday((rows) => rows.map((r, i) => (i === everydayIndex ? { ...r, amount: v } : r)))} placeholder="0.00" />
              </label>
              <p className="fety-label" style={{ marginBottom: 8 }}>How often?</p>
              <div className="fety-talk-chips">
                {EVERYDAY_FREQ.map((f) => (
                  <Chip key={f.id} label={f.label} active={currentEveryday.frequency === f.id} onClick={() => setEveryday((rows) => rows.map((r, i) => (i === everydayIndex ? { ...r, frequency: f.id } : r)))} />
                ))}
              </div>
              {actions({
                skip: () => {
                  if (everydayIndex + 1 < everyday.length) setEverydayIndex((n) => n + 1);
                  else go("goals");
                },
                nextLabel: everydayIndex + 1 < everyday.length ? "Next habit" : "Continue",
                onNext: () => {
                  if (everydayIndex + 1 < everyday.length) setEverydayIndex((n) => n + 1);
                  else go("goals");
                },
              })}
            </>
          )}

          {phase === "goals" && (
            <>
              <Prompt title="Is there something you'd like your money to help you accomplish?" body="A goal gives the rest of your picture a destination. You can skip this." />
              <div className="fety-talk-chips">
                {GOAL_PRESETS.map((p) => (
                  <Chip key={p.name} icon={p.icon} label={p.name} active={goalName === p.name} onClick={() => { setGoalName(p.name); setGoalIcon(p.icon); }} />
                ))}
                <Chip label="Nothing right now" active={goalName === ""} onClick={() => setGoalName("")} />
              </div>
              <div className="fety-talk-custom">
                <input value={customGoal} onChange={(e) => setCustomGoal(e.target.value)} placeholder="Add your own goal" onKeyDown={(e) => {
                  if (e.key === "Enter" && customGoal.trim()) {
                    setGoalName(customGoal.trim());
                    setGoalIcon("🎯");
                    setCustomGoal("");
                  }
                }} />
                <button type="button" className="fety-splash-btn-ghost" onClick={() => {
                  if (!customGoal.trim()) return;
                  setGoalName(customGoal.trim());
                  setGoalIcon("🎯");
                  setCustomGoal("");
                }}>Add</button>
              </div>
              {actions({
                skip: () => { setGoalName(""); go("starting"); },
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
                body="This is your starting point — the date matters so Fety can look backward and forward from the same place."
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
                nextLabel: "See what I found",
                onNext: () => finish(),
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
