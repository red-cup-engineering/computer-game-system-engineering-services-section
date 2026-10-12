import test, { mock } from "node:test";
import assert from "node:assert/strict";

// buildPerceptionFrame's own assembly+admit logic is under test here, not feltos itself — so the
// underlying feltos/world readers are mocked to a small, fully-controlled fixture. Real end-to-end
// coverage against a live feltos world lives in each game's own room/perception tests.
mock.module("@red-cup-engineering/feltos/world", {
  // @types/node here predates the runtime's `exports` option name; `namedExports` is the same
  // mechanism under the type declarations' own name and still functions (deprecation warning only).
  namedExports: {
    value: (world, subject, predicate) => (world)[subject]?.[predicate] ?? null,
    settleSubject: (world, subject) => (world)[`${subject}:cells`] ?? [],
    perceive: (world, actor) => (world)[`${actor}:view`],
    contentsOf: (world, place) => (world)[`${place}:contents`] ?? [],
    evidenceName: (cell) =>
      cell.evidence.positiveEvidence && cell.evidence.negativeEvidence ? "both" : cell.evidence.positiveEvidence ? "true" : cell.evidence.negativeEvidence ? "false" : "neither",
  },
});

const { admit, createPerceptionFrameType, PerceptionClockType, buildPerceptionFrame, perceptionSnapEntry } = await import("../src/index.mjs");

const CLOCK = { time: 1, phase: "day", season: "summer", tide: "high", weather: "clear", dryStreak: 0 };
const FRAME_TYPE = createPerceptionFrameType("test.builder.game", PerceptionClockType);

const WORLD = {
  "room:1": { name: "A Room", description: "It is a room." },
  "room:1:cells": [{ predicate: "exit:north", object: true, evidence: { positiveEvidence: true, negativeEvidence: false } }],
  "room:1:contents": ["actor:2"],
  "actor:2": { name: "Someone" },
  "actor:1:view": { place: "room:1", subjects: ["actor:1"] },
  "actor:1:cells": [{ predicate: "kind", object: "actor", evidence: { positiveEvidence: true, negativeEvidence: false } }],
};

test("buildPerceptionFrame assembles a well-shaped, admitted frame from a mocked world", () => {
  const frame = buildPerceptionFrame({
    frameType: FRAME_TYPE,
    kind: "test.builder.game",
    world: WORLD,
    actor: "actor:1",
    tick: 5,
    clock: CLOCK,
    affordancesFor: () => ["look"],
  });
  assert.equal(frame.kind, "test.builder.game");
  assert.deepEqual(frame.place, { id: "room:1", name: "A Room", description: "It is a room.", exits: ["north"] });
  assert.deepEqual(frame.occupants, [{ id: "actor:2", name: "Someone" }]);
  assert.equal(frame.subjects.length, 1);
  assert.deepEqual(frame.subjects[0].cells, [{ predicate: "kind", object: "actor", evidence: "true" }]);
  assert.deepEqual(frame.subjects[0].affordances, ["look"]);
  assert.equal(admit(FRAME_TYPE, frame).ok, true);
});

test("buildPerceptionFrame throws when the assembled frame does not admit against frameType", () => {
  assert.throws(() => buildPerceptionFrame({
    frameType: FRAME_TYPE,
    kind: "wrong.kind", // frameType's kind is a const — this can never admit
    world: WORLD,
    actor: "actor:1",
    tick: 5,
    clock: CLOCK,
    affordancesFor: () => [],
  }), /perception frame shape refused/);
});

test("perceptionSnapEntry rides the actor id alongside the built frame", () => {
  const entry = perceptionSnapEntry({
    frameType: FRAME_TYPE,
    kind: "test.builder.game",
    world: WORLD,
    actor: "actor:1",
    tick: 5,
    clock: CLOCK,
    affordancesFor: () => [],
  });
  assert.equal(entry.id, "actor:1");
  assert.equal(entry.actor, "actor:1");
});
