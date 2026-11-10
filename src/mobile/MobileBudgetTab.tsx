import { useMemo } from "react";
import { getTransactionTypes } from "../lib/transactionTypes";
import type { FinanceSummary, FetyStore } from "../types/fety";
import { BudgetManageView } from "../views/ManageViews";
import type { MobileManageActions } from "./types";

export default function MobileBudgetTab({
  summary,
  store,
  actions,
}: {
  summary: FinanceSummary;
  store: FetyStore;
  actions: Pick<
    MobileManageActions,
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
  >;
}) {
  const transactionTypes = useMemo(() => getTransactionTypes(store), [store]);

  return (
    <div className="fety-mobile-manage-view">
      <BudgetManageView
        categories={summary.categoriesWithSpent}
        bills={store.bills}
        incomeStreams={store.incomeStreams ?? []}
        recurringTransactions={store.recurringTransactions ?? []}
        transactions={store.transactions}
        profile={store.profile}
        transactionTypes={transactionTypes}
        viewMode="list"
        accounts={store.accounts}
        goals={store.goals}
        typeIcons={store.typeIcons}
        onUpdateBudget={actions.updateCategoryBudget}
        onUpdateCategory={actions.updateCategory}
        onAddCategory={actions.addCategory}
        onDeleteCategory={actions.deleteCategory}
        onUpdateBill={actions.updateBill}
        onAddBill={actions.addBill}
        onDeleteBill={actions.deleteBill}
        onUpdateIncomeStream={actions.updateIncomeStream}
        onAddIncomeStream={actions.addIncomeStream}
        onDeleteIncomeStream={actions.deleteIncomeStream}
        onUpdateRecurringTransaction={actions.updateRecurringTransaction}
        onAddRecurringTransaction={actions.addRecurringTransaction}
        onDeleteRecurringTransaction={actions.deleteRecurringTransaction}
      />
    </div>
  );
}
