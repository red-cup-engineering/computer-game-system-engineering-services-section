// prove-director — the STORYTELLER/Director and FACTIONS (EPIC B). Builds a SMALL hand-made world
// in a UNIQUE /tmp dir: four npcs whose recorded opinions make TWO friend-clusters with a rival
// edge across them, plus a couple of resources. Drives factions()/factionOf()/tensionBetween()
// and worldTension()/direct() directly (no terminal). Same tiny harness as prove-interaction.mjs.
// Deterministic — same world → same reads, same single ambient append.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import doing from "#doing";

import factions, { factionOf, tensionBetween, interFactionTension } from "../being/doing/observing/factions/scripts/factions.mjs";
import { worldTension, direct } from "../being/doing/observing/directing/scripts/direct.mjs";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );

const tmp = mkdtempSync(join(tmpdir(), "tab-director-"));
const world = join(tmp, "town");

// seed — append a base intra-action at a monotone seed time, no agent attribution.
let seq = 0;
const seed = (subject, predicate, object) =>
  doing({ root: world, subject, predicate, object, t: `seed:${String(++seq).padStart(6, "0")}` });

// rowCount — total base + reified rows in a subject's log (to prove a SINGLE append).
const rowCount = (subject) => {
  const f = join(world, `${subject}.jsonl`);
  if (!existsSync(f)) return 0;
  return readFileSync(f, "utf8").split("\n").filter(Boolean).length;
};

