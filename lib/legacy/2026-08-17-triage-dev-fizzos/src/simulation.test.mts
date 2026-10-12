/**
 * The long-run simulation harness — *evidence at scale*. It boots the full Farstone game (climate,
 * ecology, the Director, NPC utility-AI, reputation, the feud, thoughts) on a representative island
 * and runs it for thousands of ticks with **no human input at all**, then asserts the world produced
 * a sustained, varied stream of emergent activity: the skies turned, the seasons cycled, the cast
 * roamed and worked and posted errands and came to blows — the hours-of-gameplay machinery, running.
 *
 * This is the answer to "generative by design but unproven at scale": here it is, run at scale.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { type Bible, loadBible } from "./world-load.mjs";
import { FizzosScene } from "./scene.mjs";
import { placeOf, numberOf, valueOf, tell } from "./world.mjs";
import { seasonAt } from "./world-clock.mjs";

/** A representative slice of the island — food, rest, work, factions, a feud, ocean ecology. */
const ISLAND: Bible = {
  rooms: [
    { id: "quay", name: "Harbor Quay", description: "The working waterfront.", exits: { north: "town", west: "inn", sea: "grounds", up: "ridge", south: "marsh" }, tags: ["place", "harbor", "outdoor", "dock"] },
    { id: "town", name: "Downtown", description: "Civic blocks.", exits: { south: "quay", east: "market" }, tags: ["place", "town", "civic", "outdoor"] },
    { id: "market", name: "Market Row", description: "Stalls.", exits: { west: "town" }, tags: ["place", "market", "shop", "outdoor"] },
    { id: "inn", name: "The Saltloft Inn", description: "Warm hearth, beds upstairs.", exits: { east: "quay" }, tags: ["place", "inn", "indoor", "social-hub", "shelter"] },
    { id: "ridge", name: "The Ridge", description: "Timber and spruce.", exits: { down: "quay" }, tags: ["place", "outdoor", "forest", "node:timber"] },
    { id: "marsh", name: "The Salt Marsh", description: "Clam bed and Spartina.", exits: { north: "quay" }, tags: ["place", "marsh", "outdoor", "shellfish"] },
    { id: "grounds", name: "The Fishing Grounds", description: "Open water.", exits: { in: "quay", deep: "deep" }, tags: ["place", "ocean", "fishing"] },
    { id: "deep", name: "The Open Sea", description: "Deep water.", exits: { shallow: "grounds" }, tags: ["place", "ocean", "deep"] },
  ],
  npcs: [
    { id: "coilin", name: "Coilin Vey", description: "A fisher.", location: "quay", tags: ["npc", "faction:fishers", "rival:brannaugh", "coin:30", "skill:fishing:30"] },
    { id: "brannaugh", name: "Brannaugh Ross", description: "A clam-digger.", location: "quay", tags: ["npc", "faction:fishers", "rival:coilin", "coin:25", "skill:fishing:35"] },
    { id: "nessa", name: "Nessa Cawl", description: "The innkeeper.", location: "inn", tags: ["npc", "innkeeper", "coin:300"] },
    { id: "greer", name: "Greer Tenn", description: "A fishwife.", location: "market", tags: ["npc", "shop", "shopkeeper", "sells:fish", "coin:200"] },
    { id: "tomas", name: "Tomas Strake", description: "A quarryman.", location: "ridge", tags: ["npc", "coin:35", "skill:woodcutting:40"] },
    { id: "dax", name: "Dax Pell", description: "A hard deckhand.", location: "quay", tags: ["npc", "faction:fishers", "coin:20", "skill:fishing:20"] },
    { id: "mara", name: "Mara Quill", description: "The Watch.", location: "town", tags: ["npc", "faction:watch", "coin:120"] },
    { id: "coll", name: "Father Coll", description: "The chapel-keeper.", location: "inn", tags: ["npc", "faction:chapel", "coin:40"] },
  ],
  items: [
    { id: "clam1", name: "a soft-shell clam", description: "Sweet.", location: "marsh", tags: ["item", "takeable", "edible", "nutrition:4"] },
    { id: "clam2", name: "a soft-shell clam", description: "Sweet.", location: "marsh", tags: ["item", "takeable", "edible", "nutrition:4"] },
  ],
};

