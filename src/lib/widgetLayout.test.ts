import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  insertWidgetOnDashboard,
  orderPinnedBySizeSections,
  packWidgetsIntoRows,
  type WidgetRowItem,
} from "./widgetLayout";

function byId(entries: Record<string, WidgetRowItem["size"]>): Map<string, WidgetRowItem> {
  return new Map(Object.entries(entries).map(([id, size]) => [id, { id, size }]));
}

describe("orderPinnedBySizeSections", () => {
  it("groups chips, cards, then rows", () => {
    const map = byId({ a: "half", b: "small", c: "full", d: "small" });
    const ordered = orderPinnedBySizeSections(["a", "b", "c", "d"], map);
    assert.deepEqual(ordered, ["b", "d", "a", "c"]);
  });
});

describe("insertWidgetOnDashboard", () => {
  it("places a chip beside an existing chip row", () => {
    const map = byId({ s1: "small", s2: "small", h1: "half" });
    const pinned = orderPinnedBySizeSections(["s1", "h1"], map);
    const next = insertWidgetOnDashboard(pinned, "s2", map);
    const rows = packWidgetsIntoRows(next, map);
    const chipRows = rows.filter((row) => map.get(row[0])?.size === "small");
    assert.equal(chipRows.length, 1);
    assert.deepEqual(chipRows[0], ["s1", "s2"]);
  });

  it("places a card beside a half-width card", () => {
    const map = byId({ c1: "half", c2: "half", s1: "small" });
    const pinned = orderPinnedBySizeSections(["s1", "c1"], map);
    const next = insertWidgetOnDashboard(pinned, "c2", map);
    const rows = packWidgetsIntoRows(next, map);
    const cardRow = rows.find((row) => map.get(row[0])?.size === "half");
    assert.deepEqual(cardRow, ["c1", "c2"]);
  });
});
