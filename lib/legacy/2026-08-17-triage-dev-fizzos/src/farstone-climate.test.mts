/**
 * The climate, woven into the world. These are the Tynan-Sylvester invariants: the one weather/
 * season spine is not a decoration — it closes the harbor, shuts the clam bed, and moves the
 * fish price. Each test names a coupling and asserts the world settles the consequence.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { type Bible, loadBible } from "./world-load.mjs";
import { FizzosScene, type CommandIntent } from "./scene.mjs";
import { numberOf, tell, valueOf } from "./world.mjs";
import { PHASE_LEN, SEASON_LEN } from "./world-clock.mjs";

const HARBOR: Bible = {
  rooms: [
    { id: "quay", name: "The Quay", description: "Granite and tar.", exits: { sea: "grounds", to: "marsh" }, tags: ["place", "harbor", "outdoor", "dock"] },
    { id: "grounds", name: "The Fishing Grounds", description: "Open water.", exits: { in: "quay" }, tags: ["place", "ocean", "fishing"] },
    { id: "marsh", name: "The Salt Marsh", description: "Spartina and tidal mud.", exits: { from: "quay" }, tags: ["place", "marsh", "outdoor", "shellfish"] },
  ],
  npcs: [
    { id: "greer", name: "Greer Tenn", description: "A fishwife.", location: "quay", tags: ["npc", "shopkeeper"] },
    { id: "the-ferry", name: "the ferry", description: "The morning boat.", location: "quay", tags: ["ferry", "fixed"] },
  ],
};

const scene = (seed: number, cells: { e: string; a: string; v: string }[]) => {
  const { world, content } = loadBible(HARBOR);
  return new FizzosScene(tell(world, [{ e: "the-world", a: "world-seed", v: String(seed) }, ...cells]), content, "quay");
};

test("WEAVE storm→harbor: a storm closes the harbor and cancels the ferry; clearing reopens it", () => {
  // world-time 5 is mid-phase, so advancing one tick does not roll the weather we set.
  const s = scene(1, [{ e: "the-world", a: "world-time", v: "5" }, { e: "the-world", a: "weather", v: "storm" }]);
  s.runTick(1, []);
  assert.equal(valueOf(s.currentWorld(), "the-world", "harbor-closed"), "true", "the storm shut the harbor");
  assert.equal(valueOf(s.currentWorld(), "the-ferry", "sailing"), "cancelled", "the cascade cancelled the ferry");
  // Clearing reopens it — the coupling is reversible, settled both ways. A world that was closed
  // under storm, now calm, reopens on the next tick.
  const calm = scene(1, [{ e: "the-world", a: "world-time", v: "5" }, { e: "the-world", a: "weather", v: "clear" }, { e: "the-world", a: "harbor-closed", v: "true" }]);
  calm.runTick(1, []);
  assert.equal(valueOf(calm.currentWorld(), "the-world", "harbor-closed"), "false", "calm reopens the harbor");
  assert.equal(valueOf(calm.currentWorld(), "the-ferry", "sailing"), "scheduled");
});

test("WEAVE season→economy: the off-season turn runs the fish price up", () => {
  // Land exactly on the autumn turn (SEASON_LEN*2): the off-season re-prices fish upward.
  const s = scene(1, [
    { e: "the-world", a: "world-time", v: String(SEASON_LEN * 2 - 1) },
    { e: "greer", a: "price:fish", v: "2" },
    { e: "greer", a: "stock:fish", v: "6" },
  ]);
  s.runTick(1, []);
  assert.ok(Number(valueOf(s.currentWorld(), "greer", "price:fish")) > 2.4, "autumn scarcity lifts the fish price above its summer base");
  assert.ok(numberOf(s.currentWorld(), "greer", "stock:fish", 6) < 6, "and draws the stock down");
});

test("WEAVE climate→clam bed: a wet summer closes the shellfish bed", () => {
  // Summer (in [SEASON_LEN, 2·SEASON_LEN)), with rainfall already banked; cross one phase boundary.
  const s = scene(1, [
    { e: "the-world", a: "world-time", v: String(SEASON_LEN + PHASE_LEN - 1) },
    { e: "the-world", a: "recent-rainfall", v: "10" },
  ]);
  s.runTick(1, []);
  assert.equal(valueOf(s.currentWorld(), "the-world", "shellfish-closed"), "true", "warm, freshened water shuts the clam bed");
  assert.equal(valueOf(s.currentWorld(), "marsh", "shellfish-closed"), "true", "the closure settles on the marsh itself");
});

test("almanac reads the whole spine back to the player", () => {
  const s = scene(1, [{ e: "the-world", a: "world-time", v: "5" }, { e: "the-world", a: "weather", v: "fog" }]);
  const { events } = s.runTick(1, [{ k: "command", actor: "skipper", line: "almanac" } satisfies CommandIntent]);
  const text = events.filter((e) => e.k === "message" && e.to === "skipper").map((e) => (e as { text: string }).text).join("\n");
  assert.match(text, /Almanac of Farstone/, "the almanac verb is wired and reports the climate");
  assert.match(text, /spring/, "and names the season");
});