test("SCALE: the world runs itself for thousands of ticks, producing sustained varied emergent activity", () => {
  const { world, content } = loadBible(ISLAND);
  // A fixed seed → this whole multi-thousand-tick history is replay-exact (repeatable nondeterminism).
  const s = new FizzosScene(tell(world, [{ e: "the-world", a: "world-seed", v: "20260620" }]), content, "quay");

  const npcs = ["coilin", "brannaugh", "nessa", "greer", "tomas", "dax", "mara", "coll"];
  const weathers = new Set<string>();
  const seasons = new Set<string>();
  const posted = new Set<string>();
  const roamed = new Set<string>();
  const worked = new Set<string>();
  const lastRoom: Record<string, string | null> = {};
  let healthDrops = 0;
  const fishPrices: number[] = [];
  let fishStockMin = Infinity, fishStockMax = -Infinity;
  const lastHealth: Record<string, number> = {};

  const TICKS = 3400; // > 4 seasons (4 × 840), so the whole year turns
  const t0 = process.hrtime.bigint();
  for (let t = 1; t <= TICKS; t++) {
    s.runTick(t, []);
    const w = s.currentWorld();
    weathers.add(valueOf(w, "the-world", "weather") ?? "clear");
    seasons.add(seasonAt(numberOf(w, "the-world", "world-time", 0)));
    for (const npc of npcs) {
      if ((valueOf(w, npc, "wants") ?? "") !== "") posted.add(npc);
      const room = placeOf(w, npc);
      if (lastRoom[npc] !== undefined && room !== lastRoom[npc]) roamed.add(npc);
      lastRoom[npc] = room;
      const hp = numberOf(w, npc, "health", 100);
      if (lastHealth[npc] !== undefined && hp < lastHealth[npc]!) healthDrops++;
      lastHealth[npc] = hp;
      if (numberOf(w, npc, "coin", 0) > 35 && (npc === "tomas" || npc === "dax")) worked.add(npc); // earnings from working a node
    }
    if (t % 50 === 0) {
      fishPrices.push(numberOf(w, "greer", "price:fish", 0));
      const stock = numberOf(w, "grounds", "fish-stock", 20);
      fishStockMin = Math.min(fishStockMin, stock);
      fishStockMax = Math.max(fishStockMax, stock);
    }
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;

  const priceMoved = Math.max(...fishPrices) - Math.min(...fishPrices);
  // Evidence report — the volume and variety of a year of autonomous play.
  console.log(`\n  Farstone — ${TICKS} ticks of autonomous play in ${ms.toFixed(0)}ms:`);
  console.log(`    skies seen:      ${[...weathers].join(", ")}`);
  console.log(`    seasons turned:  ${[...seasons].join(", ")}`);
  console.log(`    posted errands:  ${posted.size}/${npcs.length} NPCs minted a quest`);
  console.log(`    roamed island:   ${roamed.size}/${npcs.length} NPCs moved between rooms`);
  console.log(`    came to blows:   ${healthDrops} damage events (the feud, predation)`);
  console.log(`    fish price swing: ${priceMoved.toFixed(1)} coin; stock ranged ${fishStockMin.toFixed(1)}..${fishStockMax.toFixed(1)}`);

  // The world stayed alive and varied across the whole run:
  assert.ok(weathers.size >= 3, `the skies varied (${weathers.size} of 5 states seen)`);
  assert.equal(seasons.size, 4, "the full year turned through all four seasons");
  assert.ok(posted.size >= 4, `the Director minted errands across the cast (${posted.size} NPCs)`);
  assert.ok(roamed.size >= 3, `NPCs pursued their ends across the island (${roamed.size} roamed)`);
  assert.ok(healthDrops >= 1, "the feud / predation drew blood at least once");
  assert.ok(priceMoved > 0 || fishStockMax - fishStockMin > 0, "the living economy/ecology moved");
});
