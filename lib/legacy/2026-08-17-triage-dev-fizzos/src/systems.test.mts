/**
 * The richer systems: skills (use-improves), crafting (linear A⊗B⊸C), the soul and
 * channels (social), and NPC interiority — including the paraconsistent dream, where an
 * NPC told two opposing things holds the contradiction as `stable` rather than crashing
 * or guessing (DESIGN.md §4.2).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { FizzosScene, type CommandIntent } from "./scene.mjs";
import { loadBible, startRoomOf } from "./world-load.mjs";
import { STARTER_WORLD } from "./starter-world.mjs";
import { believe, beliefOf, driftNeeds, moodOf } from "./npc-life.mjs";
import { practise, skillOf } from "./skills.mjs";
import { world } from "./world.mjs";

function freshScene(): FizzosScene {
  const { world: w, content } = loadBible(STARTER_WORLD);
  return new FizzosScene(w, content, startRoomOf(STARTER_WORLD));
}
let clock = 1000;
function run(scene: FizzosScene, actor: string, ...lines: string[]): { last: string; events: { to: string; text: string }[] } {
  let last = "";
  let events: { to: string; text: string }[] = [];
  for (const line of lines) {
    const r = scene.runTick(clock++, [{ k: "command", actor, line } satisfies CommandIntent]);
    events = [...r.events];
    const mine = r.events.find((e) => e.to === actor);
    if (mine) last = mine.text;
  }
  return { last, events };
}

test("skills — practice improves with diminishing returns and never exceeds the cap", () => {
  let w = world([]);
  for (let i = 0; i < 200; i++) w = practise(w, "smith", "smithing");
  const level = skillOf(w, "smith", "smithing");
  assert.ok(level > 0 && level <= 100, "a skill grows but is capped");
  assert.equal(level, 100, "enough practice reaches mastery");
});

test("crafting — inputs are consumed (linear) and a good is produced", () => {
  const scene = freshScene();
  const { last } = run(scene, "h", "take fiber", "take fiber", "craft rope");
  assert.match(last, /You craft a coil of rope/);
  const inv = scene.snapOf("h")?.inventory as string[];
  assert.ok(inv.some((id) => id.startsWith("rope-")), "the rope was produced");
  assert.ok(!inv.some((id) => id.startsWith("a-hank-of-fiber")), "the fiber was used up (A⊗B⊸C)");
});

test("soul — an aimed emote renders to actor, room, and target distinctly", () => {
  const scene = freshScene();
  run(scene, "alice", "east");
  run(scene, "bob", "east");
  const { events } = run(scene, "alice", "wave bob");
  assert.ok(events.some((e) => e.to === "alice" && /You wave at/.test(e.text)), "actor sees first person");
  assert.ok(events.some((e) => e.to === "bob" && /waves at you/.test(e.text)), "target is addressed");
});

test("channels — chat reaches every logged-in player regardless of place", () => {
  const scene = freshScene();
  run(scene, "alice", "look");
  run(scene, "bob", "north"); // bob is elsewhere
  const { events } = run(scene, "alice", "chat ahoy");
  assert.ok(events.some((e) => e.to === "bob" && /\[chat\] Alice: ahoy/.test(e.text)), "global channel crosses rooms");
});

test("NPC interiority — needs drift into a mood", () => {
  let w = world([]);
  for (let i = 0; i < 20; i++) w = driftNeeds(w, "pip");
  assert.notEqual(moodOf(w, "pip"), "content", "unmet needs produce a felt mood");
});

test("NPC dreaming — opposing observations glue to a HELD contradiction (paraconsistent)", () => {
  let w = world([]);
  // an NPC is told (observes) the ferryman is loyal, then that he is not
  w = believe(w, "oracle", "ferryman-loyal", "potential");
  assert.equal(beliefOf(w, "oracle", "ferryman-loyal"), "potential", "first it simply believes");
  w = believe(w, "oracle", "ferryman-loyal", "active");
  assert.equal(beliefOf(w, "oracle", "ferryman-loyal"), "stable", "told the opposite, it holds BOTH — rumor, not a crash, not a coin-flip");
});
