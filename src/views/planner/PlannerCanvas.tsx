import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { PlannerEdge, PlannerNode, PlannerNodeKind } from "./plannerTypes";
import { PLANNER_NODE_CATALOG, PLANNER_STRATEGY_LABELS, type PlannerStrategyPreset } from "./plannerTypes";

const NODE_W = 200;
const NODE_H = 112;

function nodeMeta(kind: PlannerNodeKind) {
  return PLANNER_NODE_CATALOG.find((c) => c.kind === kind)!;
}

function portPosition(node: PlannerNode, side: "in" | "out") {
  const y = node.y + NODE_H / 2;
  const x = side === "in" ? node.x : node.x + NODE_W;
  return { x, y };
}

function edgePath(from: PlannerNode, to: PlannerNode): string {
  const a = portPosition(from, "out");
  const b = portPosition(to, "in");
  const dx = Math.max(48, (b.x - a.x) * 0.5);
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}

export default function PlannerCanvas({
  nodes,
  edges,
  selectedNodeId,
  linkFromId,
  onSelectNode,
  onMoveNode,
  onStartLink,
  onCompleteLink,
  onUpdateNode,
  onRemoveNode,
}: {
  nodes: PlannerNode[];
  edges: PlannerEdge[];
  selectedNodeId: string | null;
  linkFromId: string | null;
  onSelectNode: (id: string | null) => void;
  onMoveNode: (id: string, x: number, y: number) => void;
  onStartLink: (fromId: string) => void;
  onCompleteLink: (toId: string) => void;
  onUpdateNode: (node: PlannerNode) => void;
  onRemoveNode: (id: string) => void;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; ox: number; oy: number; startX: number; startY: number } | null>(null);

  const onPointerDownNode = useCallback(
    (event: ReactPointerEvent, node: PlannerNode) => {
      if ((event.target as HTMLElement).closest("input, select, button, textarea")) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = {
        id: node.id,
        ox: event.clientX,
        oy: event.clientY,
        startX: node.x,
        startY: node.y,
      };
      onSelectNode(node.id);
    },
    [onSelectNode],
  );

  const onPointerMoveSurface = useCallback(
    (event: ReactPointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      onMoveNode(drag.id, drag.startX + (event.clientX - drag.ox), drag.startY + (event.clientY - drag.oy));
    },
    [onMoveNode],
  );

  const onPointerUpSurface = useCallback((event: ReactPointerEvent) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  }, []);

  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  return (
    <div
      ref={surfaceRef}
      className="fety-planner-canvas"
      onPointerMove={onPointerMoveSurface}
      onPointerUp={onPointerUpSurface}
      onPointerCancel={onPointerUpSurface}
      onClick={() => onSelectNode(null)}
    >
      <svg className="fety-planner-edges" aria-hidden>
        {edges.map((edge) => {
          const from = nodeById.get(edge.fromId);
          const to = nodeById.get(edge.toId);
          if (!from || !to) return null;
          return (
            <path
              key={edge.id}
              d={edgePath(from, to)}
              className="fety-planner-edge"
            />
          );
        })}
      </svg>

      {nodes.map((node) => {
        const meta = nodeMeta(node.kind);
        const selected = selectedNodeId === node.id;
        const linking = linkFromId === node.id;
        const showIn = node.kind !== "anchor";
        const showOut = node.kind !== "outcome";

        return (
          <div
            key={node.id}
            className={`fety-planner-node fety-planner-node--${node.kind}${selected ? " fety-planner-node--selected" : ""}${linking ? " fety-planner-node--linking" : ""}`}
            style={{ left: node.x, top: node.y, width: NODE_W, minHeight: NODE_H }}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => onPointerDownNode(event, node)}
          >
            <header className="fety-planner-node-head">
              <span className="fety-planner-node-icon" aria-hidden>
                {meta.icon}
              </span>
              <span className="fety-planner-node-title">{node.label}</span>
            </header>

            <div className="fety-planner-node-body">
              {node.kind === "anchor" ? (
                <p className="fety-planner-node-muted">Uses your live balances as the starting point.</p>
              ) : null}
              {node.kind === "purchase" ? (
                <>
                  <label className="fety-planner-field">
                    <span>Amount</span>
                    <input
                      type="number"
                      min={0}
                      step={50}
                      value={node.amount}
                      onChange={(e) =>
                        onUpdateNode({ ...node, amount: Number(e.target.value) || 0 })
                      }
                    />
                  </label>
                  <label className="fety-planner-field">
                    <span>Month</span>
                    <input
                      type="number"
                      min={0}
                      max={36}
                      value={node.monthOffset}
                      onChange={(e) =>
                        onUpdateNode({ ...node, monthOffset: Number(e.target.value) || 0 })
                      }
                    />
                  </label>
                </>
              ) : null}
              {node.kind === "investment" ? (
                <>
                  <label className="fety-planner-field">
                    <span>Amount</span>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={node.amount}
                      onChange={(e) =>
                        onUpdateNode({ ...node, amount: Number(e.target.value) || 0 })
                      }
                    />
                  </label>
                  <label className="fety-planner-field">
                    <span>Return %/yr</span>
                    <input
                      type="number"
                      step={0.5}
                      value={node.annualReturnPct}
                      onChange={(e) =>
                        onUpdateNode({ ...node, annualReturnPct: Number(e.target.value) || 0 })
                      }
                    />
                  </label>
                </>
              ) : null}
              {node.kind === "savings" ? (
                <label className="fety-planner-field">
                  <span>$/month</span>
                  <input
                    type="number"
                    min={0}
                    step={25}
                    value={node.amountPerMonth}
                    onChange={(e) =>
                      onUpdateNode({ ...node, amountPerMonth: Number(e.target.value) || 0 })
                    }
                  />
                </label>
              ) : null}
              {node.kind === "strategy" ? (
                <label className="fety-planner-field fety-planner-field--wide">
                  <span>Tip</span>
                  <select
                    value={node.preset}
                    onChange={(e) => {
                      const preset = e.target.value as PlannerStrategyPreset;
                      onUpdateNode({
                        ...node,
                        preset,
                        label: PLANNER_STRATEGY_LABELS[preset],
                      });
                    }}
                  >
                    {Object.entries(PLANNER_STRATEGY_LABELS).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {node.kind === "outcome" ? (
                <p className="fety-planner-node-muted">Connect actions here, then run the scenario.</p>
              ) : null}
            </div>

            {selected && node.kind !== "anchor" ? (
              <button
                type="button"
                className="fety-planner-node-remove"
                onClick={() => onRemoveNode(node.id)}
              >
                Remove
              </button>
            ) : null}

            {showIn ? (
              <button
                type="button"
                className="fety-planner-port fety-planner-port--in"
                aria-label="Connect in"
                title="Connect here"
                onClick={() => {
                  if (linkFromId && linkFromId !== node.id) onCompleteLink(node.id);
                }}
              />
            ) : null}
            {showOut ? (
              <button
                type="button"
                className="fety-planner-port fety-planner-port--out"
                aria-label="Connect out"
                title="Drag connection from here"
                onClick={(event) => {
                  event.stopPropagation();
                  onStartLink(node.id);
                }}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
