import assert from "node:assert/strict";
import { test } from "node:test";
import { createWorldRuntime } from "../src/world-runtime.mjs";

/**
 * Spy standing in for MudServer's `tick()`/`engine()` — the only two methods world-runtime.mjs
 * itself calls. Cheap enough to unit-test catch-up/flush timing logic in complete isolation
 * from a real feltos engine.
 * @returns {{tickCalls: number[], tick: () => {receipt: number}, engine: () => {tick: number}}}
 */
function fakeMud() {
  const tickCalls = [];
  let engineState = { tick: 0 };
  return {
    tickCalls,
    tick: () => { engineState = { tick: engineState.tick + 1 }; tickCalls.push(engineState.tick); return { receipt: engineState.tick }; },
    engine: () => engineState,
  };
}

function fakeStore() {
  const saves = [];
  return { saves, save: async (engine) => { saves.push(structuredClone(engine)); } };
}

function fakeClockStore() {
  const saves = [];
  return { saves, save: async (state) => { saves.push({ ...state }); } };
}

function fakeClock(startAt) {
  let t = startAt;
  return { now: () => t, advance: (ms) => { t += ms; } };
}

test("no time elapsed: preRequestCatchUp right after boot catches up 0 ticks and does not flush", async () => {
  const mud = fakeMud();
  const store = fakeStore();
  const clockStore = fakeClockStore();
  const clock = fakeClock(1_000_000);
  const rt = createWorldRuntime(mud, {
    tickIntervalMs: 1000,
    maxCatchUpTicksPerRequest: 30,
    now: clock.now,
    lastTickAt: 1_000_000,
    store,
    clockStore,
  });
  const info = await rt.preRequestCatchUp();
  assert.deepEqual(info, { ticksOwed: 0, ticksRun: 0, ticksRemaining: 0 });
  assert.equal(mud.tickCalls.length, 0);
  assert.equal(store.saves.length, 0);
  assert.equal(clockStore.saves.length, 0);
});

test("elapsed real time is caught up exactly, in whole tick units, on the next preRequestCatchUp", async () => {
  const mud = fakeMud();
  const store = fakeStore();
  const clockStore = fakeClockStore();
  const clock = fakeClock(1_000_000);
  const rt = createWorldRuntime(mud, {
    tickIntervalMs: 1000,
    maxCatchUpTicksPerRequest: 30,
    now: clock.now,
    lastTickAt: 1_000_000,
    store,
    clockStore,
  });
  clock.advance(5_400); // 5.4 real ticks owed
  const info = await rt.preRequestCatchUp();
  assert.equal(info.ticksRun, 5, "only whole ticks run — the 0.4 remainder is left owed, not rounded up");
  assert.equal(info.ticksRemaining, 0);
  assert.equal(mud.tickCalls.length, 5);
  assert.equal(store.saves.length, 1, "one flush for the whole catch-up batch, not one per tick");
  assert.equal(clockStore.saves[0]?.lastTickAt, 1_005_000, "the persisted clock advances by exactly 5 whole tick-intervals, not to now()");
});

test("catch-up is capped per request; the remainder carries over and is finished by later calls", async () => {
  const mud = fakeMud();
  const store = fakeStore();
  const clockStore = fakeClockStore();
  const clock = fakeClock(0);
  const rt = createWorldRuntime(mud, {
    tickIntervalMs: 1000,
    maxCatchUpTicksPerRequest: 10,
    now: clock.now,
    lastTickAt: 0,
    store,
    clockStore,
  });
  clock.advance(25_000); // 25 ticks owed
  const first = await rt.preRequestCatchUp();
  assert.equal(first.ticksRun, 10, "capped at maxCatchUpTicksPerRequest");
  assert.equal(first.ticksRemaining, 15, "15 ticks still owed after the cap");

  const second = await rt.preRequestCatchUp();
  assert.equal(second.ticksRun, 10);
  assert.equal(second.ticksRemaining, 5);

  const third = await rt.preRequestCatchUp();
  assert.equal(third.ticksRun, 5);
  assert.equal(third.ticksRemaining, 0, "fully caught up after three calls");
  assert.equal(mud.tickCalls.length, 25);
  assert.equal(store.saves.length, 3, "one flush per call that actually ran ticks");
});

test("no single request stalls: the cap bounds ticks run regardless of how much real idle time elapsed", async () => {
  const mud = fakeMud();
  const store = fakeStore();
  const clockStore = fakeClockStore();
  const clock = fakeClock(0);
  const rt = createWorldRuntime(mud, {
    tickIntervalMs: 1000,
    maxCatchUpTicksPerRequest: 30,
    now: clock.now,
    lastTickAt: 0,
    store,
    clockStore,
  });
  clock.advance(1000 * 60 * 60 * 24 * 30); // a full 30 idle days, e.g. after a long scale-to-zero
  const info = await rt.preRequestCatchUp();
  assert.equal(info.ticksRun, 30, "still capped, even after a month idle");
});

test("postRequestFlush(0) flushes without advancing the clock or running a tick — the connect() case", async () => {
  const mud = fakeMud();
  const store = fakeStore();
  const clockStore = fakeClockStore();
  const rt = createWorldRuntime(mud, { tickIntervalMs: 1000, maxCatchUpTicksPerRequest: 30, now: () => 0, lastTickAt: 500, store, clockStore });
  await rt.postRequestFlush();
  assert.equal(mud.tickCalls.length, 0);
  assert.equal(store.saves.length, 1);
  assert.equal(clockStore.saves[0]?.lastTickAt, 500, "lastTickAt is untouched — connect doesn't represent elapsed world-time");
});

