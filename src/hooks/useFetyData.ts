import { useCallback, useEffect, useMemo, useState } from "react";
import { computeSummary } from "../lib/fetyCalculations";
import { loadStore, newId, saveStore, resetStore as resetStored, resetToEmptyStore } from "../lib/fetyStorage";
import type {
  Account,
  Bill,
  BudgetCategory,
  ChatMessage,
  FetyStore,
  Goal,
  Transaction,
  TransactionType,
  UserProfile,
} from "../types/fety";

export function useFetyData() {
  const [store, setStore] = useState<FetyStore>(() => loadStore());

  useEffect(() => {
    saveStore(store);
  }, [store]);

  const summary = useMemo(() => computeSummary(store), [store]);

  const patch = useCallback((fn: (prev: FetyStore) => FetyStore) => {
    setStore((prev) => fn(prev));
  }, []);

  const addTransaction = useCallback(
    (input: {
      desc: string;
      amount: number;
      type: TransactionType;
      category: string;
      dateISO?: string;
      icon?: string;
    }) => {
      const signed =
        input.type === "income"
          ? Math.abs(input.amount)
          : input.type === "transfer"
            ? -Math.abs(input.amount)
            : -Math.abs(input.amount);
      const tx: Transaction = {
        id: newId("tx"),
        dateISO: input.dateISO ?? new Date().toISOString().slice(0, 10),
        desc: input.desc,
        category: input.category,
        amount: signed,
        type: input.type,
        icon: input.icon ?? "💬",
      };
      patch((prev) => ({ ...prev, transactions: [tx, ...prev.transactions] }));
      return tx;
    },
    [patch],
  );

  const deleteTransaction = useCallback(
    (id: string) => {
      patch((prev) => ({
        ...prev,
        transactions: prev.transactions.filter((t) => t.id !== id),
      }));
    },
    [patch],
  );

  const updateTransaction = useCallback(
    (id: string, updates: Partial<Pick<Transaction, "desc" | "amount" | "type" | "category" | "dateISO" | "icon">>) => {
      patch((prev) => ({
        ...prev,
        transactions: prev.transactions.map((t) => {
          if (t.id !== id) return t;
          const next = { ...t, ...updates };
          if (updates.amount !== undefined || updates.type !== undefined) {
            const type = updates.type ?? t.type;
            const raw = updates.amount !== undefined ? updates.amount : Math.abs(t.amount);
            next.amount =
              type === "income"
                ? Math.abs(raw)
                : type === "transfer"
                  ? -Math.abs(raw)
                  : -Math.abs(raw);
            next.type = type;
          }
          return next;
        }),
      }));
    },
    [patch],
  );

  const updateBill = useCallback(
    (id: string, updates: Partial<Pick<Bill, "name" | "amount" | "dueDay" | "category" | "icon">>) => {
      patch((prev) => ({
        ...prev,
        bills: prev.bills.map((b) => (b.id === id ? { ...b, ...updates } : b)),
      }));
    },
    [patch],
  );

  const updateCategoryBudget = useCallback(
    (id: string, monthlyBudget: number) => {
      patch((prev) => ({
        ...prev,
        categories: prev.categories.map((c) =>
          c.id === id ? { ...c, monthlyBudget } : c,
        ),
      }));
    },
    [patch],
  );

  const addCategory = useCallback(
    (input: { name: string; icon: string; monthlyBudget: number }) => {
      const cat: BudgetCategory = {
        id: newId("cat"),
        name: input.name,
        icon: input.icon || "📁",
        monthlyBudget: input.monthlyBudget,
      };
      patch((prev) => ({ ...prev, categories: [...prev.categories, cat] }));
    },
    [patch],
  );

  const addBill = useCallback(
    (input: Omit<Bill, "id">) => {
      patch((prev) => ({
        ...prev,
        bills: [...prev.bills, { ...input, id: newId("bill") }],
      }));
    },
    [patch],
  );

  const deleteBill = useCallback(
    (id: string) => {
      patch((prev) => ({ ...prev, bills: prev.bills.filter((b) => b.id !== id) }));
    },
    [patch],
  );

  const addGoal = useCallback(
    (input: Omit<Goal, "id">) => {
      patch((prev) => ({
        ...prev,
        goals: [...prev.goals, { ...input, id: newId("goal") }],
      }));
    },
    [patch],
  );

  const updateGoal = useCallback(
    (id: string, updates: Partial<Pick<Goal, "saved" | "target" | "monthlyContribution" | "targetDate" | "name" | "icon">>) => {
      patch((prev) => ({
        ...prev,
        goals: prev.goals.map((g) => (g.id === id ? { ...g, ...updates } : g)),
      }));
    },
    [patch],
  );

  const deleteGoal = useCallback(
    (id: string) => {
      patch((prev) => ({ ...prev, goals: prev.goals.filter((g) => g.id !== id) }));
    },
    [patch],
  );

  const updateProfile = useCallback(
    (updates: Partial<UserProfile>) => {
      patch((prev) => ({ ...prev, profile: { ...prev.profile, ...updates } }));
    },
    [patch],
  );

  const updateAccount = useCallback(
    (id: string, updates: Partial<Pick<Account, "name" | "type" | "balance" | "icon">>) => {
      patch((prev) => ({
        ...prev,
        accounts: prev.accounts.map((a) => (a.id === id ? { ...a, ...updates } : a)),
      }));
    },
    [patch],
  );

  const addMessage = useCallback((msg: ChatMessage) => {
    patch((prev) => ({ ...prev, messages: [...prev.messages, msg] }));
  }, [patch]);

  const setPinnedWidgets = useCallback(
    (pinnedWidgets: string[] | ((prev: string[]) => string[])) => {
      patch((prev) => ({
        ...prev,
        pinnedWidgets:
          typeof pinnedWidgets === "function"
            ? pinnedWidgets(prev.pinnedWidgets)
            : pinnedWidgets,
      }));
    },
    [patch],
  );

  const resetAll = useCallback(() => {
    setStore(resetStored());
  }, []);

  const startFreshSetup = useCallback(() => {
    setStore(resetToEmptyStore());
  }, []);

  const completeOnboarding = useCallback(() => {
    patch((prev) => ({ ...prev, onboardingCompleted: true }));
  }, [patch]);

  const replaceCategories = useCallback((categories: BudgetCategory[]) => {
    patch((prev) => ({ ...prev, categories }));
  }, [patch]);

  const replaceBills = useCallback((bills: Bill[]) => {
    patch((prev) => ({ ...prev, bills }));
  }, [patch]);

  const importTransactionsBulk = useCallback(
    (inputs: Omit<Transaction, "id">[]) => {
      patch((prev) => ({
        ...prev,
        transactions: [
          ...inputs.map((t) => ({ ...t, id: newId("tx") })),
          ...prev.transactions,
        ],
      }));
    },
    [patch],
  );

  return {
    store,
    summary,
    addTransaction,
    deleteTransaction,
    updateTransaction,
    updateBill,
    updateCategoryBudget,
    addCategory,
    addBill,
    deleteBill,
    addGoal,
    updateGoal,
    deleteGoal,
    updateProfile,
    updateAccount,
    addMessage,
    setPinnedWidgets,
    resetAll,
    startFreshSetup,
    completeOnboarding,
    replaceCategories,
    replaceBills,
    importTransactionsBulk,
  };
}
