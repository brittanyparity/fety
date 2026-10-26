export interface WidgetRowItem {
  id: string;
  size: "small" | "half" | "full";
}

const MAX_SMALL_PER_ROW = 3;
const MAX_HALF_PER_ROW = 2;

export const WIDGET_SIZE_SECTIONS = [
  { size: "small" as const, label: "Chips", hint: "Small stats — up to 3 per row" },
  { size: "half" as const, label: "Cards", hint: "Half-width widgets — 2 per row" },
  { size: "full" as const, label: "Rows", hint: "Full-width charts and tables" },
] as const;

export function widgetSizeLabel(size: WidgetRowItem["size"]): string {
  return WIDGET_SIZE_SECTIONS.find((s) => s.size === size)?.label ?? size;
}

export function maxWidgetsPerRow(size: WidgetRowItem["size"]): number {
  if (size === "small") return MAX_SMALL_PER_ROW;
  if (size === "half") return MAX_HALF_PER_ROW;
  return 1;
}

/** Keep pinned order grouped: chips, then cards, then rows (stable within each band). */
export function orderPinnedBySizeSections(pinned: string[], byId: Map<string, WidgetRowItem>): string[] {
  const chips: string[] = [];
  const cards: string[] = [];
  const rows: string[] = [];
  const seen = new Set<string>();
  for (const id of pinned) {
    if (seen.has(id)) continue;
    seen.add(id);
    const size = byId.get(id)?.size;
    if (size === "small") chips.push(id);
    else if (size === "half") cards.push(id);
    else if (size === "full") rows.push(id);
  }
  return [...chips, ...cards, ...rows];
}

function insertAfterId(pinned: string[], id: string, afterId: string): string[] {
  const next = pinned.filter((p) => p !== id);
  const idx = next.indexOf(afterId);
  if (idx === -1) return [...next, id];
  next.splice(idx + 1, 0, id);
  return next;
}

/** Pin next to an existing widget of the same size when a row has room. */
export function insertWidgetOnDashboard(
  pinned: string[],
  id: string,
  byId: Map<string, WidgetRowItem>,
): string[] {
  const widget = byId.get(id);
  if (!widget) return orderPinnedBySizeSections([...pinned, id], byId);

  const size = widget.size;
  const sameSize = pinned.filter((pid) => byId.get(pid)?.size === size);
  let next: string[];

  if (sameSize.length === 0) {
    next = [...pinned, id];
  } else {
    const packed = packWidgetsIntoRows(sameSize, byId);
    let anchor: string | null = null;
    for (let i = packed.length - 1; i >= 0; i--) {
      const row = packed[i];
      if (row.length < maxWidgetsPerRow(size)) {
        anchor = row[row.length - 1];
        break;
      }
    }
    if (!anchor) anchor = sameSize[sameSize.length - 1];
    next = insertAfterId(pinned, id, anchor);
  }

  return orderPinnedBySizeSections(next, byId);
}

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

export function toggleWidgetOnDashboard(
  pinned: string[],
  id: string,
  byId?: Map<string, WidgetRowItem>,
): string[] {
  if (pinned.includes(id)) {
    const next = pinned.filter((p) => p !== id);
    return byId ? orderPinnedBySizeSections(next, byId) : next;
  }
  if (byId) return insertWidgetOnDashboard(pinned, id, byId);
  return [...pinned, id];
}

export function isWidgetInFirstRow(rows: string[][], id: string): boolean {
  return (rows[0] ?? []).includes(id);
}

export function isWidgetPositionLocked(lockedIds: string[], id: string): boolean {
  return lockedIds.includes(id);
}

export function toggleWidgetPositionLock(lockedIds: string[], id: string): string[] {
  if (lockedIds.includes(id)) return lockedIds.filter((x) => x !== id);
  return [...lockedIds, id];
}

/** Drop locks for widgets no longer in the top dashboard row. */
export function pruneWidgetLocksToFirstRow(lockedIds: string[], rows: string[][]): string[] {
  const top = new Set(rows[0] ?? []);
  return lockedIds.filter((id) => top.has(id));
}

export function reorderWidgetRespectingLocks(
  pinned: string[],
  lockedIds: string[],
  fromId: string,
  beforeId: string,
): string[] {
  const locked = new Set(lockedIds);
  if (locked.has(fromId)) return pinned;
  const next = reorderWidget(pinned, fromId, beforeId);
  for (const id of locked) {
    if (pinned.indexOf(id) !== next.indexOf(id)) return pinned;
  }
  return next;
}

export function flattenRowsAfterMoveRespectingLocks(
  rows: string[][],
  lockedIds: string[],
  pinned: string[],
  fromIndex: number,
  toIndex: number,
): string[] | null {
  const locked = new Set(lockedIds);
  const lockedIndex = new Map<string, number>();
  for (const id of locked) lockedIndex.set(id, pinned.indexOf(id));
  const nextRows = moveRow(rows, fromIndex, toIndex);
  const nextPinned = flattenRows(nextRows);
  for (const [id, idx] of lockedIndex) {
    if (nextPinned.indexOf(id) !== idx) return null;
  }
  return nextPinned;
}

/** @deprecated use toggleWidgetPositionLock — no longer moves widgets to index 0 */
export function togglePinToTop(pinned: string[], id: string): string[] {
  return pinned;
}

/** @deprecated first pinned id check; use isWidgetPositionLocked with lockedDashboardWidgets */
export function isWidgetPinnedToTop(pinned: string[], id: string): boolean {
  return pinned.length > 0 && pinned[0] === id;
}

export function togglePinWidget(pinned: string[], id: string): string[] {
  return toggleWidgetOnDashboard(pinned, id);
}
