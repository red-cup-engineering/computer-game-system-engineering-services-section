/**
 * NPC agency: NPCs act on their interiority (utility-AI). These name the laws — self-preservation
 * before the feud, and the lore's keystone: *scarcity ignites the feud*. The drama is emergent.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { tell, numberOf, valueOf } from "./world.mjs";
import { chooseNpcAction } from "./npc-agency.mjs";
import { type Bible, loadBible } from "./world-load.mjs";
import { FizzosScene } from "./scene.mjs";

const sit = (o: Partial<Parameters<typeof chooseNpcAction>[0]>) => chooseNpcAction({ hunger: 0, rest: 0, company: 0, edibleHere: null, foodDirection: null, restHere: false, restDirection: null, workHere: null, rivalHere: null, embittered: false, ...o });

test("utility: eat what's here > seek food elsewhere > feud; a fed NPC keeps the peace", () => {
  assert.deepEqual(sit({ hunger: 15, edibleHere: "fish", foodDirection: "north", rivalHere: "foe" }), { kind: "eat", item: "fish" }, "food at hand first");
  assert.deepEqual(sit({ hunger: 15, foodDirection: "north", rivalHere: "foe" }), { kind: "move", dir: "north" }, "go to the nearest food before brawling");
  assert.deepEqual(sit({ hunger: 15, rivalHere: "foe" }), { kind: "attack", target: "foe" }, "no food anywhere + a rival + an empty belly → the feud");
  assert.deepEqual(sit({ hunger: 2, foodDirection: "north", rivalHere: "foe" }), { kind: "idle" }, "well-fed: no need to roam or brawl");
});

test("a lasting grievance keeps the feud hot: an embittered NPC fights its rival even well-fed", () => {
  assert.deepEqual(sit({ hunger: 0, rivalHere: "foe", embittered: true }), { kind: "attack", target: "foe" }, "the grudge needs no hunger to ignite");
});

test("WEAVE hunger→eat: a starving NPC snatches and eats food in the room (competing with the player)", () => {
  const bible: Bible = {
    rooms: [{ id: "quay", name: "Quay", description: "Granite.", tags: ["place", "harbor", "outdoor"] }],
    npcs: [{ id: "greer", name: "Greer Tenn", description: "Gaunt.", location: "quay", tags: ["npc"] }],
    items: [{ id: "fish", name: "a fresh fish", description: "Silver.", location: "quay", tags: ["item", "takeable", "edible", "nutrition:3"] }],
  };
  const { world: w, content } = loadBible(bible);
  const s = new FizzosScene(tell(w, [{ e: "greer", a: "need:hunger", v: "16" }]), content, "quay");
  s.runTick(1, []); // no player command — the NPC acts on its own
  assert.equal(valueOf(s.currentWorld(), "fish", "located-in"), "nothing", "Greer ate the fish off the quay");
  assert.ok(numberOf(s.currentWorld(), "greer", "need:hunger", 16) < 16, "and her hunger eased");
});

test("WEAVE hunger→seek: a starving NPC roams the island toward food it can't see from here", () => {
  const bible: Bible = {
    rooms: [
      { id: "ridge", name: "The Ridge", description: "Bare granite, no food.", exits: { down: "quay" }, tags: ["place", "outdoor"] },
      { id: "quay", name: "Quay", description: "A way-room.", exits: { up: "ridge", sea: "grounds" }, tags: ["place", "harbor", "outdoor"] },
      { id: "grounds", name: "The Fishing Grounds", description: "Food is here.", exits: { in: "quay" }, tags: ["place", "ocean", "fishing"] },
    ],
    npcs: [{ id: "wanderer", name: "a starving wanderer", description: "Gaunt.", location: "ridge", tags: ["npc"] }],
  };
  const { world: w, content } = loadBible(bible);
  const s = new FizzosScene(tell(w, [{ e: "wanderer", a: "need:hunger", v: "18" }]), content, "ridge");
  s.runTick(1, []);
  assert.equal(valueOf(s.currentWorld(), "wanderer", "located-in"), "quay", "the wanderer stepped toward the fishing grounds (down to the quay)");
});

test("WEAVE scarcity→feud: two starving rivals come to blows with no script", () => {
  const bible: Bible = {
    rooms: [{ id: "quay", name: "Quay", description: "Granite.", tags: ["place", "harbor", "outdoor"] }],
    npcs: [
      { id: "dax", name: "Dax Pell", description: "Hot-headed.", location: "quay", tags: ["npc", "rival:mara", "health:20"] },
      { id: "mara", name: "Mara Quill", description: "Cold, tenacious.", location: "quay", tags: ["npc", "rival:dax", "health:20"] },
    ],
  };
  const { world: w, content } = loadBible(bible);
  // The lean season: both are hungry. No food to be had — tempers go to violence.
  const s = new FizzosScene(tell(w, [{ e: "dax", a: "need:hunger", v: "14" }, { e: "mara", a: "need:hunger", v: "14" }]), content, "quay");
  const maraBefore = numberOf(s.currentWorld(), "mara", "health", 20);
  s.runTick(1, []);
  assert.ok(numberOf(s.currentWorld(), "mara", "health", 20) < maraBefore, "the feud flared under scarcity — Dax struck Mara");
});