try {
  // --- the population: four npcs in two friend-clusters {ann,bob} and {cat,dan}, ann↔cat rival.
  // Recorded opinions use the socialize convention: opinion-of:<other>=<stance>.
  for (const n of ["ann", "bob", "cat", "dan"]) await seed(n, "kind", "npc");

  // cluster 1: ann <-> bob friends
  await seed("ann", "opinion-of:bob", "friend");
  await seed("bob", "opinion-of:ann", "friend");
  // cluster 2: cat <-> dan friends
  await seed("cat", "opinion-of:dan", "friend");
  await seed("dan", "opinion-of:cat", "friend");
  // the rival edge ACROSS the two clusters
  await seed("ann", "opinion-of:cat", "rival");
  await seed("cat", "opinion-of:ann", "rival");

  // --- two resources, both HEALTHY to start (full amounts). -----------------------------------
  await seed("well", "kind", "resource");
  await seed("well", "provides", "need:rest");
  await seed("well", "amount", 9);
  await seed("orchard", "kind", "resource");
  await seed("orchard", "provides", "need:hunger");
  await seed("orchard", "amount", 7);

  // --- (a) factions: group the friends, separate the rivals; factionOf consistent --------------
  await ok("factions groups {ann,bob} and {cat,dan} as two separate factions", async () => {
    const fs = await factions(world);
    assert.equal(fs.length, 2, "two friend-clusters → two factions");
    assert.deepEqual(fs[0].members, ["ann", "bob"]);
    assert.deepEqual(fs[1].members, ["cat", "dan"]);
    assert.equal(fs[0].id, "faction:ann");
    assert.equal(fs[1].id, "faction:cat");
    // each pair is a single friend edge → cohesion 1.
    assert.equal(fs[0].cohesion, 1);
    assert.equal(fs[1].cohesion, 1);
  });

  await ok("factionOf is consistent with factions(): ann & bob together, cat & dan together", async () => {
    const fa = await factionOf(world, "ann");
    const fb = await factionOf(world, "bob");
    const fc = await factionOf(world, "cat");
    const fd = await factionOf(world, "dan");
    assert.equal(fa.id, fb.id, "ann and bob in the same faction");
    assert.equal(fc.id, fd.id, "cat and dan in the same faction");
    assert.notEqual(fa.id, fc.id, "ann and cat in different factions");
    assert.equal(await factionOf(world, "nobody"), null, "a non-npc is in no faction");
  });

  await ok("tensionBetween: ann↔cat is a cross-faction rival edge; ann↔bob is same-faction friends", async () => {
    const rivals = await tensionBetween(world, "ann", "cat");
    assert.equal(rivals.sameFaction, false);
    assert.equal(rivals.rivalEdge, true);
    assert.equal(rivals.friendEdge, false);
    const friends = await tensionBetween(world, "ann", "bob");
    assert.equal(friends.sameFaction, true);
    assert.equal(friends.friendEdge, true);
    assert.equal(friends.rivalEdge, false);
    // the rival edge crosses the two factions → counts as inter-faction tension.
    assert.equal(await interFactionTension(world), 1);
  });

  // --- (b) worldTension rises with depletion + low mood, falls when healthy --------------------
  await ok("worldTension: healthy world (full resources, no low mood) has LOW score", async () => {
    const wt = await worldTension(world);
    assert.equal(wt.scarcity, 0, "no depleted resources");
    assert.equal(wt.lowMood, 0, "npcs default to satisfied needs → content");
    // disputes = ⊤ cells (0 here) + inter-faction tension (1 rival edge).
    assert.equal(wt.disputes, 1);
    assert.ok(wt.score < 0.2, `quiet world score should be low, got ${wt.score}`);
  });

  let healthyScore;
  await ok("worldTension: depleting resources + crashing moods RAISES the score", async () => {
    healthyScore = (await worldTension(world)).score;
    // deplete both resources to the scarce floor.
    await seed("well", "amount", 0);
    await seed("orchard", "amount", 1);
    // crash every npc's needs so each mood band is breaking.
    for (const n of ["ann", "bob", "cat", "dan"]) {
      await seed(n, "need:hunger", 0);
      await seed(n, "need:rest", 0);
      await seed(n, "need:recreation", 0);
    }
    const wt = await worldTension(world);
    assert.equal(wt.scarcity, 1, "both resources depleted");
    assert.equal(wt.lowMood, 1, "all npcs strained/breaking");
    assert.ok(wt.score > healthyScore, `tense score ${wt.score} should exceed healthy ${healthyScore}`);
    assert.ok(wt.score > 0.7, `fully tense world score should be high, got ${wt.score}`);
  });

  await ok("worldTension: restoring resources + moods LOWERS the score again", async () => {
    await seed("well", "amount", 9);
    await seed("orchard", "amount", 7);
    for (const n of ["ann", "bob", "cat", "dan"]) {
      await seed(n, "need:hunger", 95);
      await seed(n, "need:rest", 95);
      await seed(n, "need:recreation", 95);
    }
    const wt = await worldTension(world);
    assert.equal(wt.scarcity, 0);
    assert.equal(wt.lowMood, 0);
    assert.ok(wt.score < 0.2, `restored world score should be low again, got ${wt.score}`);
  });

  // --- (c) direct: QUIET world → exactly ONE seeding append; TENSE world → nothing -------------
  await ok("direct on a QUIET world seeds exactly ONE tension (a single append)", async () => {
    // world is currently quiet (resources full, moods high, score < target band).
    const before = await worldTension(world);
    assert.ok(before.score < 0.25, `precondition: quiet, got ${before.score}`);
    const wellBefore = rowCount("well");
    const orchardBefore = rowCount("orchard");

    const { tension, intervention } = await direct({ root: world, t: "tick:000001/direct:000001" });
    assert.deepEqual(tension, before, "tension is the read taken before intervening");
    assert.ok(intervention != null, "the quiet world earns an intervention");
    assert.equal(intervention.kind, "spoil", "the minimal seed is a resource spoil");
    // exactly ONE base append landed (no agent attribution counted: doing files base + enacted-by;
    // assert the spoiled resource gained EXACTLY the rows of one attributed append: base + reified).
    const wellAfter = rowCount("well");
    const orchardAfter = rowCount("orchard");
    const touched = (wellAfter - wellBefore) + (orchardAfter - orchardBefore);
    assert.equal(touched, 2, "one attributed append = one base row + one enacted-by row");
    // and it raised the pressure.
    const after = await worldTension(world);
    assert.ok(after.score >= before.score, "the seed did not lower tension");
  });

  await ok("direct on a TENSE world does NOTHING (no append)", async () => {
    // make the world tense again.
    await seed("well", "amount", 0);
    await seed("orchard", "amount", 0);
    for (const n of ["ann", "bob", "cat", "dan"]) {
      await seed(n, "need:hunger", 0);
      await seed(n, "need:rest", 0);
      await seed(n, "need:recreation", 0);
    }
    const tenseScore = (await worldTension(world)).score;
    assert.ok(tenseScore > 0.45, `precondition: tense, got ${tenseScore}`);
    const counts = ["well", "orchard", "ann", "bob", "cat", "dan"].map(rowCount);

    const { intervention } = await direct({ root: world, t: "tick:000002/direct:000001" });
    assert.equal(intervention, null, "a tense world is left to play out");
    const after = ["well", "orchard", "ann", "bob", "cat", "dan"].map(rowCount);
    assert.deepEqual(after, counts, "no append on any entity");
  });

  await ok("direct is DETERMINISTIC: same quiet world + same t → same intervention", async () => {
    // a fresh quiet world.
    const w2 = join(tmp, "town2");
    let s2 = 0;
    const seed2 = (subject, predicate, object) =>
      doing({ root: w2, subject, predicate, object, t: `seed:${String(++s2).padStart(6, "0")}` });
    await seed2("pond", "kind", "resource");
    await seed2("pond", "amount", 6);
    await seed2("grove", "kind", "resource");
    await seed2("grove", "amount", 4);
    await seed2("eve", "kind", "npc");
    await seed2("eve", "need:hunger", 95);

    const a = await direct({ root: w2, t: "tick:000001/direct:000001" });
    // a second identical quiet world driven the same way yields the same intervention shape.
    const w3 = join(tmp, "town3");
    let s3 = 0;
    const seed3 = (subject, predicate, object) =>
      doing({ root: w3, subject, predicate, object, t: `seed:${String(++s3).padStart(6, "0")}` });
    await seed3("pond", "kind", "resource");
    await seed3("pond", "amount", 6);
    await seed3("grove", "kind", "resource");
    await seed3("grove", "amount", 4);
    await seed3("eve", "kind", "npc");
    await seed3("eve", "need:hunger", 95);
    const b = await direct({ root: w3, t: "tick:000001/direct:000001" });

    assert.equal(a.intervention.kind, b.intervention.kind);
    assert.equal(a.intervention.subject, b.intervention.subject, "same resource chosen (healthiest = pond)");
    assert.equal(a.intervention.object, b.intervention.object, "same depleted amount");
    assert.equal(a.intervention.subject, "pond", "the healthiest resource (amount 6) is spoiled first");
    assert.equal(a.intervention.object, 4, "pond 6 → 4 (spoilBy 2)");
  });

  console.log(`\n${pass} director checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
