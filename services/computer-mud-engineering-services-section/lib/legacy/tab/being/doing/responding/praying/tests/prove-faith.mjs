// prove-faith — FAITH: gods, devotion, and ritual as predication on a settled actor. Builds a tiny
// world by hand in a UNIQUE /tmp dir (no examples, no Farstone), drives the praying morphisms
// directly, and asserts the faith properties: worshipping a deity records it; praying raises piety
// AND teaches faith.devotion; with enough piety + faith.rituals training a blessing ritual gives
// the invoker the 'blessed' condition; an under-funded invoke is refused without writing; a curse
// ritual lands its condition on a TARGET; lay-on-hands heals a wounded target (capacity improves).
//
// `#faith` is NOT a registered alias — import pray.mjs by RELATIVE path. Standalone:
// run `node being/doing/responding/praying/tests/prove-faith.mjs`.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import doing from "#doing";
import { conditionsOf } from "#conditions";
import { healthOf, injure } from "#health";
import { bonusOf } from "#proficiency";
import practice from "#practicing";

import invoke, {
  worship, pray, pietyOf, deityOf,
  listDeities, listRituals, DEITIES, RITUALS,
  PIETY_STEP, DEVOTION_SKILL, RITUAL_SKILL,
} from "../scripts/pray.mjs";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );

const tmp = mkdtempSync(join(tmpdir(), "tab-faith-"));
const world = join(tmp, "w");

// seed an actor as a player with a name; give wis 10 (baseline) unless overridden.
const seed = async (who, t) => {
  await doing({ root: world, subject: who, predicate: "kind", object: "player", t: `${t}a` });
  await doing({ root: world, subject: who, predicate: "naming", object: who, t: `${t}b` });
};

// teach faith.rituals to a given bonus by filing N success rows (bonus = taught*5 at wis 10).
const trainRituals = async (who, teaches, t) => {
  for (let i = 0; i < teaches; i++) {
    await practice({ root: world, actor: who, skill: RITUAL_SKILL, outcome: "success", t: `${t}:${i}` });
  }
};

