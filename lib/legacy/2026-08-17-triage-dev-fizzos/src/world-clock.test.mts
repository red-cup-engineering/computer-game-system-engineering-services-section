/**
 * The world's own time: a clock that advances every tick into phases of day, a tide on a
 * slower cycle, and weather that shifts at phase boundaries. NPCs keep their routines by
 * the phase, so the world moves on its own clock — not only when a player acts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_WEATHER, PHASE_LEN, SEASON_LEN, advanceClock, dryStreakOf, phaseOf, seasonAt, seasonOf, tideOf, timeReport, weatherOf, worldTime } from "./world-clock.mjs";
import { tell } from "./world.mjs";
import { world } from "./world.mjs";
import { FizzosScene, type CommandIntent } from "./scene.mjs";
import { loadBible, startRoomOf } from "./world-load.mjs";
import { STARTER_WORLD } from "./starter-world.mjs";

test("the clock advances into phases of day and a slower tide", () => {
  let w = world([]);
  assert.equal(phaseOf(w), "dawn");
  for (let i = 0; i < PHASE_LEN; i++) w = advanceClock(w);
  assert.equal(phaseOf(w), "day", "one phase-length on, it is day");
  assert.equal(worldTime(w), PHASE_LEN);
  for (let i = 0; i < PHASE_LEN * 4; i++) w = advanceClock(w);
  assert.equal(phaseOf(w), "day", "the cycle returns");
  assert.match(timeReport(w), /tide runs (high|low)/);
});

test("the season is a pure ν-cycle of the clock — spring, then turning at the season length", () => {
  let w = world([]);
  assert.equal(seasonOf(w), "spring", "the year opens in spring");
  assert.equal(seasonAt(SEASON_LEN), "summer");
  assert.equal(seasonAt(SEASON_LEN * 2), "autumn");
  assert.equal(seasonAt(SEASON_LEN * 3), "winter");
  assert.equal(seasonAt(SEASON_LEN * 4), "spring", "the year returns — a cycle with no last step");
  void w;
});

test("INVARIANT replay-is-exact: weather is a seeded function of the log, never Math.random", () => {
  // Two worlds with the same seed advance to byte-identical skies — the DESIGN's exact replay.
  const run = () => {
    let w = tell(world([]), [{ e: "the-world", a: "world-seed", v: "1337" }]);
    const skies: string[] = [];
    for (let i = 0; i < PHASE_LEN * 8; i++) {
      w = advanceClock(w, DEFAULT_WEATHER);
      skies.push(weatherOf(w));
    }
    return skies.join(",");
  };
  assert.equal(run(), run(), "same seed + same log ⇒ same weather, every replay");
  // A different seed gives a different (still valid) sky-sequence — nondeterministic to a player.
  let a = tell(world([]), [{ e: "the-world", a: "world-seed", v: "1" }]);
  let b = tell(world([]), [{ e: "the-world", a: "world-seed", v: "2" }]);
  const seqA: string[] = [], seqB: string[] = [];
  for (let i = 0; i < PHASE_LEN * 12; i++) { a = advanceClock(a, DEFAULT_WEATHER); b = advanceClock(b, DEFAULT_WEATHER); seqA.push(weatherOf(a)); seqB.push(weatherOf(b)); }
  assert.notDeepEqual(seqA, seqB, "different seeds diverge — chance is real, not absent");
  for (const wx of [...seqA, ...seqB]) assert.ok(["clear", "cloudy", "rain", "storm", "fog"].includes(wx), "every sky is one of the five canonical states");
});

test("dry-streak grows on dry phases and resets on rain or storm (fire-watch couples to it)", () => {
  // Drive many phases; whenever it rains or storms the streak must be 0 right after.
  let w = tell(world([]), [{ e: "the-world", a: "world-seed", v: "7" }]);
  for (let i = 0; i < PHASE_LEN * 40; i++) {
    const before = weatherOf(w);
    w = advanceClock(w, DEFAULT_WEATHER);
    if (weatherOf(w) !== before && (weatherOf(w) === "rain" || weatherOf(w) === "storm")) {
      assert.equal(dryStreakOf(w), 0, "wet weather wipes the dry streak");
    }
  }
  assert.ok(dryStreakOf(w) >= 0);
});

test("NPCs keep their routines by the phase — the world moves on its own clock", () => {
  const { world: w, content } = loadBible(STARTER_WORLD);
  const scene = new FizzosScene(w, content, startRoomOf(STARTER_WORLD));
  scene.runTick(1, [{ k: "command", actor: "watcher", line: "look" } satisfies CommandIntent]); // a player present to drive ticks
  const start = scene.snapOf("a-muttering-drunk")?.locatedIn;
  let moved = false;
  for (let i = 0; i < PHASE_LEN * 4 + 2; i++) {
    const before = scene.snapOf("a-muttering-drunk")?.locatedIn;
    scene.runTick(100 + i, []);
    if (scene.snapOf("a-muttering-drunk")?.locatedIn !== before) moved = true;
  }
  assert.ok(moved, "the drunk follows its day/night routine without any player command");
  assert.ok(typeof start === "string");
});
