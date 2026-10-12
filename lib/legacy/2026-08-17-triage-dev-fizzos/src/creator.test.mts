/**
 * In-world creator tools: a creator shapes the world from inside — digs rooms, describes
 * and names them, creates things — and the edits persist (replayed from an authored log
 * on restore, their facts from the snapshot). Farstone is a living, editable world.
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
function run(s: FizzosScene, a: string, l: string): string {
  return s.runTick(clock++, [{ k: "command", actor: a, line: l } satisfies CommandIntent]).events.find((e) => e.to === a)?.text ?? "";
}

test("creator tools are gated — only a creator may shape the world", () => {
  const s = scene();
  run(s, "nobody", "look");
  assert.match(run(s, "nobody", "@dig north Nowhere"), /Only a creator/);
});

test("a creator digs a room, describes it, and creates a thing", () => {
  const s = scene();
  run(s, "b", "look");
  s.grantCreator("b");
  assert.match(run(s, "b", "@dig up The Crows Nest"), /dig up/);
  assert.match(run(s, "b", "up"), /Crows Nest/, "the new room exists and is reachable");
  run(s, "b", "@describe here A swaying platform high in the rigging.");
  assert.match(run(s, "b", "look"), /swaying platform/, "the description took");
  run(s, "b", "@create a brass spyglass");
  assert.match(run(s, "b", "look"), /brass spyglass/, "the created thing is in the room");
});

test("authored edits persist — a dug room survives a restart", () => {
  const s = scene();
  run(s, "b", "look");
  s.grantCreator("b");
  run(s, "b", "@dig down The Bilge");
  run(s, "b", "down");
  const where = s.snapOf("b")?.locatedIn as string;
  const restored = scene();
  restored.restore(s.snapshot());
  assert.equal(restored.snapOf(where)?.name, "The Bilge", "the authored room is rebuilt from the snapshot");
});
