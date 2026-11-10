import type { FetyStore } from "../types/fety";
import { GoalsManageView } from "../views/ManageViews";
import type { MobileManageActions } from "./types";

export default function MobileGoalsTab({
  store,
  actions,
}: {
  store: FetyStore;
  actions: Pick<MobileManageActions, "addGoal" | "updateGoal" | "deleteGoal">;
}) {
  return (
    <div className="fety-mobile-manage-view">
      <GoalsManageView
        goals={store.goals}
        accounts={store.accounts}
        goalLedgerStore={store}
        viewMode="list"
        onAdd={actions.addGoal}
        onUpdate={actions.updateGoal}
        onDelete={actions.deleteGoal}
      />
    </div>
  );
}
