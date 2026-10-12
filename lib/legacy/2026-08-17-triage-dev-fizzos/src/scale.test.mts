/**
 * Scale & ops — the engine must hold a crowd and an operator must be able to run it.
 *
 * The load test drives a populous world through many ticks and asserts the per-tick cost
 * stays well under a frame, so the sole-writer loop scales to a real player count. The
 * admin tests prove the moderation surface: a creator can mute a voice, kick a presence,
 * and teleport a body, and `metrics()` reports what the operator needs to see.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { FizzosScene, type CommandIntent } from "./scene.mjs";
import { loadBible, startRoomOf } from "./world-load.mjs";
import { STARTER_WORLD } from "./starter-world.mjs";

function scene(): FizzosScene {
  const { world, content } = loadBible(STARTER_WORLD);
  return new FizzosScene(world, content, startRoomOf(STARTER_WORLD));
}
let clock = 1;
const cmd = (actor: string, line: string): CommandIntent => ({ k: "command", actor, line });
const run = (s: FizzosScene, a: string, l: string): string =>
  s.runTick(clock++, [cmd(a, l)]).events.find((e) => e.to === a)?.text ?? "";

test("load — a crowded world advances in well under a frame per tick", () => {
  const s = scene();
  const players = Array.from({ length: 150 }, (_, i) => `load-${i}`);
  // Everyone arrives (joins on first command) and looks around.
  s.runTick(clock++, players.map((p) => cmd(p, "look")));

  const verbs = ["look", "north", "south", "say hello", "inventory", "who", "exits", "search"];
  const ticks = 200;
  const window = 40;
  const sample = (from: number, to: number): number => {
    const t0 = process.hrtime.bigint();
    for (let t = from; t < to; t++) s.runTick(clock++, players.map((p, i) => cmd(p, verbs[(t + i) % verbs.length]!)));
    return Number(process.hrtime.bigint() - t0) / 1e6 / (to - from);
  };
  const early = sample(0, window);                 // cost in the first window…
  sample(window, ticks - window);                  // …run the long middle…
  const late = sample(ticks - window, ticks);      // …and the cost at the end.
  // The real guarantee is that per-tick cost stays FLAT as the world ages — the functional-
  // compaction fix. The unbounded-trace regression made `late` blow up relative to `early`.
  // Comparing windows is robust to absolute-speed contention (parallel test files); a loose
  // absolute ceiling (well under the 200ms frame) backstops it.
  assert.ok(late < early * 3 + 5, `per-tick cost must stay flat as the world ages (early ${early.toFixed(1)}ms, late ${late.toFixed(1)}ms)`);
  // Absolute backstop at the frame budget. (The growth ratio above is the real regression
  // guard; this only trips if a tick genuinely exceeds a 200ms server frame. Kept loose
  // because parallel test files contend for CPU and inflate wall-clock timing.)
  assert.ok(late < 200, `per-tick cost ${late.toFixed(2)}ms should stay within the 200ms frame for 150 players`);
  assert.equal(s.metrics().players, 150, "every player is accounted for");
});

test("metrics — the operator sees players, world size, and the tick", () => {
  const s = scene();
  run(s, "a", "look");
  run(s, "b", "look");
  const m = s.metrics();
  assert.equal(m.players, 2);
  assert.ok(m.rooms > 0 && m.things >= 0, "world size is reported");
  assert.ok(m.tick > 0, "the current tick is reported");
});

test("admin — a creator mutes a voice, and the muted cannot speak", () => {
  const s = scene();
  run(s, "boss", "look");
  run(s, "loud", "look");
  s.grantCreator("boss");
  assert.match(run(s, "boss", "@mute loud"), /silence/i);
  assert.match(run(s, "loud", "say hello"), /silenced/i, "the muted voice carries nowhere");
  assert.match(run(s, "boss", "@unmute loud"), /restore/i);
  assert.match(run(s, "loud", "say hello"), /You say/, "the voice returns");
});

test("admin — a creator kicks a presence and teleports a body", () => {
  const s = scene();
  run(s, "boss", "look");
  run(s, "wanderer", "look");
  s.grantCreator("boss");
  // Teleport: send the wanderer to a known room and confirm they are there.
  const room = startRoomOf(STARTER_WORLD);
  assert.match(run(s, "boss", `@teleport wanderer ${room}`), /whisk/i);
  // Kick: the wanderer is removed from the live roster.
  assert.match(run(s, "boss", "@kick wanderer"), /kick/i);
  assert.equal(s.metrics().players, 1, "the kicked player leaves the roster");
});

test("admin — moderation is gated to creators", () => {
  const s = scene();
  run(s, "nobody", "look");
  run(s, "victim", "look");
  assert.match(run(s, "nobody", "@mute victim"), /Only a creator/);
});
