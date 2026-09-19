export interface WidgetRowItem {
  id: string;
  size: "small" | "half" | "full";
}

const MAX_SMALL_PER_ROW = 3;
const MAX_HALF_PER_ROW = 2;

/** Group pinned order into display rows by size rules. */
export function packWidgetsIntoRows(pinned: string[], byId: Map<string, WidgetRowItem>): string[][] {
  const rows: string[][] = [];
  let smallBatch: string[] = [];
  let halfBatch: string[] = [];

  const flushSmall = () => {
    if (smallBatch.length > 0) {
      rows.push(smallBatch);
      smallBatch = [];
    }
  };

  const flushHalf = () => {
    if (halfBatch.length > 0) {
      rows.push(halfBatch);
      halfBatch = [];
    }
  };

  for (const id of pinned) {
    const w = byId.get(id);
    if (!w) continue;
    if (w.size === "small") {
      flushHalf();
      smallBatch.push(id);
      if (smallBatch.length >= MAX_SMALL_PER_ROW) flushSmall();
    } else if (w.size === "half") {
      flushSmall();
      halfBatch.push(id);
      if (halfBatch.length >= MAX_HALF_PER_ROW) flushHalf();
    } else {
      flushSmall();
      flushHalf();
      rows.push([id]);
    }
  }
  flushSmall();
  flushHalf();
  return rows;
}

export function moveRow(rows: string[][], fromIndex: number, toIndex: number): string[][] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= rows.length || toIndex >= rows.length) {
    return rows;
  }
  const next = rows.map((r) => [...r]);
  const [row] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, row);
  return next;
}

export function flattenRows(rows: string[][]): string[] {
  return rows.flat();
}

/** Move one widget before another in pinned order (then repack for display). */
export function reorderWidget(pinned: string[], fromId: string, beforeId: string): string[] {
  if (fromId === beforeId) return pinned;
  const next = pinned.filter((id) => id !== fromId);
  const idx = next.indexOf(beforeId);
  if (idx === -1) return pinned;
  next.splice(idx, 0, fromId);
  return next;
}

export function pinWidgetToTop(pinned: string[], id: string): string[] {
  const rest = pinned.filter((p) => p !== id);
  return [id, ...rest];
}

export function unpinWidget(pinned: string[], id: string): string[] {
  return pinned.filter((p) => p !== id);
}

export function toggleWidgetOnDashboard(pinned: string[], id: string): string[] {
  if (pinned.includes(id)) return pinned.filter((p) => p !== id);
  return [...pinned, id];
}

export function togglePinToTop(pinned: string[], id: string): string[] {
  if (!pinned.includes(id)) return pinned;
  if (pinned[0] === id) {
    const rest = pinned.filter((p) => p !== id);
    return [...rest, id];
  }
  return pinWidgetToTop(pinned, id);
}

export function isWidgetPinnedToTop(pinned: string[], id: string): boolean {
  return pinned.length > 0 && pinned[0] === id;
}

export function togglePinWidget(pinned: string[], id: string): string[] {
  return toggleWidgetOnDashboard(pinned, id);
}
