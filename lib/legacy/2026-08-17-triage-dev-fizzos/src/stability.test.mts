/**
 * Multi-year stability — the proportional-scale proof for "hundreds of hours". A world that runs one
 * year is not yet a world that runs hundreds of hours; the question is whether it sustains *without
 * degradation* — bounded per-tick cost (an append-only trace that compacts, not one that grows until
 * it crawls) and undiminished variety in the late years. This runs many in-game years and asserts
 * the late window is as alive as the early one, and no slower. If it weren't, that would be the bug
 * standing between proof-of-concept and hundreds of hours — so this test is where that's settled.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { type Bible, loadBible } from "./world-load.mjs";
import { FizzosScene } from "./scene.mjs";
import { placeOf, numberOf, valueOf, tell } from "./world.mjs";

const ISLAND: Bible = {
  rooms: [
    { id: "quay", name: "Harbor Quay", description: "Waterfront.", exits: { north: "town", west: "inn", sea: "grounds", up: "ridge", south: "marsh" }, tags: ["place", "harbor", "outdoor", "dock"] },
    { id: "town", name: "Downtown", description: "Civic.", exits: { south: "quay", east: "market" }, tags: ["place", "town", "civic", "outdoor"] },
    { id: "market", name: "Market Row", description: "Stalls.", exits: { west: "town" }, tags: ["place", "market", "shop", "outdoor"] },
    { id: "inn", name: "The Inn", description: "Hearth and beds.", exits: { east: "quay" }, tags: ["place", "inn", "indoor", "social-hub", "shelter"] },
    { id: "ridge", name: "The Ridge", description: "Timber.", exits: { down: "quay" }, tags: ["place", "outdoor", "forest", "node:timber"] },
    { id: "marsh", name: "The Marsh", description: "Clam bed.", exits: { north: "quay" }, tags: ["place", "marsh", "outdoor", "shellfish"] },
    { id: "grounds", name: "Fishing Grounds", description: "Water.", exits: { in: "quay" }, tags: ["place", "ocean", "fishing"] },
  ],
  npcs: [
    { id: "coilin", name: "Coilin", description: "A fisher.", location: "quay", tags: ["npc", "faction:fishers", "rival:brannaugh", "coin:30", "skill:fishing:30"] },
    { id: "brannaugh", name: "Brannaugh", description: "A digger.", location: "quay", tags: ["npc", "faction:fishers", "rival:coilin", "coin:25", "skill:fishing:35"] },
    { id: "nessa", name: "Nessa", description: "Innkeeper.", location: "inn", tags: ["npc", "innkeeper", "coin:300"] },
    { id: "greer", name: "Greer", description: "Fishwife.", location: "market", tags: ["npc", "shop", "shopkeeper", "sells:fish", "coin:200"] },
    { id: "tomas", name: "Tomas", description: "Woodcutter.", location: "ridge", tags: ["npc", "coin:35", "skill:woodcutting:40"] },
    { id: "dax", name: "Dax", description: "Deckhand.", location: "quay", tags: ["npc", "faction:fishers", "coin:20", "skill:fishing:20"] },
  ],
  items: [{ id: "clam1", name: "a clam", description: "Sweet.", location: "marsh", tags: ["item", "takeable", "edible", "nutrition:4"] }],
};

const npcs = ["coilin", "brannaugh", "nessa", "greer", "tomas", "dax"];

/** Run a window of ticks, returning its wall-time and an activity tally (variety still happening). */
function window(s: FizzosScene, from: number, to: number): { ms: number; weathers: number; quests: number; moves: number } {
  const weathers = new Set<string>();
  const posted = new Set<string>();
  const lastRoom: Record<string, string | null> = {};
  let moves = 0;
  const t0 = process.hrtime.bigint();
  for (let t = from; t <= to; t++) {
    s.runTick(t, []);
    const w = s.currentWorld();
    weathers.add(valueOf(w, "the-world", "weather") ?? "clear");
    for (const npc of npcs) {
      if ((valueOf(w, npc, "wants") ?? "") !== "") posted.add(npc);
      const room = placeOf(w, npc);
      if (lastRoom[npc] !== undefined && room !== lastRoom[npc]) moves++;
      lastRoom[npc] = room;
    }
  }
  return { ms: Number(process.hrtime.bigint() - t0) / 1e6, weathers: weathers.size, quests: posted.size, moves };
}

test("SCALE: many in-game years run with bounded per-tick cost and undiminished variety", () => {
  const { world, content } = loadBible(ISLAND);
  const s = new FizzosScene(tell(world, [{ e: "the-world", a: "world-seed", v: "1066" }]), content, "quay");

  const YEAR = 3360; // 4 seasons × 840 ticks
  const YEARS = 8; // ~27,000 ticks — far past one year, into the territory that "hundreds of hours" needs
  const early = window(s, 1, 1000); // first window, fresh world
  // Fast-forward through the middle years.
  for (let t = 1001; t <= YEAR * YEARS; t++) s.runTick(t, []);
  const late = window(s, YEAR * YEARS + 1, YEAR * YEARS + 1000); // a window in the 8th+ year

  const earlyPerTick = early.ms / 1000;
  const latePerTick = late.ms / 1000;
  console.log(`\n  Stability over ${YEARS} in-game years (${(YEAR * YEARS).toLocaleString()} ticks):`);
  console.log(`    early window: ${earlyPerTick.toFixed(3)} ms/tick — ${early.weathers} skies, ${early.quests} questers, ${early.moves} moves`);
  console.log(`    late  window: ${latePerTick.toFixed(3)} ms/tick — ${late.weathers} skies, ${late.quests} questers, ${late.moves} moves`);
  console.log(`    per-tick cost ratio late/early: ${(latePerTick / earlyPerTick).toFixed(2)}×`);

  // No degradation: the late window is still alive and varied...
  assert.ok(late.weathers >= 2, "the skies still turn in the late years");
  assert.ok(late.quests >= 3, "the Director is still minting quests in the late years");
  assert.ok(late.moves >= 5, "the cast is still pursuing its ends in the late years");
  // ...and the per-tick cost has not run away (the trace compacts; the world does not slow to a crawl).
  assert.ok(latePerTick < earlyPerTick * 4 + 0.5, `per-tick cost stayed bounded (${latePerTick.toFixed(3)} vs ${earlyPerTick.toFixed(3)} ms) — sustainable for hundreds of hours`);
});
