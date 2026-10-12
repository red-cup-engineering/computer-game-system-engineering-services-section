/**
 * Player construction (Minecraft): gather → craft → *build the world*. These name it — a player who
 * carries the materials raises a new, owned, persistent room; the materials are spent; the world is
 * reshaped by its inhabitants and survives a save/restore.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { tell, valueOf } from "./world.mjs";
import { STRUCTURES, shortfall } from "./construction.mjs";
import { type Bible, loadBible } from "./world-load.mjs";
import { FizzosScene, type CommandIntent } from "./scene.mjs";

test("shortfall: a structure can be raised iff every material is covered", () => {
  const shack = STRUCTURES.shack!;
  assert.equal(shortfall(shack, { timber: 4 }).ok, true);
  assert.equal(shortfall(shack, { timber: 2 }).ok, false);
  assert.deepEqual(shortfall(shack, { timber: 1 }).missing, ["3 more timber"]);
});

const FIELD: Bible = {
  rooms: [{ id: "shore", name: "A Bare Shore", description: "Empty granite and gorse.", tags: ["place", "outdoor"] }],
  items: [
    { id: "t1", name: "a baulk of timber", description: "Oak.", location: "builder", tags: ["item", "takeable", "timber"] },
    { id: "t2", name: "a baulk of timber", description: "Oak.", location: "builder", tags: ["item", "takeable", "timber"] },
    { id: "t3", name: "a baulk of timber", description: "Oak.", location: "builder", tags: ["item", "takeable", "timber"] },
    { id: "t4", name: "a baulk of timber", description: "Oak.", location: "builder", tags: ["item", "takeable", "timber"] },
  ],
};

test("WEAVE build: a player raises a shack from timber — owned, tagged, and the timber is spent", () => {
  const { world, content } = loadBible(FIELD);
  const s = new FizzosScene(world, content, "shore");
  s.join("builder", "shore");
  const { events } = s.runTick(1, [{ k: "command", actor: "builder", line: "construct shack north" } satisfies CommandIntent]);
  const reply = events.filter((e) => e.k === "message" && e.to === "builder").map((e) => (e as { text: string }).text).join("\n");
  assert.match(reply, /raise a fishing shack to the north/, "the shack went up");

  // The shore now exits north to a new built room.
  const built = (content.rooms as Record<string, { exits: Record<string, string> }>)["shore"]!.exits["north"];
  assert.ok(built !== undefined && /^built-shack/.test(built), "a new room was attached northward");
  const room = (content.rooms as Record<string, { tags: readonly string[]; exits: Record<string, string> }>)[built]!;
  assert.ok(room.tags.includes("built") && room.tags.includes("shelter"), "it carries the structure's tags");
  assert.equal(room.exits["south"], "shore", "and a way back");
  assert.equal(valueOf(s.currentWorld(), built, "owner"), "builder", "deeded to the builder");
  // The four baulks of timber were consumed.
  for (const t of ["t1", "t2", "t3", "t4"]) assert.equal(valueOf(s.currentWorld(), t, "located-in"), "nothing", `${t} was spent`);
});

test("a player can't build without the materials", () => {
  const bible: Bible = { rooms: [{ id: "shore", name: "Shore", description: "Bare.", tags: ["place", "outdoor"] }] };
  const { world, content } = loadBible(bible);
  const s = new FizzosScene(world, content, "shore");
  s.join("pauper", "shore");
  const { events } = s.runTick(1, [{ k: "command", actor: "pauper", line: "construct shack north" } satisfies CommandIntent]);
  const reply = events.filter((e) => e.k === "message" && e.to === "pauper").map((e) => (e as { text: string }).text).join("\n");
  assert.match(reply, /can't yet raise/, "no timber, no shack");
});

test("a built structure survives a save and restore (the world is durably reshaped)", () => {
  const { world, content } = loadBible(FIELD);
  const s = new FizzosScene(world, content, "shore");
  s.join("builder", "shore");
  s.runTick(1, [{ k: "command", actor: "builder", line: "construct shack north" } satisfies CommandIntent]);
  const snap = s.snapshot();
  // Fresh scene, restore the snapshot — the built room must come back.
  const { world: w2, content: c2 } = loadBible(FIELD);
  const s2 = new FizzosScene(w2, c2, "shore");
  s2.restore(snap);
  const exits = (c2.rooms as Record<string, { exits: Record<string, string> }>)["shore"]!.exits;
  assert.ok(/^built-shack/.test(exits["north"] ?? ""), "the player's shack persisted across the restore");
});
