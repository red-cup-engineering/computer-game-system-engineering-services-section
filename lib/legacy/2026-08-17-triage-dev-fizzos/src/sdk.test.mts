/**
 * The FizzOS SDK: a complete game authored through `GameDefinition` alone — lifecycle hooks
 * (`onLoad`/`onTick`), custom systems, custom commands, and game-declared functional
 * predicates — running on the unmodified engine. The garden game touches no engine internals;
 * if it plays, the authoring surface is real.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createFizzosMud } from "./mud-server.mjs";
import { GARDEN_BIBLE, GARDEN_GAME } from "./example-garden-game.mjs";
import { FizzosScene } from "./scene.mjs";
import { loadBible } from "./world-load.mjs";
import { numberOf, valueOf } from "./world.mjs";

function garden(): FizzosScene {
  const { world, content } = loadBible(GARDEN_BIBLE);
  return new FizzosScene(world, content, "the-garden", GARDEN_GAME);
}
let clock = 1;
const run = (s: FizzosScene, a: string, l: string): string =>
  s.runTick(clock++, [{ k: "command", actor: a, line: l }]).events.find((e) => e.to === a)?.text ?? "";

test("onLoad seeds state once, before the world advances", () => {
  const s = garden();
  s.runTick(clock++, []); // first tick triggers onLoad
  assert.equal(valueOf(s.currentWorld(), "a-seedling", "growth"), "1", "seeded to 0 by onLoad, then +1 by the first onTick");
});

test("onTick advances the game's own state each turn", () => {
  const s = garden();
  for (let i = 0; i < 5; i++) s.runTick(clock++, []);
  assert.equal(numberOf(s.currentWorld(), "a-seedling", "growth", 0), 5, "five ticks of growth");
});

test("a game command (water) runs through the engine's dispatch", () => {
  const s = garden();
  run(s, "p", "look");
  assert.match(run(s, "p", "water"), /surges with growth/i, "the custom verb fires");
  assert.match(run(s, "p", "growth"), /growth \d+/, "and the custom report verb reads back");
});

test("a game system fires — the plant flowers when grown enough", () => {
  const s = garden();
  // Water repeatedly to cross the flowering threshold quickly.
  run(s, "p", "look");
  for (let i = 0; i < 5; i++) run(s, "p", "water");
  assert.equal(valueOf(s.currentWorld(), "a-seedling", "flowering"), "true", "the flowering system fired");
});

test("the same engine boots the game as a server with no Farstone in sight", () => {
  const mud = createFizzosMud(GARDEN_BIBLE, { game: GARDEN_GAME });
  mud.step();
  assert.equal(valueOf(mud.scene.currentWorld(), "a-seedling", "growth"), "1", "the garden game runs as a live server");
});

test("game-declared functional predicates compact their traces (no unbounded growth)", () => {
  const s = garden();
  for (let i = 0; i < 50; i++) s.runTick(clock++, []);
  // `growth` was declared functional by the game, so its trace holds ONE assertion, not 50.
  const facts = s.exportActor("a-seedling").facts.filter((f) => f.a === "growth");
  assert.equal(facts.length, 1, "the functional cell is compacted to its latest value");
});
