import { useCallback, useEffect, useMemo, useState } from "react";
import { computeSummary, todayISO } from "../lib/fetyCalculations";
import {
  applyBillScheduleToStore,
  billSignature,
  incomeStreamSignature,
  parseScheduledTransactionId,
  recurringTransactionSignature,
  skipKeyForOccurrence,
  normalizeSkippedOccurrences,
} from "../lib/billScheduling";
import { loadStore, newId, saveStore, resetStore as resetStored, resetToEmptyStore } from "../lib/fetyStorage";
import { toggleWidgetPositionLock } from "../lib/widgetLayout";
import {
  flowForTransactionType,
  iconForTransactionType,
  signAmountForFlow,
  typeIconsFromTransactionTypes,
} from "../lib/transactionTypes";
import type {
  Account,
  Bill,
  BudgetCategory,
  ChatMessage,
  FetyStore,
  FetyTransactionType,
  Goal,
  IncomeStream,
  RecurringTransaction,
  Transaction,
  TransactionFlow,
  TransactionType,
  UserProfile,
} from "../types/fety";

function normalizeSkipped(prev: FetyStore): string[] {
  return [...normalizeSkippedOccurrences(prev)];
}

export function useFetyData() {
  const [store, setStore] = useState<FetyStore>(() => loadStore());

  useEffect(() => {
    saveStore(store);
  }, [store]);

  const summary = useMemo(() => computeSummary(store), [store]);

  const patch = useCallback((fn: (prev: FetyStore) => FetyStore) => {
    setStore((prev) => applyBillScheduleToStore(fn(prev)));
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
      let created: Transaction | null = null;
      patch((prev) => {
        const flow = flowForTransactionType(prev, input.type);
        const icon = input.icon ?? iconForTransactionType(prev, input.type);
        const tx: Transaction = {
          id: newId("tx"),
          dateISO: input.dateISO ?? new Date().toISOString().slice(0, 10),
          desc: input.desc,
          category: input.category,
          amount: signAmountForFlow(flow, input.amount),
          type: input.type,
          icon,
        };
        created = tx;
        return { ...prev, transactions: [tx, ...prev.transactions] };
      });
      return created!;
    },
    [patch],
  );

  const deleteTransaction = useCallback(
    (id: string) => {
      patch((prev) => {
        const parsed = parseScheduledTransactionId(id);
        const skipped = normalizeSkipped(prev);
        if (parsed) {
          const key = skipKeyForOccurrence(parsed.kind, parsed.sourceId, parsed.dateISO);
          if (!skipped.includes(key)) skipped.push(key);
        }
        return {
          ...prev,
          skippedScheduledOccurrences: skipped,
          transactions: prev.transactions.filter((t) => t.id !== id),
        };
      });
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
            const flow = flowForTransactionType(prev, type);
            next.amount = signAmountForFlow(flow, raw);
            next.type = type;
          }
          return next;
        }),
      }));
    },
    [patch],
  );

  const updateBill = useCallback(
    (id: string, updates: Partial<Pick<Bill, "name" | "amount" | "dueDay" | "frequency" | "category" | "icon">>) => {
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

  const deleteCategory = useCallback(
    (id: string) => {
      patch((prev) => ({ ...prev, categories: prev.categories.filter((c) => c.id !== id) }));
    },
    [patch],
  );

  const addBill = useCallback(
    (input: Omit<Bill, "id">) => {
      patch((prev) => {
        const candidate: Bill = {
          ...input,
          id: newId("bill"),
          frequency: input.frequency ?? "monthly",
          amount: Number(input.amount),
          dueDay: Number(input.dueDay),
        };
        const sig = billSignature(candidate);
        if (prev.bills.some((b) => billSignature(b) === sig)) {
          return prev;
        }
        return { ...prev, bills: [...prev.bills, candidate] };
      });
    },
    [patch],
  );

  const deleteBill = useCallback(
    (id: string) => {
      patch((prev) => ({ ...prev, bills: prev.bills.filter((b) => b.id !== id) }));
    },
    [patch],
  );

  const updateIncomeStream = useCallback(
    (
      id: string,
      updates: Partial<
        Pick<
          IncomeStream,
          "name" | "amount" | "dueDay" | "frequency" | "category" | "icon" | "startDateISO" | "endDateISO" | "semiMonthlyDays"
        >
      >,
    ) => {
      patch((prev) => ({
        ...prev,
        incomeStreams: (prev.incomeStreams ?? []).map((s) => (s.id === id ? { ...s, ...updates } : s)),
      }));
    },
    [patch],
  );

  const addIncomeStream = useCallback(
    (input: Omit<IncomeStream, "id">) => {
      patch((prev) => {
        const candidate: IncomeStream = {
          ...input,
          id: newId("income"),
          frequency: input.frequency ?? "monthly",
          amount: Number(input.amount),
          dueDay: Number(input.dueDay),
        };
        const sig = incomeStreamSignature(candidate);
        const streams = prev.incomeStreams ?? [];
        if (streams.some((s) => incomeStreamSignature(s) === sig)) return prev;
        return { ...prev, incomeStreams: [...streams, candidate] };
      });
    },
    [patch],
  );

  const deleteIncomeStream = useCallback(
    (id: string) => {
      patch((prev) => ({
        ...prev,
        incomeStreams: (prev.incomeStreams ?? []).filter((s) => s.id !== id),
      }));
    },
    [patch],
  );

  const updateRecurringTransaction = useCallback(
    (
      id: string,
      updates: Partial<
        Pick<RecurringTransaction, "name" | "amount" | "dueDay" | "frequency" | "category" | "icon" | "transactionType">
      >,
    ) => {
      patch((prev) => ({
        ...prev,
        recurringTransactions: (prev.recurringTransactions ?? []).map((r) =>
          r.id === id ? { ...r, ...updates } : r,
        ),
      }));
    },
    [patch],
  );

  const addRecurringTransaction = useCallback(
    (input: Omit<RecurringTransaction, "id">) => {
      patch((prev) => {
        const candidate: RecurringTransaction = {
          ...input,
          id: newId("recur"),
          frequency: input.frequency ?? "monthly",
          amount: Number(input.amount),
          dueDay: Number(input.dueDay),
          transactionType: input.transactionType || "expense",
        };
        const sig = recurringTransactionSignature(candidate);
        const items = prev.recurringTransactions ?? [];
        if (items.some((r) => recurringTransactionSignature(r) === sig)) return prev;
        return { ...prev, recurringTransactions: [...items, candidate] };
      });
    },
    [patch],
  );

  const deleteRecurringTransaction = useCallback(
    (id: string) => {
      patch((prev) => ({
        ...prev,
        recurringTransactions: (prev.recurringTransactions ?? []).filter((r) => r.id !== id),
      }));
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
      patch((prev) => {
        const profile = { ...prev.profile, ...updates };
        if (updates.startingBalance !== undefined) {
          profile.balanceAsOfISO = todayISO();
        }
        return { ...prev, profile };
      });
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

  const toggleDashboardWidgetLock = useCallback(
    (id: string) => {
      patch((prev) => ({
        ...prev,
        lockedDashboardWidgets: toggleWidgetPositionLock(prev.lockedDashboardWidgets ?? [], id),
      }));
    },
    [patch],
  );

  const setLockedDashboardWidgets = useCallback(
    (locked: string[] | ((prev: string[]) => string[])) => {
      patch((prev) => ({
        ...prev,
        lockedDashboardWidgets:
          typeof locked === "function" ? locked(prev.lockedDashboardWidgets ?? []) : locked,
      }));
    },
    [patch],
  );

  const addAccount = useCallback(
    (input: Omit<Account, "id">) => {
      patch((prev) => ({
        ...prev,
        accounts: [...prev.accounts, { ...input, id: newId("acct") }],
      }));
    },
    [patch],
  );

  const deleteAccount = useCallback(
    (id: string) => {
      patch((prev) => ({ ...prev, accounts: prev.accounts.filter((a) => a.id !== id) }));
    },
    [patch],
  );

  const addTransactionType = useCallback(
    (input: { name: string; icon: string; flow: TransactionFlow }) => {
      patch((prev) => {
        const types = [...(prev.transactionTypes ?? []), {
          id: newId("ttype"),
          name: input.name.trim(),
          icon: input.icon || "🏷️",
          flow: input.flow,
        }];
        return { ...prev, transactionTypes: types, typeIcons: typeIconsFromTransactionTypes(types) };
      });
    },
    [patch],
  );

  const updateTransactionType = useCallback(
    (id: string, updates: Partial<Pick<FetyTransactionType, "name" | "icon" | "flow">>) => {
      patch((prev) => {
        const types = (prev.transactionTypes ?? []).map((t) => {
          if (t.id !== id) return t;
            if (t.locked && updates.flow !== undefined) {
            const { flow: _flow, ...rest } = updates;
            return { ...t, ...rest, name: rest.name !== undefined ? rest.name.trim() || t.name : t.name };
          }
          return { ...t, ...updates, name: updates.name !== undefined ? updates.name.trim() || t.name : t.name };
        });
        return { ...prev, transactionTypes: types, typeIcons: typeIconsFromTransactionTypes(types) };
      });
    },
    [patch],
  );

  const deleteTransactionType = useCallback(
    (id: string) => {
      patch((prev) => {
        if (prev.transactions.some((t) => t.type === id)) return prev;
        if ((prev.recurringTransactions ?? []).some((r) => r.transactionType === id)) return prev;
        const target = (prev.transactionTypes ?? []).find((t) => t.id === id);
        if (!target || target.locked) return prev;
        const types = (prev.transactionTypes ?? []).filter((t) => t.id !== id);
        return { ...prev, transactionTypes: types, typeIcons: typeIconsFromTransactionTypes(types) };
      });
    },
    [patch],
  );

  const updateTypeIcons = useCallback(
    (typeIcons: import("../types/fety").TypeIconMap) => {
      patch((prev) => ({ ...prev, typeIcons: { ...typeIcons } }));
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

  const replaceIncomeStreams = useCallback((incomeStreams: IncomeStream[]) => {
    patch((prev) => ({ ...prev, incomeStreams }));
  }, [patch]);

  const replaceRecurringTransactions = useCallback((recurringTransactions: RecurringTransaction[]) => {
    patch((prev) => ({ ...prev, recurringTransactions }));
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
    deleteCategory,
    addBill,
    deleteBill,
    addIncomeStream,
    updateIncomeStream,
    deleteIncomeStream,
    addRecurringTransaction,
    updateRecurringTransaction,
    deleteRecurringTransaction,
    addGoal,
    updateGoal,
    deleteGoal,
    updateProfile,
    updateAccount,
    addAccount,
    deleteAccount,
    addMessage,
    setPinnedWidgets,
    toggleDashboardWidgetLock,
    setLockedDashboardWidgets,
    resetAll,
    startFreshSetup,
    completeOnboarding,
    replaceCategories,
    replaceBills,
    replaceIncomeStreams,
    replaceRecurringTransactions,
    importTransactionsBulk,
    updateTypeIcons,
    addTransactionType,
    updateTransactionType,
    deleteTransactionType,
  };
}
