/**
 * World interaction: searching reveals hidden things (skill-gated, not shown by `look`
 * until found); doors gate movement and need their key to unlock; and speech in a tongue
 * is clear to those who know it and garbled to those who don't — per the perception fiber.
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
function events(s: FizzosScene, a: string, l: string): { to: string; text: string }[] {
  return [...s.runTick(clock++, [{ k: "command", actor: a, line: l } satisfies CommandIntent]).events];
}

/** Get to the jetty and dispatch the rat so a long search isn't interrupted by combat. */
function clearJetty(s: FizzosScene, who: string): void {
  run(s, who, "north");
  run(s, who, "take cutlass");
  run(s, who, "wield cutlass");
  for (let i = 0; i < 3; i++) run(s, who, "attack rat");
}

test("search — a hidden thing is unseen until found, then revealed", () => {
  const s = scene();
  clearJetty(s, "x"); // the jetty, where a key is hidden
  assert.ok(!run(s, "x", "look").includes("rusty"), "the hidden key is not in plain sight");
  let found = "";
  for (let i = 0; i < 40 && !found.includes("uncover"); i++) found = run(s, "x", "search");
  assert.match(found, /uncover a rusty iron key/, "searching reveals it");
  assert.ok(run(s, "x", "look").includes("rusty"), "once found, it is in the room");
});

test("doors — a locked door gates movement and needs its key to unlock", () => {
  const s = scene();
  clearJetty(s, "x");
  let found = "";
  for (let i = 0; i < 40 && !found.includes("uncover"); i++) found = run(s, "x", "search");
  run(s, "x", "take key");
  run(s, "x", "south"); run(s, "x", "east"); // to the tavern, above the cellar
  assert.match(run(s, "x", "down"), /locked/, "the hatch blocks the way down");
  assert.match(run(s, "x", "unlock hatch"), /unlock/, "the key opens the lock");
  run(s, "x", "open hatch");
  run(s, "x", "down");
  assert.equal(s.snapOf("x")?.locatedIn, "the-cellar", "now you can descend");
});

test("languages — speech is clear to speakers and garbled to others (per fiber)", () => {
  const s = scene();
  run(s, "fluent", "east"); run(s, "stranger", "east"); // both in the tavern with Pip
  run(s, "fluent", "learn harbor-cant"); // Pip teaches it
  const heard = events(s, "fluent", "speak harbor-cant ahoy mate");
  const toStranger = heard.find((e) => e.to === "stranger")?.text ?? "";
  assert.ok(toStranger.includes("harbor-cant"), "the stranger hears that a tongue was spoken");
  assert.ok(!toStranger.includes("ahoy mate"), "but the words are garbled — they don't speak it");
});
