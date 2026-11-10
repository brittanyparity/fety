import type { useFetyData } from "../hooks/useFetyData";

export type MobileTab = "transactions" | "budget" | "insights" | "home" | "goals";

export type MobileManageActions = Pick<
  ReturnType<typeof useFetyData>,
  | "updateCategoryBudget"
  | "updateCategory"
  | "addCategory"
  | "deleteCategory"
  | "updateBill"
  | "addBill"
  | "deleteBill"
  | "updateIncomeStream"
  | "addIncomeStream"
  | "deleteIncomeStream"
  | "updateRecurringTransaction"
  | "addRecurringTransaction"
  | "deleteRecurringTransaction"
  | "addGoal"
  | "updateGoal"
  | "deleteGoal"
  | "updateAccount"
  | "addAccount"
  | "deleteAccount"
  | "reconcileAccount"
>;
