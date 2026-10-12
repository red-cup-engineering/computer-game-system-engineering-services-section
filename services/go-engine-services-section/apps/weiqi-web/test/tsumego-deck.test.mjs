// The tsumego trainer's deck/queue selection logic (task item 1), driven
// directly as pure functions -- no DOM, no localStorage. See
// public/js/tsumego-deck.mjs's own header for why this is separate from
// tsumego-app.mjs.

import { test } from "node:test";
import assert from "node:assert/strict";
import { epochDay, isDue, filterProblems, buildQueue } from "../public/js/tsumego-deck.mjs";
import { reviewCard, daysUntilRetention, DEFAULT_TARGET_RETENTION } from "@red-cup-engineering/education-platform-service/srs";

const PROBLEMS = [
  { id: "a", category: "capture-go-basics", band: "introductory" },
  { id: "b", category: "capture-go-basics", band: "developing" },
  { id: "c", category: "ladders-and-nets", band: "developing" },
  { id: "d", category: "life-and-death-fundamentals", band: "challenging" },
];

test("epochDay is a whole-number day count that increases with real time", () => {
  const t0 = epochDay(new Date("2026-01-01T00:00:00Z"));
  const t1 = epochDay(new Date("2026-01-02T00:00:00Z"));
  assert.equal(Number.isInteger(t0), true);
  assert.equal(t1 - t0, 1);
});

test("a never-reviewed card (no state at all) is always due", () => {
  assert.equal(isDue(undefined, 12345), true);
});

test("a freshly-reviewed card is not due the same day", () => {
  const state = reviewCard({ stability: 0, difficulty: 0 }, 3, 100); // grade 3 = Good, seeds real S0/D0
  assert.equal(isDue(state, 100), false);
});

test("a card becomes due once its target-retention horizon passes", () => {
  const state = reviewCard({ stability: 0, difficulty: 0 }, 3, 100);
  const horizon = daysUntilRetention(state.stability, DEFAULT_TARGET_RETENTION);
  assert.equal(isDue(state, 100 + Math.floor(horizon) - 1), false, "a day before the horizon: not yet due");
  assert.equal(isDue(state, 100 + Math.ceil(horizon)), true, "at/after the horizon: due");
});

test("filterProblems: 'all'/'all' returns everything unchanged", () => {
  assert.deepEqual(filterProblems(PROBLEMS, { category: "all", band: "all" }), PROBLEMS);
});

test("filterProblems: filters by category and by band independently and together", () => {
  assert.deepEqual(
    filterProblems(PROBLEMS, { category: "capture-go-basics", band: "all" }).map((p) => p.id),
    ["a", "b"],
  );
  assert.deepEqual(
    filterProblems(PROBLEMS, { category: "all", band: "developing" }).map((p) => p.id),
    ["b", "c"],
  );
  assert.deepEqual(
    filterProblems(PROBLEMS, { category: "capture-go-basics", band: "developing" }).map((p) => p.id),
    ["b"],
  );
});

test("buildQueue with dueOnly=false just returns the filtered set, regardless of SRS state", () => {
  const states = { a: reviewCard({ stability: 0, difficulty: 0 }, 3, 100) }; // reviewed today, not due
  const queue = buildQueue(PROBLEMS, states, { dueOnly: false, today: 100 });
  assert.deepEqual(queue.map((p) => p.id), ["a", "b", "c", "d"]);
});

test("buildQueue with dueOnly=true excludes a just-reviewed, not-yet-due card", () => {
  const states = { a: reviewCard({ stability: 0, difficulty: 0 }, 3, 100) };
  const queue = buildQueue(PROBLEMS, states, { dueOnly: true, today: 100 });
  const ids = queue.map((p) => p.id);
  assert.ok(!ids.includes("a"), "just-reviewed card should not appear in a due-only queue the same day");
  assert.ok(ids.includes("b") && ids.includes("c") && ids.includes("d"), "never-reviewed cards are always due");
});

test("buildQueue accepts SRS states as either a Map or a plain object, identically", () => {
  const reviewed = reviewCard({ stability: 0, difficulty: 0 }, 3, 100);
  const asObject = { a: reviewed };
  const asMap = new Map([["a", reviewed]]);
  const q1 = buildQueue(PROBLEMS, asObject, { dueOnly: true, today: 100 }).map((p) => p.id);
  const q2 = buildQueue(PROBLEMS, asMap, { dueOnly: true, today: 100 }).map((p) => p.id);
  assert.deepEqual(q1, q2);
});

test("buildQueue orders a due-only queue with new (never-reviewed) cards first, then most-overdue first", () => {
  // b: reviewed long ago with a short stability -- very overdue.
  // c: reviewed recently with a short stability -- just barely due.
  // d: never reviewed -- always sorts first, alongside any other new card.
  const bState = reviewCard({ stability: 0, difficulty: 0 }, 1, 0); // Again -> short stability
  const cState = reviewCard({ stability: 0, difficulty: 0 }, 1, 90); // Again -> short stability, reviewed near "today"
  const today = 100;
  const states = { b: bState, c: cState };
  const queue = buildQueue(PROBLEMS, states, { category: "all", band: "all", dueOnly: true, today });
  const ids = queue.map((p) => p.id);
  // New cards (a, d) must both precede the reviewed-and-due ones (b, c).
  assert.ok(ids.indexOf("a") < ids.indexOf("b"));
  assert.ok(ids.indexOf("d") < ids.indexOf("c"));
  // Between the two reviewed cards, b (reviewed longest ago) is more overdue than c.
  assert.ok(ids.indexOf("b") < ids.indexOf("c"), `expected b (more overdue) before c, got order ${ids.join(",")}`);
});

test("buildQueue combines category/band filtering with due-only selection", () => {
  const states = {};
  const queue = buildQueue(PROBLEMS, states, { category: "capture-go-basics", band: "all", dueOnly: true, today: 100 });
  assert.deepEqual(queue.map((p) => p.id).sort(), ["a", "b"]);
});