test("postRequestFlush(tickIntervalMs) advances the clock by exactly one interval — the explicit /tick case", async () => {
  const mud = fakeMud();
  const store = fakeStore();
  const clockStore = fakeClockStore();
  const rt = createWorldRuntime(mud, { tickIntervalMs: 1000, maxCatchUpTicksPerRequest: 30, now: () => 0, lastTickAt: 500, store, clockStore });
  await rt.postRequestFlush(1000);
  assert.equal(clockStore.saves[0]?.lastTickAt, 1500);
  assert.equal(store.saves.length, 1);
});

test("clock is written before the engine on every flush — the documented fail-safe ordering", async () => {
  const mud = fakeMud();
  const order = [];
  const store = { save: async () => { order.push("engine"); } };
  const clockStore = { save: async () => { order.push("clock"); } };
  const rt = createWorldRuntime(mud, { tickIntervalMs: 1000, maxCatchUpTicksPerRequest: 30, now: () => 0, lastTickAt: 0, store, clockStore });
  await rt.postRequestFlush();
  assert.deepEqual(order, ["clock", "engine"]);
});

test("null store / null clockStore (no backend configured): catch-up still runs, just persists nothing", async () => {
  const mud = fakeMud();
  const clock = fakeClock(0);
  const rt = createWorldRuntime(mud, { tickIntervalMs: 1000, maxCatchUpTicksPerRequest: 30, now: clock.now, lastTickAt: 0, store: null, clockStore: null });
  clock.advance(3000);
  const info = await rt.preRequestCatchUp();
  assert.equal(info.ticksRun, 3, "world time still advances even with nowhere to persist it");
});

test("onFlush reports real measured numbers: ticksRun, a non-negative duration, and a positive engine byte count", async () => {
  const mud = fakeMud();
  const store = fakeStore();
  const clockStore = fakeClockStore();
  const clock = fakeClock(0);
  const flushes = [];
  const rt = createWorldRuntime(mud, {
    tickIntervalMs: 1000,
    maxCatchUpTicksPerRequest: 30,
    now: clock.now,
    lastTickAt: 0,
    store,
    clockStore,
    onFlush: (info) => flushes.push(info),
  });
  clock.advance(4000);
  await rt.preRequestCatchUp();
  assert.equal(flushes.length, 1);
  assert.equal(flushes[0].reason, "tick");
  assert.equal(flushes[0].ticksRun, 4);
  assert.ok(flushes[0].durationMs >= 0);
  assert.ok(flushes[0].engineBytes > 0, "the fake engine state serializes to a nonzero byte count");
});

test("onCatchUp fires on every preRequestCatchUp call, including zero-tick ones", async () => {
  const mud = fakeMud();
  const clock = fakeClock(0);
  const catchUps = [];
  const rt = createWorldRuntime(mud, {
    tickIntervalMs: 1000,
    maxCatchUpTicksPerRequest: 30,
    now: clock.now,
    lastTickAt: 0,
    store: null,
    clockStore: null,
    onCatchUp: (info) => catchUps.push(info),
  });
  await rt.preRequestCatchUp();
  await rt.preRequestCatchUp();
  assert.deepEqual(catchUps, [
    { ticksOwed: 0, ticksRun: 0, ticksRemaining: 0 },
    { ticksOwed: 0, ticksRun: 0, ticksRemaining: 0 },
  ]);
});

test("flushNow() saves current state unconditionally, with no catch-up and no tick bookkeeping change", async () => {
  const mud = fakeMud();
  const store = fakeStore();
  const clockStore = fakeClockStore();
  const rt = createWorldRuntime(mud, { tickIntervalMs: 1000, maxCatchUpTicksPerRequest: 30, now: () => 0, lastTickAt: 0, store, clockStore });
  await rt.flushNow();
  assert.equal(store.saves.length, 1);
  assert.equal(mud.tickCalls.length, 0);
});

test("ticksOwed() is a pure read — calling it repeatedly never runs a tick or flushes", async () => {
  const mud = fakeMud();
  const store = fakeStore();
  const clockStore = fakeClockStore();
  const clock = fakeClock(0);
  const rt = createWorldRuntime(mud, { tickIntervalMs: 1000, maxCatchUpTicksPerRequest: 30, now: clock.now, lastTickAt: 0, store, clockStore });
  clock.advance(3500);
  assert.equal(rt.ticksOwed(), 3);
  assert.equal(rt.ticksOwed(), 3);
  assert.equal(mud.tickCalls.length, 0);
  assert.equal(store.saves.length, 0);
});

test("rejects a non-positive tickIntervalMs and a non-positive-integer cap", () => {
  const mud = fakeMud();
  assert.throws(() => createWorldRuntime(mud, { tickIntervalMs: 0, maxCatchUpTicksPerRequest: 1, lastTickAt: 0, store: null, clockStore: null }));
  assert.throws(() => createWorldRuntime(mud, { tickIntervalMs: 1000, maxCatchUpTicksPerRequest: 0, lastTickAt: 0, store: null, clockStore: null }));
});
