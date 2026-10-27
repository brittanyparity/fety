import type { PlannerNode, PlannerNodeKind, PlannerStrategyPreset } from "./plannerTypes";
import { PLANNER_NODE_CATALOG, PLANNER_STRATEGY_LABELS } from "./plannerTypes";

let idCounter = 0;

export function newPlannerNodeId(): string {
  idCounter += 1;
  return `pln-${idCounter}-${Date.now().toString(36)}`;
}

export function createPlannerNode(kind: PlannerNodeKind, x: number, y: number): PlannerNode {
  const meta = PLANNER_NODE_CATALOG.find((c) => c.kind === kind)!;
  const base = { id: newPlannerNodeId(), kind, x, y, label: meta.label };

  switch (kind) {
    case "anchor":
      return { ...base, kind: "anchor" };
    case "purchase":
      return { ...base, kind: "purchase", amount: 800, monthOffset: 1 };
    case "investment":
      return { ...base, kind: "investment", amount: 1500, monthOffset: 2, annualReturnPct: 7 };
    case "savings":
      return { ...base, kind: "savings", amountPerMonth: 250, startMonth: 0 };
    case "strategy": {
      const preset: PlannerStrategyPreset = "pay-yourself-first";
      return {
        ...base,
        kind: "strategy",
        preset,
        label: PLANNER_STRATEGY_LABELS[preset],
      };
    }
    case "outcome":
      return { ...base, kind: "outcome" };
    default:
      return { ...base, kind: "anchor" };
  }
}

export function defaultPlannerWorkspace(): { nodes: PlannerNode[]; edges: { id: string; fromId: string; toId: string }[] } {
  const anchor = createPlannerNode("anchor", 48, 220);
  const strategy = createPlannerNode("strategy", 280, 120);
  const savings = createPlannerNode("savings", 280, 320);
  savings.label = "Monthly goal savings";
  const purchase = createPlannerNode("purchase", 520, 200);
  purchase.label = "Planned purchase";
  const outcome = createPlannerNode("outcome", 760, 220);

  return {
    nodes: [anchor, strategy, savings, purchase, outcome],
    edges: [
      { id: newPlannerNodeId(), fromId: anchor.id, toId: strategy.id },
      { id: newPlannerNodeId(), fromId: anchor.id, toId: savings.id },
      { id: newPlannerNodeId(), fromId: strategy.id, toId: purchase.id },
      { id: newPlannerNodeId(), fromId: savings.id, toId: purchase.id },
      { id: newPlannerNodeId(), fromId: purchase.id, toId: outcome.id },
    ],
  };
}
