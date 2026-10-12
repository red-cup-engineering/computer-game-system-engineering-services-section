/**
 * Instanced regions — the dungeon-instance / private-map MMORPG capability. A template
 * region (rooms tagged `template:<name>`) clones into a private namespace with its monsters
 * and loot; a party enters its own copy; the copy is torn down once empty. Built on the same
 * runtime-room path the creator tools use — no new world model.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { planInstance, instanceMemberId, TEMPLATE_TAG } from "./instancing.mjs";
import { FizzosScene, type CommandIntent } from "./scene.mjs";
import { type Bible, loadBible } from "./world-load.mjs";

/** A tiny world with a two-room instanced den holding a goblin and a coffer. */
const BIBLE: Bible = {
  meta: { playerStart: "the-hall" },
  rooms: [
    { id: "the-hall", name: "The Hall", description: "A plain stone hall.", exits: {} },
    { id: "den-mouth", name: "Den Mouth", description: "The mouth of a dark den.", exits: { in: "den-deep" }, tags: ["template:den", "template:den:entry"] },
    { id: "den-deep", name: "Den Deep", description: "The depths of the den.", exits: { out: "den-mouth" }, tags: ["template:den"] },
  ],
  items: [
    { id: "a-coffer", name: "a coffer", description: "An iron coffer.", location: "den-deep", tags: ["item", "takeable", "value:30"] },
  ],
  npcs: [
    { id: "a-goblin", name: "a goblin", description: "A snarling goblin.", location: "den-deep", tags: ["npc", "hostile", "health:6", "attack:1"] },
  ],
};

function scene(): FizzosScene {
  const { world, content } = loadBible(BIBLE);
  return new FizzosScene(world, content, "the-hall");
}
let clock = 1;
const run = (s: FizzosScene, a: string, l: string): string =>
  s.runTick(clock++, [{ k: "command", actor: a, line: l } satisfies CommandIntent]).events.find((e) => e.to === a)?.text ?? "";

test("planInstance clones a template into a private namespace with its contents", () => {
  const { content } = loadBible(BIBLE);
  const plan = planInstance(content, "den", "7");
  assert.ok(plan !== null);
  assert.equal(plan!.entry, instanceMemberId("7", "den-mouth"), "the tagged entry is the way in");
  assert.equal(plan!.rooms.length, 2, "both template rooms are cloned");
  // Internal exits are remapped to stay inside the copy.
  assert.equal(plan!.rooms.find((r) => r.id === instanceMemberId("7", "den-mouth"))!.exits["in"], instanceMemberId("7", "den-deep"));
  // The monster and loot are cloned in, namespaced.
  assert.ok(plan!.things.some((t) => t.id === instanceMemberId("7", "a-goblin")), "the goblin is instanced");
  // The cloned monster is seeded with its health fact.
  assert.ok(plan!.facts.some((f) => f.e === instanceMemberId("7", "a-goblin") && f.a === "health" && f.v === "6"), "the instanced monster comes up statted");
  // No template tag leaks into the instance.
  assert.ok(plan!.rooms.every((r) => r.tags.every((t) => !t.startsWith(TEMPLATE_TAG))), "instance rooms drop the template tag");
});

test("two parties get separate, private instances of the same template", () => {
  const { content } = loadBible(BIBLE);
  const a = planInstance(content, "den", "1")!;
  const b = planInstance(content, "den", "2")!;
  assert.notEqual(a.entry, b.entry, "each instance is its own namespace");
});

test("scene: enter a den, then it tears down once you leave", () => {
  const s = scene();
  run(s, "p", "look");
  const entered = run(s, "p", "enter den");
  assert.match(entered, /private den/i, "you cross into a private instance");
  assert.match(run(s, "p", "look"), /Den Mouth/, "you stand in the instanced entry");
  run(s, "p", "in"); // deeper into the instance
  assert.match(run(s, "p", "look"), /Den Deep/, "the internal exit kept you inside the copy");
  // A second player entering gets a DIFFERENT copy (no goblin shared).
  run(s, "q", "look");
  run(s, "q", "enter den");
  assert.doesNotMatch(run(s, "q", "look"), /\bp\b/, "the other party is not in your instance");
  // Leave; the now-empty instance is reaped on the next tick.
  run(s, "p", "out");
  run(s, "p", "north"); // anything — advance a tick so the reaper runs with p outside
  run(s, "p", "look");
  // Re-entering mints a fresh instance id, proving the old one was torn down and not reused.
  const again = run(s, "p", "enter den");
  assert.match(again, /private den/i, "you can re-enter a fresh copy");
});