try {
  await seed("priest", "seed:000001");
  await seed("acolyte", "seed:000002");
  await seed("heretic", "seed:000003");

  // --- catalogs ------------------------------------------------------------------------------
  await ok("the catalogs are non-empty and self-consistent", async () => {
    assert.ok(Object.keys(DEITIES).length >= 6, "at least six deities");
    assert.ok(Object.keys(RITUALS).length >= 6, "at least six rituals");
    assert.equal(listDeities().length, Object.keys(DEITIES).length);
    assert.equal(listRituals().length, Object.keys(RITUALS).length);
    // every deity's blessing/curse is a real condition name (afflict would throw otherwise).
    for (const d of Object.values(DEITIES)) {
      assert.equal(typeof d.blessing, "string");
      assert.equal(typeof d.curse, "string");
    }
  });

  // --- worship records a deity ---------------------------------------------------------------
  await ok("worship records the worshipped deity; an unknown deity throws", async () => {
    assert.equal(await deityOf(world, "priest"), null, "starts worshipping no one");
    await worship(world, "priest", "Maraset", "seed:000010");
    assert.equal(await deityOf(world, "priest"), "Maraset");
    await assert.rejects(() => worship(world, "priest", "Nobody", "seed:000011"));
  });

  // --- pray raises piety AND teaches faith.devotion ------------------------------------------
  await ok("pray raises piety by a step and files a faith.devotion success", async () => {
    assert.equal(await pietyOf(world, "priest"), 0, "no prayer yet ⇒ piety 0");
    const before = await bonusOf(world, "priest", DEVOTION_SKILL);
    const r1 = await pray(world, "priest", "tick:1/pray:1");
    assert.equal(r1.piety, PIETY_STEP, "one prayer raises piety by PIETY_STEP");
    assert.equal(await pietyOf(world, "priest"), PIETY_STEP);
    const after = await bonusOf(world, "priest", DEVOTION_SKILL);
    assert.ok(after > before, "praying teaches faith.devotion (bonus rises)");
    const r2 = await pray(world, "priest", "tick:1/pray:2");
    assert.equal(r2.piety, PIETY_STEP * 2, "a second prayer stacks");
  });

  // --- a blessing ritual gives the invoker the blessed condition ------------------------------
  await ok("invoke benediction: enough piety + training ⇒ invoker gains 'blessed'", async () => {
    // train the ritual hand and build piety.
    await trainRituals("priest", 3, "seed:000100"); // bonus 15 ≥ any need we use
    for (let i = 0; i < 6; i++) await pray(world, "priest", `tick:2/pray:${i}`); // +30 piety
    const pietyBefore = await pietyOf(world, "priest");
    const res = await invoke(world, "priest", "benediction", null, "tick:3/inv:1");
    assert.equal(res.ok, true, "the rite succeeds");
    assert.equal(res.effect.kind, "bless");
    const conds = await conditionsOf(world, "priest");
    assert.ok(conds.some((c) => c.name === "blessed" && c.intensity > 0), "invoker is now blessed");
    // piety was debited by the ritual cost.
    assert.equal(await pietyOf(world, "priest"), pietyBefore - RITUALS.benediction.cost, "piety debited");
  });

  // --- insufficient piety is refused without writing ------------------------------------------
  await ok("invoke with insufficient piety ⇒ { ok:false } and no debit", async () => {
    await trainRituals("acolyte", 3, "seed:000200"); // trained enough...
    await pray(world, "acolyte", "tick:4/pray:1"); // ...but only 5 piety
    const before = await pietyOf(world, "acolyte");
    const res = await invoke(world, "acolyte", "lay-on-hands", null, "tick:5/inv:1"); // cost 15
    assert.equal(res.ok, false, "the rite is refused");
    assert.match(res.reason, /piety/, "the reason cites piety");
    assert.equal(await pietyOf(world, "acolyte"), before, "piety untouched on a failed invoke");
  });

  // --- untrained hand is refused even with piety ----------------------------------------------
  await ok("invoke without faith.rituals training ⇒ { ok:false }", async () => {
    // heretic has piety but NO ritual training (bonus 0 < smite's need).
    for (let i = 0; i < 6; i++) await pray(world, "heretic", `tick:6/pray:${i}`); // +30 piety
    const res = await invoke(world, "heretic", "smite", "priest", "tick:7/inv:1");
    assert.equal(res.ok, false, "an untrained hand cannot smite");
    assert.match(res.reason, /untrained|rituals/, "the reason cites training");
  });

  // --- a curse ritual lands its condition on a TARGET -----------------------------------------
  await ok("invoke a curse on a target ⇒ target gains the curse condition", async () => {
    // priest curses the acolyte; the curse ritual lays 'afraid'.
    const res = await invoke(world, "priest", "curse", "acolyte", "tick:8/inv:1");
    assert.equal(res.ok, true, "the curse succeeds");
    assert.equal(res.effect.kind, "curse");
    const target = await conditionsOf(world, "acolyte");
    assert.ok(
      target.some((c) => c.name === RITUALS.curse.effect.condition && c.intensity > 0),
      "the target now suffers the curse condition",
    );
  });

  // --- lay-on-hands heals a wounded target ----------------------------------------------------
  await ok("lay-on-hands heals a wounded target (capacity improves)", async () => {
    // wound the acolyte's leg, then heal them with lay-on-hands. Stamps are zero-padded so
    // lexical t-order matches event order (the heal must supersede the wound).
    await injure({ root: world, subject: "acolyte", part: "leg", severity: 6, t: "tick:09/wound:1" });
    const hurt = await healthOf(world, "acolyte");
    assert.ok(hurt.capacities.moving < 100, "the acolyte's moving capacity is impaired");

    // give the priest enough piety + training for lay-on-hands (cost 15, need 10).
    for (let i = 0; i < 6; i++) await pray(world, "priest", `tick:10/pray:${i}`); // top up piety
    const res = await invoke(world, "priest", "lay-on-hands", "acolyte", "tick:11/inv:1");
    assert.equal(res.ok, true, "the healing rite succeeds");
    assert.equal(res.effect.kind, "heal");

    const mended = await healthOf(world, "acolyte");
    assert.ok(mended.capacities.moving > hurt.capacities.moving, "the wound is mended (moving improves)");
    assert.equal(mended.capacities.moving, 100, "lay-on-hands clears the wound entirely");
  });

  console.log(`\n${pass} faith checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
