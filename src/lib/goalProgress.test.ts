import assert from "node:assert/strict";
import { goalPaceStatus } from "./goalProgress";

const asOf = new Date(2026, 9, 26);

assert.equal(
  goalPaceStatus(3250, 5000, "Dec 2026", 250, asOf),
  "on_track",
  "Emergency fund",
);
assert.equal(
  goalPaceStatus(1200, 2500, "Jun 2026", 200, asOf),
  "on_track",
  "Vacation (past target)",
);
assert.equal(
  goalPaceStatus(6750, 10000, "Mar 2027", 400, asOf),
  "on_track",
  "Debt payoff",
);
assert.equal(
  goalPaceStatus(4000, 20000, "Jan 2028", 500, asOf),
  "behind",
  "New car",
);

console.log("goalProgress.test.ts ok");
