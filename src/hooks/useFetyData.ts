import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { computeSummary, todayISO } from "../lib/fetyCalculations";
import { scheduledItemStoredCategory } from "../lib/scheduledItemCatalog";
import {
  goalIdForBudgetCategory,
  iconForTransactionCategory,
  isRemovedBudgetCategoryName,
} from "../lib/transactionCategories";
import {
  applyBillScheduleToStore,
  billSignature,
  incomeStreamSignature,
  isScheduledTransaction,
  parseScheduledTransactionId,
  recurringTransactionSignature,
  skipKeyForOccurrence,
  normalizeSkippedOccurrences,
} from "../lib/billScheduling";
import { newCalendarNoteId, normalizeCalendarNotes } from "../lib/calendarNotes";
import { archiveInsightTip, markInsightTipDone } from "../lib/insightTips";
import {
  createEmptyStore,
  createExploreStore,
  importStoreSnapshot,
  loadStore,
  newId,
  saveStore,
  resetStore as resetStored,
  resetToEmptyStore,
} from "../lib/fetyStorage";
import { assessFinancialNeeds, shouldApplyPersonalizedPins, withPersonalizedPins } from "../lib/needsAssessment";
import { buildDashboardWidgetStates, markWidgetUserModified } from "../lib/dashboardPreferences";
import { roundMoney } from "../lib/scheduleAmounts";
import { toggleWidgetPositionLock } from "../lib/widgetLayout";
import { normalizeAccountRecord, reconcileAccountBalance } from "../lib/ledger";
import {
  flowForTransactionType,
  iconForTransactionType,
  signAmountForFlow,
  typeIconsFromTransactionTypes,
} from "../lib/transactionTypes";
import { applyScheduledItemTransactionSync } from "../lib/scheduledItemCatalog";
import {
  applyPostingDefaults,
  markTransactionCompleted,
  markTransactionPlannedAgain,
} from "../lib/transactionPosting";
import type {
  Account,
  AddTransactionInput,
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
  const [store, setStore] = useState<FetyStore>(() => {
    try {
      const loaded = loadStore();
      return shouldApplyPersonalizedPins(loaded) ? withPersonalizedPins(loaded) : loaded;
    } catch {
      return createEmptyStore();
    }
  });
  useEffect(() => {
    saveStore(store);
  }, [store]);

  const summary = useMemo(() => computeSummary(store), [store]);

  const [undoOffer, setUndoOffer] = useState<{ label: string } | null>(null);
  const undoStoreRef = useRef<FetyStore | null>(null);

  const patch = useCallback((fn: (prev: FetyStore) => FetyStore) => {
    setStore((prev) => applyBillScheduleToStore(fn(prev)));
  }, []);

  const patchWithUndo = useCallback(
    (label: string, fn: (prev: FetyStore) => FetyStore) => {
      setStore((prev) => {
        undoStoreRef.current = applyBillScheduleToStore(prev);
        setUndoOffer({ label });
        return applyBillScheduleToStore(fn(prev));
      });
    },
    [],
  );

  const undoLastChange = useCallback(() => {
    const snapshot = undoStoreRef.current;
    if (!snapshot) return;
    undoStoreRef.current = null;
    setUndoOffer(null);
    setStore(snapshot);
  }, []);

  const dismissUndo = useCallback(() => {
    undoStoreRef.current = null;
    setUndoOffer(null);
  }, []);

  const addTransaction = useCallback(
    (input: AddTransactionInput) => {
      let created: Transaction | null = null;
      patch((prev) => {
        let store = prev;
        const normalized = applyPostingDefaults(input);
        if (
          normalized.updateScheduledItem &&
          normalized.scheduledItemKind &&
          normalized.scheduledItemId
        ) {
          store = applyScheduledItemTransactionSync(
            store,
            { kind: normalized.scheduledItemKind, id: normalized.scheduledItemId },
            normalized.amount,
            normalized.dateISO ?? new Date().toISOString().slice(0, 10),
          );
        }
        const flow = flowForTransactionType(store, normalized.type);
        const icon =
          normalized.icon ??
          iconForTransactionCategory(store, normalized.category) ??
          iconForTransactionType(store, normalized.type);
        const asOf = store.profile.balanceAsOfISO;
        const rawDate = normalized.dateISO ?? new Date().toISOString().slice(0, 10);
        const tx: Transaction = {
          id: newId("tx"),
          dateISO: asOf && rawDate < asOf ? asOf : rawDate,
          desc: normalized.desc,
          category: normalized.category,
          amount: signAmountForFlow(flow, normalized.amount),
          type: normalized.type,
          icon,
          fromAccountId: normalized.fromAccountId || undefined,
          toAccountId: normalized.toAccountId || undefined,
          goalId: normalized.goalId || goalIdForBudgetCategory(store, normalized.category) || undefined,
          scheduledItemKind: normalized.scheduledItemKind,
          scheduledItemId: normalized.scheduledItemId,
          postingStatus: normalized.postingStatus,
          completedAtISO: normalized.completedAtISO,
          notes: normalized.notes,
        };
        created = tx;
        return { ...store, transactions: [tx, ...store.transactions] };
      });
      return created!;
    },
    [patch],
  );

  const completeTransaction = useCallback(
    (id: string, completedAtISO?: string) => {
      patchWithUndo("Transaction marked as completed", (prev) => ({
        ...prev,
        transactions: prev.transactions.map((t) =>
          t.id === id ? markTransactionCompleted(t, completedAtISO ?? todayISO()) : t,
        ),
      }));
    },
    [patchWithUndo],
  );

  const markTransactionUpcoming = useCallback(
    (id: string) => {
      patchWithUndo("Transaction marked as upcoming", (prev) => ({
        ...prev,
        transactions: prev.transactions.map((t) => (t.id === id ? markTransactionPlannedAgain(t) : t)),
      }));
    },
    [patchWithUndo],
  );

  const deleteTransaction = useCallback(
    (id: string) => {
      patchWithUndo("Transaction deleted", (prev) => {
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
    [patchWithUndo],
  );

  const deleteTransactionsBulk = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      patchWithUndo(
        ids.length === 1 ? "Transaction deleted" : `${ids.length} transactions deleted`,
        (prev) => {
          const skipped = normalizeSkipped(prev);
          for (const id of ids) {
            const parsed = parseScheduledTransactionId(id);
            if (parsed) {
              const key = skipKeyForOccurrence(parsed.kind, parsed.sourceId, parsed.dateISO);
              if (!skipped.includes(key)) skipped.push(key);
            }
          }
          return {
            ...prev,
            skippedScheduledOccurrences: skipped,
            transactions: prev.transactions.filter((t) => !idSet.has(t.id)),
          };
        },
      );
    },
    [patchWithUndo],
  );

  const updateTransaction = useCallback(
    (
      id: string,
      updates: Partial<
        Pick<
          Transaction,
          | "desc"
          | "amount"
          | "type"
          | "category"
          | "dateISO"
          | "icon"
          | "fromAccountId"
          | "toAccountId"
          | "goalId"
          | "postingStatus"
          | "completedAtISO"
          | "notes"
        >
      >,
    ) => {
      patch((prev) => ({
        ...prev,
        transactions: prev.transactions.map((t) => {
          if (t.id !== id) return t;
          let next: Transaction = { ...t, ...updates };
          if (updates.amount !== undefined || updates.type !== undefined) {
            const type = updates.type ?? t.type;
            const raw = updates.amount !== undefined ? updates.amount : Math.abs(t.amount);
            const flow = flowForTransactionType(prev, type);
            next.amount = signAmountForFlow(flow, raw);
            next.type = type;
          }
          const asOf = prev.profile.balanceAsOfISO;
          if (asOf && next.dateISO < asOf) next.dateISO = asOf;
          if (updates.fromAccountId === "") next.fromAccountId = undefined;
          if (updates.toAccountId === "") next.toAccountId = undefined;
          if (updates.goalId === "") next.goalId = undefined;
          if (updates.category !== undefined && updates.goalId === undefined) {
            const linkedGoal = goalIdForBudgetCategory(prev, next.category);
            if (linkedGoal) next.goalId = linkedGoal;
          }
          if (updates.category !== undefined && updates.icon === undefined) {
            next.icon =
              iconForTransactionCategory(prev, next.category) ?? iconForTransactionType(prev, next.type);
          }
          // Projected schedule rows are rebuilt from bills/income/recur; keep user edits as manual txs.
          if (isScheduledTransaction(t.id)) {
            const parsed = parseScheduledTransactionId(t.id);
            next = {
              ...next,
              id: newId("tx"),
              scheduledItemKind: parsed?.kind ?? t.scheduledItemKind,
              scheduledItemId: parsed?.sourceId ?? t.scheduledItemId,
            };
          }
          return next;
        }),
      }));
    },
    [patch],
  );

  const updateBill = useCallback(
    (id: string, updates: Partial<Pick<Bill, "name" | "amount" | "dueDay" | "frequency" | "category" | "icon" | "fromAccountId">>) => {
      patch((prev) => ({
        ...prev,
        bills: prev.bills.map((b) => {
          if (b.id !== id) return b;
          const next = { ...b, ...updates };
          return { ...next, category: scheduledItemStoredCategory(next.name) };
        }),
      }));
    },
    [patch],
  );

  const updateCategory = useCallback(
    (id: string, updates: Partial<Pick<BudgetCategory, "monthlyBudget" | "goalId">>) => {
      patch((prev) => ({
        ...prev,
        categories: prev.categories.map((c) => {
          if (c.id !== id) return c;
          const next: BudgetCategory = { ...c, ...updates };
          if (updates.monthlyBudget !== undefined) {
            next.monthlyBudget = roundMoney(updates.monthlyBudget);
          }
          if (updates.goalId === "") next.goalId = undefined;
          return next;
        }),
      }));
    },
    [patch],
  );

  const updateCategoryBudget = useCallback(
    (id: string, monthlyBudget: number) => {
      updateCategory(id, { monthlyBudget });
    },
    [updateCategory],
  );

  const addCategory = useCallback(
    (input: { name: string; icon: string; monthlyBudget: number; goalId?: string }) => {
      const name = input.name.trim();
      if (!name || isRemovedBudgetCategoryName(name)) return;
      const cat: BudgetCategory = {
        id: newId("cat"),
        name,
        icon: input.icon || "📁",
        monthlyBudget: roundMoney(input.monthlyBudget),
        goalId: input.goalId || undefined,
      };
      patch((prev) => ({ ...prev, categories: [...prev.categories, cat] }));
    },
    [patch],
  );

  const deleteCategory = useCallback(
    (id: string) => {
      patchWithUndo("Budget category removed", (prev) => ({
        ...prev,
        categories: prev.categories.filter((c) => c.id !== id),
      }));
    },
    [patchWithUndo],
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
          category: scheduledItemStoredCategory(input.name),
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
          "name" | "amount" | "dueDay" | "frequency" | "category" | "icon" | "startDateISO" | "endDateISO" | "semiMonthlyDays" | "toAccountId"
        >
      >,
    ) => {
      patch((prev) => ({
        ...prev,
        incomeStreams: (prev.incomeStreams ?? []).map((s) => {
          if (s.id !== id) return s;
          const next = { ...s, ...updates };
          return { ...next, category: scheduledItemStoredCategory(next.name) };
        }),
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
          category: scheduledItemStoredCategory(input.name),
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
        Pick<RecurringTransaction, "name" | "amount" | "dueDay" | "frequency" | "category" | "icon" | "transactionType" | "fromAccountId" | "toAccountId" | "goalId">
      >,
    ) => {
      patch((prev) => ({
        ...prev,
        recurringTransactions: (prev.recurringTransactions ?? []).map((r) => {
          if (r.id !== id) return r;
          const next = { ...r, ...updates };
          return { ...next, category: scheduledItemStoredCategory(next.name) };
        }),
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
          category: scheduledItemStoredCategory(input.name),
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
    (id: string, updates: Partial<Pick<Goal, "saved" | "target" | "monthlyContribution" | "targetDate" | "name" | "icon" | "accountId">>) => {
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
        if (updates.startingBalance !== undefined && updates.balanceAsOfISO === undefined) {
          profile.balanceAsOfISO = todayISO();
        }
        return { ...prev, profile };
      });
    },
    [patch],
  );

  const updateAccount = useCallback(
    (id: string, updates: Partial<Pick<Account, "name" | "type" | "balance" | "icon" | "kind" | "balanceAsOfISO">>) => {
      patch((prev) => ({
        ...prev,
        accounts: prev.accounts.map((a) =>
          a.id === id ? normalizeAccountRecord({ ...a, ...updates }, prev) : a,
        ),
      }));
    },
    [patch],
  );

  const reconcileAccount = useCallback(
    (accountId: string, verifiedBalance: number, dateISO?: string) => {
      const when = dateISO ?? todayISO();
      patchWithUndo("Account balance matched", (prev) => {
        const { store: next } = reconcileAccountBalance(
          prev,
          accountId,
          verifiedBalance,
          when,
          newId("recon"),
        );
        return next;
      });
    },
    [patchWithUndo],
  );

  const addMessage = useCallback((msg: ChatMessage) => {
    patch((prev) => ({ ...prev, messages: [...prev.messages, msg] }));
  }, [patch]);

  const updateMessage = useCallback((id: number, updates: Partial<ChatMessage>) => {
    patch((prev) => ({
      ...prev,
      messages: prev.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    }));
  }, [patch]);

  const setPinnedWidgets = useCallback(
    (pinnedWidgets: string[] | ((prev: string[]) => string[])) => {
      patch((prev) => {
        const nextPinned =
          typeof pinnedWidgets === "function"
            ? pinnedWidgets(prev.pinnedWidgets)
            : pinnedWidgets;
        const added = nextPinned.find((id) => !prev.pinnedWidgets.includes(id));
        const removed = prev.pinnedWidgets.find((id) => !nextPinned.includes(id));
        const changedId = added ?? removed;
        return {
          ...prev,
          pinnedWidgets: nextPinned,
          dashboardCustomizedByUser: true,
          dashboardWidgetStates: changedId
            ? markWidgetUserModified(
                prev.dashboardWidgetStates,
                changedId,
                Boolean(added),
                nextPinned,
              )
            : (prev.dashboardWidgetStates ?? []).map((s, i) => ({
                ...s,
                position: nextPinned.indexOf(s.widgetId),
                enabled: nextPinned.includes(s.widgetId),
                userModified: true,
              })),
        };
      });
    },
    [patch],
  );

  const restoreRecommendedWidgets = useCallback(() => {
    patch((prev) => {
      const assessment = assessFinancialNeeds(prev);
      const pinned = assessment.recommendedPinned;
      return {
        ...prev,
        pinnedWidgets: pinned,
        dashboardWidgetStates: buildDashboardWidgetStates(pinned, assessment),
        widgetsPersonalizedV1: true,
        dashboardCustomizedByUser: false,
      };
    });
  }, [patch]);

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
        accounts: [...prev.accounts, normalizeAccountRecord({ ...input, id: newId("acct") }, prev)],
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

  const startExplorePlatform = useCallback(() => {
    const demo = withPersonalizedPins(createExploreStore());
    saveStore(demo);
    setStore(demo);
  }, []);

  const addCalendarNote = useCallback((dateISO: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    patch((prev) => {
      const byDay = normalizeCalendarNotes(prev.calendarNotes);
      const dayNotes = [...(byDay[dateISO] ?? [])];
      dayNotes.push({ id: newCalendarNoteId(), text: trimmed, createdISO: dateISO });
      return { ...prev, calendarNotes: { ...byDay, [dateISO]: dayNotes } };
    });
  }, [patch]);

  const deleteCalendarNote = useCallback((dateISO: string, noteId: string) => {
    patch((prev) => {
      const byDay = normalizeCalendarNotes(prev.calendarNotes);
      const nextDay = (byDay[dateISO] ?? []).filter((n) => n.id !== noteId);
      const next = { ...byDay };
      if (nextDay.length > 0) next[dateISO] = nextDay;
      else delete next[dateISO];
      return { ...prev, calendarNotes: next };
    });
  }, [patch]);

  /** @deprecated Use addCalendarNote — kept for call sites that append notes. */
  const updateCalendarNote = addCalendarNote;

  const markTipDone = useCallback(
    (tipId: string) => {
      patch((prev) => ({
        ...prev,
        insightTipProgress: markInsightTipDone(prev, tipId),
      }));
    },
    [patch],
  );

  const archiveTip = useCallback(
    (tipId: string) => {
      patch((prev) => ({
        ...prev,
        insightTipProgress: archiveInsightTip(prev, tipId),
      }));
    },
    [patch],
  );

  const completeOnboarding = useCallback(() => {
    patch((prev) => {
      const completed = { ...prev, onboardingCompleted: true };
      return withPersonalizedPins(completed);
    });
  }, [patch]);

  const completeSetup = useCallback(
    (payload: {
      profile: UserProfile;
      categories: BudgetCategory[];
      bills: Bill[];
      incomeStreams: IncomeStream[];
      recurringTransactions: RecurringTransaction[];
      goals: Goal[];
    }) => {
      patch((prev) => {
        const merged: FetyStore = {
          ...prev,
          profile: { ...prev.profile, ...payload.profile },
          categories: payload.categories,
          bills: payload.bills,
          incomeStreams: payload.incomeStreams,
          recurringTransactions: payload.recurringTransactions,
          goals: payload.goals,
          onboardingCompleted: true,
          exploreMode: false,
        };
        return withPersonalizedPins(merged);
      });
    },
    [patch],
  );

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

  const replaceGoals = useCallback((goals: Goal[]) => {
    patch((prev) => ({ ...prev, goals }));
  }, [patch]);

  const replaceStoreFromCloud = useCallback((snapshot: FetyStore) => {
    const migrated = importStoreSnapshot(snapshot);
    setStore(applyBillScheduleToStore(migrated));
  }, []);

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
    completeTransaction,
    markTransactionUpcoming,
    deleteTransaction,
    updateTransaction,
    updateBill,
    updateCategoryBudget,
    updateCategory,
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
    reconcileAccount,
    deleteTransactionsBulk,
    undoLastChange,
    dismissUndo,
    undoOffer,
    addAccount,
    deleteAccount,
    addMessage,
    updateMessage,
    setPinnedWidgets,
    restoreRecommendedWidgets,
    toggleDashboardWidgetLock,
    setLockedDashboardWidgets,
    resetAll,
    startFreshSetup,
    startExplorePlatform,
    addCalendarNote,
    deleteCalendarNote,
    updateCalendarNote,
    markTipDone,
    archiveTip,
    completeOnboarding,
    completeSetup,
    replaceCategories,
    replaceBills,
    replaceIncomeStreams,
    replaceRecurringTransactions,
    replaceGoals,
    importTransactionsBulk,
    replaceStoreFromCloud,
    updateTypeIcons,
    addTransactionType,
    updateTransactionType,
    deleteTransactionType,
  };
}
