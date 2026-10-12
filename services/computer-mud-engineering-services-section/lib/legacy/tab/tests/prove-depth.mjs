// prove-depth — the DEPTH systems: health (body-part capacities, injury, healing), social
// relationships (opinion as composing fibers), and item-quality bonus. Builds a small temp world
// in a UNIQUE /tmp dir and drives the new modules directly. Same tiny harness as the other proofs.
// New modules are imported by RELATIVE path; substrate/doing via the existing #aliases.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import doing from "#doing";

import health, { healthOf, injure, heal } from "../being/doing/observing/health/scripts/health.mjs";
import opinion, { socialize, relationshipsOf, opinionPredicate } from "../being/doing/responding/socializing/scripts/socialize.mjs";
import qualityBonus, { qualityOf } from "../being/library/value/library/richness/library/quality/scripts/quality.mjs";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );

const tmp = mkdtempSync(join(tmpdir(), "tab-depth-"));
const world = join(tmp, "depth");

// seed — a tiny deterministic helper to file a cell (no agent) at a stamped t.
let seq = 0;
const seed = (subject, predicate, object) =>
  doing({ root: world, subject, predicate, object, t: `seed:${String(++seq).padStart(6, "0")}` });

try {
  // --- build a small cast --------------------------------------------------------------------
  // An NPC, a partner who shares traits, a foe whose traits the NPC dislikes, and a tool.
  await seed("mara", "kind", "npc");
  await seed("mara", "located-in", "the-yard");
  await seed("mara", "disposition", "warm");
  await seed("mara", "trait", "brave");
  await seed("mara", "trait", "kind");
  await seed("mara", "dislikes", "cruel");

  await seed("jen", "kind", "npc");
  await seed("jen", "disposition", "warm");
  await seed("jen", "trait", "brave");      // shares "brave" with mara → warm pull
  await seed("jen", "trait", "kind");        // shares "kind" too

  await seed("rex", "kind", "npc");
  await seed("rex", "disposition", "cold");  // clashes with mara's warm → cold pull
  await seed("rex", "trait", "cruel");        // mara dislikes "cruel" → cold pull

  await seed("a-good-knife", "kind", "item");
  await seed("a-good-knife", "quality", 80);
  await seed("a-plain-knife", "kind", "item");
  await seed("a-plain-knife", "quality", 20);
  await seed("a-bare-stick", "kind", "item"); // no quality cell

  // ============================================================================================
  // (a) HEALTH — capacities derived from injuries; injure/heal change them; vital → death.
  // ============================================================================================
  await ok("health: an unhurt NPC has full capacities and is alive", async () => {
    const h = await healthOf(world, "mara");
    assert.deepEqual(h.capacities, { moving: 100, manipulation: 100, sight: 100 });
    assert.deepEqual(h.injuries, []);
    assert.equal(h.alive, true);
  });

  await ok("health: a leg injury reduces `moving` (and only moving), NPC still alive", async () => {
    await injure({ root: world, agent: "fate", subject: "mara", part: "leg", severity: 4, t: "seed:100001" });
    const h = await healthOf(world, "mara");
    assert.equal(h.capacities.moving, 60, "severity-4 leg → 100 - 40 = 60% moving");
    assert.equal(h.capacities.manipulation, 100, "leg does not serve manipulation");
    assert.equal(h.capacities.sight, 100, "leg does not serve sight");
    assert.deepEqual(h.injuries, [{ part: "leg", severity: 4 }]);
    assert.equal(h.alive, true);
  });

  await ok("health: pure health(thing) derives the same from a hand-built fiber", async () => {
    const h = health({ entity: "x", fiber: [
      { predicate: "injury:eye", object: 3, value: { pos: 1, neg: 0, glyph: "t" } },
    ] });
    assert.equal(h.capacities.sight, 70, "severity-3 eye → 70% sight");
    assert.equal(h.capacities.moving, 100);
  });

  await ok("health: heal lowers severity, restoring the capacity (append-only)", async () => {
    await heal({ root: world, subject: "mara", part: "leg", by: 2, t: "seed:100002" });
    let h = await healthOf(world, "mara");
    assert.equal(h.capacities.moving, 80, "severity 4 → 2 → 100 - 20 = 80% moving");
    await heal({ root: world, subject: "mara", part: "leg", t: "seed:100003" }); // clear fully
    h = await healthOf(world, "mara");
    assert.equal(h.capacities.moving, 100, "fully healed leg → 100% moving");
    assert.deepEqual(h.injuries, [], "no live wounds after full heal");
  });

  await ok("health: a destroyed VITAL part (torso severity 10) → alive=false", async () => {
    await injure({ root: world, agent: "fate", subject: "rex", part: "torso", severity: 10, t: "seed:100004" });
    const h = await healthOf(world, "rex");
    assert.equal(h.capacities.moving, 0, "torso destroyed → 0% moving");
    assert.equal(h.capacities.manipulation, 0, "torso destroyed → 0% manipulation");
    assert.equal(h.alive, false, "a vital capacity at 0 is death");
  });

  // ============================================================================================
  // (b) SOCIAL — opinion as composing fibers: shared→friend, opposed→rival, both→ambivalent(⊤).
  // ============================================================================================
  await ok("opinion: two NPCs sharing traits → friend (t)", async () => {
    const { settle } = await import("#substrate");
    const mara = await settle(world, "mara");
    const jen = await settle(world, "jen");
    const op = opinion(mara, jen);
    assert.equal(op.stance, "friend");
    assert.equal(op.glyph, "t");
    assert.ok(op.basis.shared.includes("brave") && op.basis.shared.includes("kind"));
  });

  await ok("opinion: opposed traits / clashing disposition → rival (f)", async () => {
    const { settle } = await import("#substrate");
    const mara = await settle(world, "mara");
    const rex = await settle(world, "rex");
    const op = opinion(mara, rex);
    assert.equal(op.stance, "rival");
    assert.equal(op.glyph, "f");
    assert.ok(op.basis.opposed.includes("cruel"), "mara dislikes rex's `cruel` trait");
  });

  await ok("opinion: warm-AND-cold evidence → ambivalent (⊤)", async () => {
    // pat shares a trait with mara (warm pull) AND holds one mara dislikes (cold pull) → ⊤.
    await seed("pat", "kind", "npc");
    await seed("pat", "trait", "brave"); // shared with mara → warm
    await seed("pat", "trait", "cruel");  // mara dislikes → cold
    const { settle } = await import("#substrate");
    const mara = await settle(world, "mara");
    const pat = await settle(world, "pat");
    const op = opinion(mara, pat);
    assert.equal(op.stance, "ambivalent");
    assert.equal(op.glyph, "⊤");
  });

  await ok("opinion: strangers with no shared/opposed signal → neutral (⊥)", async () => {
    await seed("stranger", "kind", "npc"); // no disposition, no traits
    const { settle } = await import("#substrate");
    const mara = await settle(world, "mara");
    const stranger = await settle(world, "stranger");
    const op = opinion(mara, stranger);
    assert.equal(op.stance, "neutral");
    assert.equal(op.glyph, "⊥");
  });

  await ok("socialize: files opinion-of:<b> on A and relationshipsOf lists it", async () => {
    const { opinion: op } = await socialize({ root: world, a: "mara", b: "jen", t: "seed:200001" });
    assert.equal(op.stance, "friend");
    const { settle } = await import("#substrate");
    const mara = await settle(world, "mara");
    const cell = mara.fiber.find((c) => c.predicate === opinionPredicate("jen"));
    assert.ok(cell, "opinion-of:jen cell exists on mara");
    assert.equal(cell.object, "friend");

    await socialize({ root: world, a: "mara", b: "rex", t: "seed:200002" });
    const rels = await relationshipsOf(world, "mara");
    const jenRel = rels.find((r) => r.other === "jen");
    const rexRel = rels.find((r) => r.other === "rex");
    assert.equal(jenRel.stance, "friend");
    assert.equal(rexRel.stance, "rival");
  });

  // ============================================================================================
  // (c) QUALITY — qualityBonus scales 0..1 with the item's quality cell.
  // ============================================================================================
  await ok("quality: qualityBonus scales with the quality cell (80 → 0.8, 20 → 0.2)", async () => {
    assert.equal(await qualityOf(world, "a-good-knife"), 0.8);
    assert.equal(await qualityOf(world, "a-plain-knife"), 0.2);
  });

  await ok("quality: an unmarked item gives no bonus (0)", async () => {
    assert.equal(await qualityOf(world, "a-bare-stick"), 0);
  });

  await ok("quality: pure qualityBonus clamps to [0,1]", async () => {
    assert.equal(qualityBonus({ entity: "x", fiber: [
      { predicate: "quality", object: 150, value: { pos: 1, neg: 0, glyph: "t" } },
    ] }), 1, "over-100 clamps to 1");
    assert.equal(qualityBonus({ entity: "x", fiber: [] }), 0, "no cell → 0");
  });

  console.log(`\n${pass} depth checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
