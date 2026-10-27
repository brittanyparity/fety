import { computeSummary, dateToISOLocal, endingBalanceOnDate, todayISO } from "../../lib/fetyCalculations";
import type { FetyStore } from "../../types/fety";
import type {
  PlannerEdge,
  PlannerHorizonMonths,
  PlannerNode,
  PlannerRunResult,
  PlannerStep,
  PlannerStrategyPreset,
} from "./plannerTypes";

function addMonths(base: Date, months: number): Date {
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d;
}

function addWeeks(base: Date, weeks: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

function strategySavingsMultiplier(preset: PlannerStrategyPreset): number {
  if (preset === "pay-yourself-first") return 1.1;
  if (preset === "fifty-thirty-twenty") return 1.05;
  return 1;
}

function strategyBlocksExtras(preset: PlannerStrategyPreset): boolean {
  return preset === "emergency-fund-first";
}

/** Nodes on any path from anchor to outcome, in breadth-first order from anchor. */
export function orderedScenarioNodes(
  nodes: PlannerNode[],
  edges: PlannerEdge[],
): PlannerNode[] {
  const anchor = nodes.find((n) => n.kind === "anchor");
  if (!anchor) return [];

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out = new Map<string, string[]>();
  for (const e of edges) {
    const list = out.get(e.fromId) ?? [];
    list.push(e.toId);
    out.set(e.fromId, list);
  }

  const seen = new Set<string>();
  const queue = [anchor.id];
  const ordered: PlannerNode[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = byId.get(id);
    if (!node || node.kind === "anchor") {
      for (const next of out.get(id) ?? []) queue.push(next);
      continue;
    }
    ordered.push(node);
    for (const next of out.get(id) ?? []) queue.push(next);
  }

  return ordered;
}

export function runPlannerScenario(
  store: FetyStore,
  nodes: PlannerNode[],
  edges: PlannerEdge[],
  horizonMonths: PlannerHorizonMonths,
  step: PlannerStep,
): PlannerRunResult {
  const notes: string[] = [];
  const today = todayISO();
  const startBal = endingBalanceOnDate(store, today);
  const summary = computeSummary(store, new Date(`${today}T12:00:00`));
  const monthlyDrift = summary.monthlyIncome + summary.monthlyExpenses;

  const scenarioNodes = orderedScenarioNodes(nodes, edges);
  if (!nodes.some((n) => n.kind === "outcome")) {
    notes.push("Add an Outcome node and connect your flow to see a full run.");
  }
  if (scenarioNodes.length === 0) {
    notes.push("Connect actions from “Your finances today” toward an Outcome.");
  }

  const strategies = scenarioNodes.filter((n) => n.kind === "strategy");
  let savingsMult = 1;
  let blockPurchases = false;
  for (const s of strategies) {
    if (s.kind !== "strategy") continue;
    savingsMult *= strategySavingsMultiplier(s.preset);
    if (strategyBlocksExtras(s.preset)) blockPurchases = true;
    notes.push(`Strategy applied: ${s.label}.`);
  }

  const stepCount = step === "monthly" ? horizonMonths : horizonMonths * 4;
  const points: PlannerRunResult["points"] = [];
  let balance = startBal;
  let invested = 0;
  let lowest = balance;
  const startDate = new Date(`${today}T12:00:00`);

  for (let i = 0; i <= stepCount; i++) {
    const date =
      step === "monthly" ? addMonths(startDate, i) : addWeeks(startDate, i);
    const dateISO = dateToISOLocal(date);
    const monthIndex = step === "monthly" ? i : Math.floor(i / 4);

    if (i > 0) {
      const drift =
        step === "monthly" ? monthlyDrift : monthlyDrift / 4;
      balance += drift;

      for (const node of scenarioNodes) {
        if (node.kind === "purchase") {
          if (blockPurchases && monthIndex < 3) continue;
          if (node.monthOffset === monthIndex) balance -= node.amount;
        }
        if (node.kind === "investment") {
          if (node.monthOffset === monthIndex) {
            balance -= node.amount;
            invested += node.amount;
          }
          if (invested > 0 && node.monthOffset <= monthIndex) {
            const monthlyRate = node.annualReturnPct / 100 / 12;
            invested *= 1 + (step === "monthly" ? monthlyRate : monthlyRate / 4);
          }
        }
        if (node.kind === "savings") {
          if (monthIndex >= node.startMonth) {
            balance -= node.amountPerMonth * savingsMult * (step === "monthly" ? 1 : 0.25);
          }
        }
      }
    }

    lowest = Math.min(lowest, balance);
    const label =
      step === "monthly"
        ? date.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
        : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    points.push({
      stepIndex: i,
      label,
      dateISO,
      balance,
      invested,
    });
  }

  const endingBalance = balance + invested;
  if (lowest < 0) {
    notes.push("Cash goes negative in this scenario—adjust timing or amounts.");
  }

  return {
    points,
    endingBalance,
    totalInvested: invested,
    lowestBalance: lowest,
    notes,
  };
}
