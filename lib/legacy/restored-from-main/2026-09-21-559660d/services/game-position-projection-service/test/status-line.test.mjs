import assert from "node:assert/strict";
import test from "node:test";
import { projectGameStatusLine } from "../src/status-line.mjs";

test("projects a supplied play position into one status line", () => {
  assert.equal(projectGameStatusLine({ level: 3, experience: 42, toNext: 8, mode: "ludus", flow: "flow", badges: ["one"] }, 2), "⛬ L3 · 42xp (8→) · ludus/flow · 1🏅 · work 2 open");
});
test("degrades quietly when no play position was acquired", () => {
  assert.equal(projectGameStatusLine(null, 4), "⛬ ops-manifold · work 4 open");
});
