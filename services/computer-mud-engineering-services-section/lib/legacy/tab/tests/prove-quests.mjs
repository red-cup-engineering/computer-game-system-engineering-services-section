// prove-quests — QUESTS: tasks an npc gives, objectives READ OFF THE LOG, rewards on completion.
// Builds a tiny harbor world by hand in a UNIQUE /tmp dir (no examples), drives the quest
// morphisms directly, and asserts the agential-realist properties: a quest's objective is a query
// over the settled EAVT world, NOT a scripted counter; "met" flips only when the world says so;
// completing grants the coin reward (coinOf rises) and marks the quest done; a done quest cannot be
// completed again; gathering reads met only once enough material is carried; accept refuses a quest
// already in hand.
//
// Same tiny harness as prove-comms.mjs. Standalone: run `node tests/prove-quests.mjs`.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import doing from "#doing";
import { coinOf } from "#market";

import quest, {
  offersOf, accept, progressOf, complete, questsOf, listQuests,
} from "../being/doing/responding/questing/scripts/quest.mjs";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );

const tmp = mkdtempSync(join(tmpdir(), "tab-quests-"));
const world = join(tmp, "w");

// place — drop a subject into a place (functional located-in; relational so it dual-files).
const place = async (who, where, t) => {
  await doing({ root: world, subject: who, predicate: "located-in", object: where, t });
};
// mint a material item carried by an owner (located-in the owner = carried).
const mintMaterial = async (id, material, owner, t) => {
  await doing({ root: world, subject: id, predicate: "kind", object: "item", t: `${t}a` });
  await doing({ root: world, subject: id, predicate: "material", object: material, t: `${t}b` });
  await doing({ root: world, subject: id, predicate: "located-in", object: owner, t: `${t}c` });
};

try {
  // --- the table is well-formed -------------------------------------------------------------
  await ok("listQuests returns a non-empty table; each entry has giver/objective/reward", async () => {
    const all = listQuests();
    assert.ok(all.length >= 6, "at least six quests in the harbor table");
    for (const q of all) {
      assert.ok(q.id && q.giver && q.objective && q.reward, `quest ${q.id} is complete`);
      assert.ok(["reach", "slay", "deliver", "gather"].includes(q.objective.kind), `valid kind for ${q.id}`);
    }
  });

  await ok("offersOf filters quests by their giver npc", async () => {
    const pell = await offersOf(world, "old-pell");
    assert.ok(pell.some((q) => q.id === "reach-the-lighthouse"), "old-pell offers the lighthouse climb");
    assert.ok(pell.every((q) => q.giver === "old-pell"), "every offer is given by old-pell");
  });

  // --- reach-the-lighthouse: accept, met flips on movement, complete grants coin ------------
  await ok("a freshly-accepted reach quest is accepted but not yet met", async () => {
    await place("wanderer", "harbor-square", "seed:000001");
    const r = await accept(world, "wanderer", "reach-the-lighthouse", "tick:1/accept");
    assert.equal(r.ok, true, "accept succeeds the first time");
    const p = await progressOf(world, "wanderer", "reach-the-lighthouse");
    assert.equal(p.accepted, true, "the quest is now accepted");
    assert.equal(p.met, false, "the questee is not yet at the lighthouse, so not met");
  });

  await ok("accept refuses a quest already accepted", async () => {
    const r = await accept(world, "wanderer", "reach-the-lighthouse", "tick:1/accept-again");
    assert.equal(r.ok, false, "you cannot accept a charge already in hand");
    assert.equal(r.reason, "already accepted");
  });

  await ok("moving the questee into the area flips progressOf.met to true", async () => {
    await place("wanderer", "lighthouse-gallery", "tick:2/move");
    const p = await progressOf(world, "wanderer", "reach-the-lighthouse");
    assert.equal(p.met, true, "now located-in the lighthouse gallery, the objective is met");
  });

  await ok("complete grants the coin reward (coinOf rises) and marks the quest done", async () => {
    const before = await coinOf(world, "wanderer");
    const r = await complete(world, "wanderer", "reach-the-lighthouse", "tick:3/complete");
    assert.equal(r.ok, true, "completing a met, accepted quest succeeds");
    assert.equal(r.reward.coin, 30, "the lighthouse quest pays 30 pennies");
    const after = await coinOf(world, "wanderer");
    assert.equal(after, before + 30, "the questee's purse rises by the reward");
    const p = await progressOf(world, "wanderer", "reach-the-lighthouse");
    assert.equal(p.done, true, "the quest now reads done");
  });

  await ok("completing an already-done quest returns {ok:false}", async () => {
    const r = await complete(world, "wanderer", "reach-the-lighthouse", "tick:4/complete");
    assert.equal(r.ok, false, "a finished quest cannot be claimed twice");
    assert.equal(r.reason, "already done");
  });

  // --- gather-three-iron: met reads off carried material count ------------------------------
  await ok("a gather quest reads met only once the questee carries enough material", async () => {
    await accept(world, "wanderer", "gather-three-iron", "tick:5/accept");
    let p = await progressOf(world, "wanderer", "gather-three-iron");
    assert.equal(p.met, false, "with no iron carried, the gather objective is unmet");

    await mintMaterial("iron-ore-1", "iron", "wanderer", "tick:5/ore1");
    await mintMaterial("iron-ore-2", "iron", "wanderer", "tick:5/ore2");
    p = await progressOf(world, "wanderer", "gather-three-iron");
    assert.equal(p.met, false, "two of three iron is still not enough");

    await mintMaterial("iron-ore-3", "iron", "wanderer", "tick:5/ore3");
    p = await progressOf(world, "wanderer", "gather-three-iron");
    assert.equal(p.met, true, "carrying three iron items meets the gather objective");
  });

  await ok("completing the gather quest grants coin and reads in questsOf", async () => {
    const before = await coinOf(world, "wanderer");
    const r = await complete(world, "wanderer", "gather-three-iron", "tick:6/complete");
    assert.equal(r.ok, true);
    assert.equal(await coinOf(world, "wanderer"), before + 75, "iron quest pays 75 pennies");
    const mine = await questsOf(world, "wanderer");
    const iron = mine.find((q) => q.id === "gather-three-iron");
    assert.equal(iron.status, "done", "the completed gather quest reads done in questsOf");
  });

  await ok("the default export bundles the same API surface", async () => {
    assert.equal(typeof quest.offersOf, "function");
    assert.equal(typeof quest.accept, "function");
    assert.equal(typeof quest.complete, "function");
    assert.ok(quest.QUESTS["deliver-the-letter"], "the table is reachable off the default export");
  });

  console.log(`\n${pass} quest checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
