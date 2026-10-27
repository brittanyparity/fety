import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { endingBalanceOnDate, todayISO } from "../../lib/fetyCalculations";
import type { FetyStore } from "../../types/fety";
import PlannerCanvas from "./PlannerCanvas";
import { createPlannerNode, defaultPlannerWorkspace, newPlannerNodeId } from "./plannerNodeFactory";
import { runPlannerScenario } from "./plannerScenarioRun";
import type {
  PlannerEdge,
  PlannerHorizonMonths,
  PlannerNode,
  PlannerNodeKind,
  PlannerRunResult,
  PlannerStep,
} from "./plannerTypes";
import { PLANNER_NODE_CATALOG } from "./plannerTypes";

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export default function PlannerWorkspaceView({ store }: { store: FetyStore }) {
  const initial = useMemo(() => defaultPlannerWorkspace(), []);
  const [nodes, setNodes] = useState<PlannerNode[]>(initial.nodes);
  const [edges, setEdges] = useState<PlannerEdge[]>(initial.edges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [linkFromId, setLinkFromId] = useState<string | null>(null);
  const [horizon, setHorizon] = useState<PlannerHorizonMonths>(12);
  const [step, setStep] = useState<PlannerStep>("monthly");
  const [runResult, setRunResult] = useState<PlannerRunResult | null>(null);
  const [scenarioName, setScenarioName] = useState("Untitled scenario");

  const todayBalance = useMemo(() => endingBalanceOnDate(store, todayISO()), [store]);

  const chartData = useMemo(
    () =>
      (runResult?.points ?? []).map((p) => ({
        label: p.label,
        total: Math.round(p.balance + p.invested),
        cash: Math.round(p.balance),
      })),
    [runResult],
  );

  const addNode = (kind: PlannerNodeKind) => {
    if (kind === "anchor" && nodes.some((n) => n.kind === "anchor")) return;
    const node = createPlannerNode(kind, 120 + nodes.length * 24, 80 + nodes.length * 18);
    setNodes((prev) => [...prev, node]);
    setSelectedNodeId(node.id);
  };

  const moveNode = (id: string, x: number, y: number) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, x: Math.max(8, x), y: Math.max(8, y) } : n)));
  };

  const updateNode = (node: PlannerNode) => {
    setNodes((prev) => prev.map((n) => (n.id === node.id ? node : n)));
  };

  const removeNode = (id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) => prev.filter((e) => e.fromId !== id && e.toId !== id));
    if (selectedNodeId === id) setSelectedNodeId(null);
  };

  const startLink = (fromId: string) => {
    setLinkFromId(fromId);
  };

  const completeLink = (toId: string) => {
    if (!linkFromId || linkFromId === toId) {
      setLinkFromId(null);
      return;
    }
    const exists = edges.some((e) => e.fromId === linkFromId && e.toId === toId);
    if (!exists) {
      setEdges((prev) => [...prev, { id: newPlannerNodeId(), fromId: linkFromId, toId }]);
    }
    setLinkFromId(null);
  };

  const runScenario = () => {
    setRunResult(runPlannerScenario(store, nodes, edges, horizon, step));
  };

  const resetWorkspace = () => {
    const next = defaultPlannerWorkspace();
    setNodes(next.nodes);
    setEdges(next.edges);
    setRunResult(null);
    setLinkFromId(null);
    setSelectedNodeId(null);
  };

  return (
    <div className="fety-planner-root" data-tour-id="calendar">
      <header className="fety-planner-toolbar">
        <div className="fety-planner-toolbar-start">
          <h1 className="fety-planner-title">Planner</h1>
          <input
            className="fety-planner-scenario-name"
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
            aria-label="Scenario name"
          />
        </div>
        <div className="fety-planner-toolbar-controls">
          <label className="fety-planner-control">
            <span className="fety-label">Horizon</span>
            <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value) as PlannerHorizonMonths)}>
              <option value={6}>6 months</option>
              <option value={12}>12 months</option>
              <option value={24}>24 months</option>
            </select>
          </label>
          <label className="fety-planner-control">
            <span className="fety-label">Steps</span>
            <select value={step} onChange={(e) => setStep(e.target.value as PlannerStep)}>
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
            </select>
          </label>
          <button type="button" className="fety-planner-btn fety-planner-btn--ghost" onClick={resetWorkspace}>
            Reset canvas
          </button>
          <button type="button" className="fety-planner-btn fety-planner-btn--primary" onClick={runScenario}>
            Run scenario
          </button>
        </div>
      </header>

      <div className="fety-planner-body">
        <aside className="fety-planner-palette" aria-label="Action elements">
          <p className="fety-planner-palette-heading">Actions</p>
          <p className="fety-planner-palette-sub">
            Add nodes, connect out → in, then run to project cash and investments.
          </p>
          <ul className="fety-planner-palette-list">
            {PLANNER_NODE_CATALOG.map((item) => (
              <li key={item.kind}>
                <button
                  type="button"
                  className="fety-planner-palette-item"
                  onClick={() => addNode(item.kind)}
                  disabled={item.kind === "anchor" && nodes.some((n) => n.kind === "anchor")}
                >
                  <span className="fety-planner-palette-icon" aria-hidden>
                    {item.icon}
                  </span>
                  <span className="fety-planner-palette-text">
                    <span className="fety-planner-palette-label">{item.label}</span>
                    <span className="fety-planner-palette-desc">{item.description}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {linkFromId ? (
            <p className="fety-planner-link-hint">Click an input port (left dot) on another node to connect.</p>
          ) : (
            <p className="fety-planner-link-hint">Use the right port on a node to start a connection.</p>
          )}
        </aside>

        <div className="fety-planner-canvas-wrap">
          <PlannerCanvas
            nodes={nodes}
            edges={edges}
            selectedNodeId={selectedNodeId}
            linkFromId={linkFromId}
            onSelectNode={setSelectedNodeId}
            onMoveNode={moveNode}
            onStartLink={startLink}
            onCompleteLink={completeLink}
            onUpdateNode={updateNode}
            onRemoveNode={removeNode}
          />
        </div>

        <aside className="fety-planner-results" aria-label="Scenario results">
          <p className="fety-planner-results-heading">Outcome</p>
          <div className="fety-planner-stat-grid">
            <div className="fety-planner-stat">
              <span className="fety-label">Cash today</span>
              <strong>{usd(todayBalance)}</strong>
            </div>
            {runResult ? (
              <>
                <div className="fety-planner-stat">
                  <span className="fety-label">Projected total</span>
                  <strong>{usd(runResult.endingBalance)}</strong>
                </div>
                <div className="fety-planner-stat">
                  <span className="fety-label">Lowest cash</span>
                  <strong>{usd(runResult.lowestBalance)}</strong>
                </div>
                <div className="fety-planner-stat">
                  <span className="fety-label">In investments</span>
                  <strong>{usd(runResult.totalInvested)}</strong>
                </div>
              </>
            ) : null}
          </div>

          {runResult && runResult.notes.length > 0 ? (
            <ul className="fety-planner-notes">
              {runResult.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}

          <div className="fety-planner-chart">
            {runResult && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="plannerFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="var(--clear)" stopOpacity={0.35} />
                      <stop offset="1" stopColor="var(--clear)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 9, fill: "var(--ink-3)" }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: "var(--ink-3)" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `$${Number(v) / 1000}k`}
                    width={36}
                  />
                  <Tooltip
                    formatter={(v: unknown) => [usd(Number(v)), "Total"]}
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid var(--border)" }}
                  />
                  <Area type="monotone" dataKey="total" stroke="var(--clear-dk)" strokeWidth={2} fill="url(#plannerFill)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="fety-planner-chart-empty">Run a scenario to see balance over time.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
