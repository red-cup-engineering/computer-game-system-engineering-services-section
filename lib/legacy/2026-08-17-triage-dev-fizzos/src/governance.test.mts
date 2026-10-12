/**
 * The commons. Industry-vs-ecology is a collective problem, so the cap on pollution is
 * enacted *together*: a proposal becomes law only at a majority of those abroad, and
 * once enacted the tick enforces it — fining industry that exceeds it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { enact, lawValue, proposalValue, propose, support, supporterCount } from "./governance.mjs";
import { world } from "./world.mjs";
import { FizzosScene, type CommandIntent } from "./scene.mjs";
import { loadBible, startRoomOf } from "./world-load.mjs";
import { STARTER_WORLD } from "./starter-world.mjs";

test("a law is enacted only with quorum support, then is in force", () => {
  let w = world([]);
  w = propose(w, "pollution-cap", 8);
  assert.equal(proposalValue(w, "pollution-cap"), 8);
  assert.equal(lawValue(w, "pollution-cap"), null, "proposing is not enacting");
  w = support(w, "pollution-cap", "alice");
  w = support(w, "pollution-cap", "alice"); // idempotent
  assert.equal(supporterCount(w, "pollution-cap"), 1, "a backer is counted once");
  w = support(w, "pollution-cap", "bob");
  assert.equal(supporterCount(w, "pollution-cap"), 2);
  w = enact(w, "pollution-cap");
  assert.equal(lawValue(w, "pollution-cap"), 8, "the enacted cap is now law");
  assert.equal(proposalValue(w, "pollution-cap"), null, "the proposal is cleared");
});

test("a sole player abroad reaches quorum and the law shows in force", () => {
  const { world: w, content } = loadBible(STARTER_WORLD);
  const scene = new FizzosScene(w, content, startRoomOf(STARTER_WORLD));
  const run = (a: string, l: string): string => {
    const r = scene.runTick(3, [{ k: "command", actor: a, line: l } satisfies CommandIntent]);
    return r.events.find((e) => e.to === a)?.text ?? "";
  };
  run("solo", "look"); // join (the only player → quorum 1)
  assert.match(run("solo", "propose pollution-cap 6"), /enacts a pollution cap/, "quorum of one enacts");
  assert.match(run("solo", "laws"), /pollution cap: 6/, "the cap is now in force on the commons");
});
