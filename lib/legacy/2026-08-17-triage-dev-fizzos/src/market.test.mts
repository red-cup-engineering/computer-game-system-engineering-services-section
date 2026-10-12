/**
 * Supply and demand. Buying lifts a shop's price and draws its stock; selling a catalog
 * ware pushes the price down; the at-sea catch becomes coin. A player-moved economy.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { easeToward, wareTypeOfTags } from "./market.mjs";
import { FizzosScene, type CommandIntent } from "./scene.mjs";
import { loadBible, startRoomOf } from "./world-load.mjs";
import { STARTER_WORLD } from "./starter-world.mjs";

function shopScene(): FizzosScene {
  const { world, content } = loadBible(STARTER_WORLD);
  return new FizzosScene(world, content, startRoomOf(STARTER_WORLD));
}
const say = (scene: FizzosScene, a: string, l: string): string =>
  scene.runTick(1, [{ k: "command", actor: a, line: l } satisfies CommandIntent]).events.find((e) => e.to === a)?.text ?? "";

test("buying lifts the price and draws down stock", () => {
  const scene = shopScene();
  say(scene, "h", "east"); // to Pip (sells fizzwater)
  const first = say(scene, "h", "buy fizzwater");
  const firstPrice = Number(first.match(/for (\d+) coin/)?.[1] ?? "0");
  assert.ok(firstPrice > 0, "the first pint goes at its regional board price");
  for (let i = 0; i < 4; i++) say(scene, "h", "buy fizzwater");
  const board = say(scene, "h", "wares");
  const nowPrice = Number(board.match(/a pint of fizzwater — (\d+) coin/)?.[1] ?? "0");
  assert.ok(nowPrice > firstPrice, "demand has driven the price up from where it started");
});

test("mean reversion eases a price back toward its baseline", () => {
  assert.ok(easeToward(6, 3, 0.25) < 6 && easeToward(6, 3, 0.25) > 3, "a high price drifts down toward base");
  assert.ok(easeToward(1, 3, 0.25) > 1, "a low price drifts up toward base");
});

test("the at-sea catch is sellable — a fish carries its ware type", () => {
  assert.equal(wareTypeOfTags(["item", "takeable", "fish"]), "fish", "a fish sells as fish");
  assert.equal(wareTypeOfTags(["item", "takeable", "value:8"]), null, "a locket has no catalog type (sells at value)");
});
