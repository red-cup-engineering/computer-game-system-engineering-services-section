import test from "node:test";
import assert from "node:assert/strict";
import {
  admit,
  createPerceptionFrameType,
  PerceptionClockType,
  specializePerceptionClockType,
} from "../src/index.mjs";

const BASE_CLOCK = {
  time: 1,
  phase: "day",
  season: "summer",
  tide: "high",
  weather: "clear",
  dryStreak: 0,
};

const FRAME_BASE = {
  tick: 1,
  actor: "actor:1",
  place: { id: "room:1", name: "A Room", description: "It is a room.", exits: ["north"] },
  occupants: [{ id: "actor:2", name: "Someone" }],
  subjects: [{ id: "actor:1", cells: [{ predicate: "kind", object: "actor", evidence: "true" }], affordances: ["look"] }],
  recentEvents: [{ tick: 1, channel: "chat", text: "hi" }],
};

test("the base clock type admits its own six fields and refuses a missing one", () => {
  assert.equal(admit(PerceptionClockType, BASE_CLOCK).ok, true);
  const { dryStreak, ...missing } = BASE_CLOCK;
  assert.equal(admit(PerceptionClockType, missing).ok, false);
});

test("specializing the clock type adds fields additively, not replacing the base requirement", () => {
  const climateClock = specializePerceptionClockType(
    "test.climate-clock@1",
    "Test climate clock",
    "A clock with extra climate fields.",
    {
      required: ["harborClosed"],
      properties: { harborClosed: { type: "boolean" } },
    },
  );
  assert.equal(admit(climateClock, { ...BASE_CLOCK, harborClosed: false }).ok, true);
  // the base six are still required through the parent intersection
  assert.equal(admit(climateClock, { harborClosed: false }).ok, false);
  // the local extra field is still required
  assert.equal(admit(climateClock, BASE_CLOCK).ok, false);
});

test("a frame type built from a plain clock type admits a well-shaped frame and refuses a malformed one", () => {
  const frameType = createPerceptionFrameType("test.game", PerceptionClockType);
  const good = { kind: "test.game", ...FRAME_BASE, clock: BASE_CLOCK };
  assert.equal(admit(frameType, good).ok, true);

  assert.equal(admit(frameType, { ...good, kind: "wrong.kind" }).ok, false);
  assert.equal(admit(frameType, { ...good, place: { id: "room:1" } }).ok, false);
  assert.equal(admit(frameType, { ...good, extra: true }).ok, false);
});

test("a frame type built from a specialized clock type requires the specialized clock's own extra fields", () => {
  const climateClock = specializePerceptionClockType(
    "test.game2.clock@1",
    "Test game 2 clock",
    "A clock with extra climate fields.",
    { required: ["fireDanger"], properties: { fireDanger: { type: "string" } } },
  );
  const frameType = createPerceptionFrameType("test.game2", climateClock);
  const withClimate = { kind: "test.game2", ...FRAME_BASE, clock: { ...BASE_CLOCK, fireDanger: "low" } };
  assert.equal(admit(frameType, withClimate).ok, true);
  const withoutClimate = { kind: "test.game2", ...FRAME_BASE, clock: BASE_CLOCK };
  assert.equal(admit(frameType, withoutClimate).ok, false);
});

test("a null place and an empty subjects/occupants/recentEvents set are all valid", () => {
  const frameType = createPerceptionFrameType("test.game3", PerceptionClockType);
  const frame = { kind: "test.game3", tick: 1, actor: "a", place: null, occupants: [], subjects: [], clock: BASE_CLOCK, recentEvents: [] };
  assert.equal(admit(frameType, frame).ok, true);
});
