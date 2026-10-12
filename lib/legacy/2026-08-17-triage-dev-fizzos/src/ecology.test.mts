/**
 * The living ocean (Eco). Fish stocks deplete and can collapse; pollution suppresses
 * regrowth and, past a threshold, kills; and the ecological charge holds the contested
 * cell — strong life AND strong harm at once — as `stable`, the paraconsistent value the
 * DESIGN names for ecosystem dynamics. Industry is profitable, polluting, and at-sea only.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { drawFish, ecologyCharge, ecologyStep, emitPollution, fishStock, pollutionOf } from "./ecology.mjs";
import { world } from "./world.mjs";
import { FizzosScene, type CommandIntent } from "./scene.mjs";
import { loadBible, startRoomOf } from "./world-load.mjs";
import { STARTER_WORLD } from "./starter-world.mjs";

const sea = () => world([{ e: "sea", a: "capacity-fish", v: "20" }, { e: "sea", a: "fish-stock", v: "20" }]);

test("overfishing collapses a stock; a worked-out cell yields nothing", () => {
  let w = sea();
  let total = 0;
  for (let i = 0; i < 15; i++) { const r = drawFish(w, "sea", 2); w = r.world; total += r.caught; }
  assert.equal(fishStock(w, "sea"), 0, "the stock is fished to collapse");
  assert.equal(drawFish(w, "sea", 2).caught, 0, "no fish left to take");
  assert.equal(total, 20, "you cannot catch more than lived there — conservation");
});

test("ecological charge holds the contested cell as `stable` (paraconsistent)", () => {
  assert.equal(ecologyCharge(18, 20, 7), "stable", "thriving AND fouled at once is held, not flattened");
  assert.equal(ecologyCharge(18, 20, 1), "potential", "thriving, clean → healthy");
  assert.equal(ecologyCharge(2, 20, 1), "active", "depleted → degraded");
});

test("pollution suppresses regrowth and, past the threshold, kills fish", () => {
  let clean = world([{ e: "a", a: "capacity-fish", v: "20" }, { e: "a", a: "fish-stock", v: "10" }]);
  clean = ecologyStep(clean, "a");
  assert.ok(fishStock(clean, "a") > 10, "clean water regrows the stock");

  let fouled = world([{ e: "b", a: "capacity-fish", v: "20" }, { e: "b", a: "fish-stock", v: "18" }, { e: "b", a: "pollution", v: "14" }]);
  const before = fishStock(fouled, "b");
  fouled = ecologyStep(fouled, "b");
  assert.ok(fishStock(fouled, "b") < before, "heavy pollution kills fish");
  assert.ok(pollutionOf(fouled, "b") < 14, "pollution decays over time");
});

test("industry is at-sea only — never in harbor or ashore", () => {
  const { world: w, content } = loadBible(STARTER_WORLD);
  const scene = new FizzosScene(w, content, startRoomOf(STARTER_WORLD));
  const run = (a: string, l: string): string => {
    const r = scene.runTick(7, [{ k: "command", actor: a, line: l } satisfies CommandIntent]);
    return r.events.find((e) => e.to === a)?.text ?? "";
  };
  run("cap", "north"); // ashore at the jetty
  assert.match(run("cap", "industrialize"), /aboard a ship/, "you cannot industrialize standing on land");
  run("cap", "rent skiff"); run("cap", "board skiff"); run("cap", "aft");
  assert.match(run("cap", "industrialize"), /open water|harbor/, "nor in harbor — only out at sea");
});
