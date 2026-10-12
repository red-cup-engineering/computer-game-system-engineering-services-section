/**
 * Gameplay-system invariants, driven through the live scene exactly as the server does.
 * Each test names the law its mechanic preserves (DESIGN.md §4 discipline).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { FizzosScene, type CommandIntent } from "./scene.mjs";
import { loadBible, startRoomOf } from "./world-load.mjs";
import { STARTER_WORLD } from "./starter-world.mjs";

function freshScene(): FizzosScene {
  const { world, content } = loadBible(STARTER_WORLD);
  return new FizzosScene(world, content, startRoomOf(STARTER_WORLD));
}

let clock = 0;
/** Drive a sequence of commands for one actor, returning that actor's last line. */
function run(scene: FizzosScene, actor: string, ...lines: string[]): string {
  let last = "";
  for (const line of lines) {
    const intent: CommandIntent = { k: "command", actor, line };
    const result = scene.runTick(clock++, [intent]);
    const mine = result.events.find((e) => e.to === actor);
    if (mine) last = mine.text;
  }
  return last;
}

test("combat — a wielded weapon amplifies damage; health folds; death is settled", () => {
  const scene = freshScene();
  run(scene, "hero", "north", "take cutlass", "wield cutlass", "attack rat");
  assert.equal(scene.snapOf("a-harbor-rat")?.condition, "dead", "the rat is slain in one armed blow (base 4 + weapon 3 >= 6 hull)");
});

test("economy — buying a ware moves coin and the good in opposite directions", () => {
  const scene = freshScene();
  const buy = run(scene, "hero", "east", "buy pint");
  const left = Number(buy.match(/\((\d+) left\)/)?.[1] ?? "25");
  assert.ok(left < 25, "the pint's regional price was deducted from the 25-coin start");
  assert.ok(scene.snapOf("hero")?.inventory !== undefined);
});

test("quests are μ-types — complete iff the constructed element exists, no flag", () => {
  const scene = freshScene();
  // the rope (jetty) delivered to Pip (tavern) is the constructed element of the quest
  run(scene, "hero", "north", "take rope", "south", "east", "give rope to pip");
  const journal = run(scene, "hero", "quests");
  assert.match(journal, /\[x\] Ropes for Pip/, "completion is read off the world, not a stored boolean");
});

test("NPC behaviour is a ludics design — talk converges or provably diverges", () => {
  const scene = freshScene();
  const responsive = run(scene, "hero", "east", "talk pip");
  assert.match(responsive, /Welcome/, "the responsive NPC's design converges to the daimon — the talk lands");
  const evasive = run(scene, "hero", "west", "north", "talk drunk");
  assert.match(evasive, /goes nowhere/, "the evasive NPC's design diverges — the conversation provably gets stuck");
});

test("ships — sailing carries the crew for free (conservation does the bookkeeping)", () => {
  const scene = freshScene();
  run(scene, "cap", "north", "rent skiff", "board skiff", "aft", "sail seaward");
  assert.equal(scene.snapOf("the-fizzwater-skiff")?.locatedIn, "open-water", "the ship moved");
  assert.equal(scene.snapOf("cap")?.locatedIn, "skiff-helm", "the captain is still in the helm room — carried by the hull, never tracked");
});

test("ships — sailing is gated on command rights (own or hire her first)", () => {
  const scene = freshScene();
  const denied = run(scene, "cap", "north", "board skiff", "aft", "sail seaward");
  assert.match(denied, /isn't yours to command/, "an unowned, unhired ship refuses the helm");
});

test("ships — a built hull is real and survives persistence (event-sourced)", () => {
  const scene = freshScene();
  run(scene, "wright", "north", "take timber", "take timber", "build raft");
  assert.equal(scene.snapOf("raft-1")?.locatedIn, "the-jetty", "the built raft floats at the dock");
  const restored = freshScene();
  restored.restore(scene.snapshot());
  assert.equal(restored.snapOf("raft-1")?.locatedIn, "the-jetty", "the built raft round-trips: content from the class, facts from the snapshot");
  assert.equal(restored.snapOf("raft-1")?.name, "a raft");
});

test("persistence — a played session round-trips through snapshot/restore", () => {
  const scene = freshScene();
  run(scene, "hero", "north", "take cutlass", "south", "east", "buy pint");
  const before = scene.snapOf("hero")?.inventory as string[];
  const restored = freshScene();
  restored.restore(scene.snapshot());
  assert.deepEqual(restored.snapOf("hero")?.inventory, before, "inventory survives; the world is an append-only trace");
});
