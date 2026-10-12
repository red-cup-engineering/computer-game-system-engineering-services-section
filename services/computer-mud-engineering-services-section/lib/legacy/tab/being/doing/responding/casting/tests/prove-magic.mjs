// prove-magic — MAGIC: spellcasting as a responding move. Builds a tiny world by hand in a UNIQUE
// /tmp dir (no examples, no fixtures), drives the casting morphism directly, and asserts the
// spellcasting properties: a known spell with mana and school-bonus enough LANDS its effect and
// DEBITS mana; too little mana fails without changing the world; an unlearned/unknown spell fails;
// a self-spell (shield) afflicts the CASTER; manaOf defaults from int when no mana cell exists.
//
// Same tiny harness shape as prove-comms.mjs. Standalone: run `node tests/prove-magic.mjs`.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import doing from "#doing";
import { healthOf } from "#health";
import { conditionsOf } from "#conditions";

import cast, {
  learn,
  spellsKnown,
  manaOf,
  listSpells,
  SPELLS,
} from "../scripts/cast.mjs";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );

const tmp = mkdtempSync(join(tmpdir(), "tab-magic-"));
const world = join(tmp, "w");

// teach — file a positive skill:<path> success row directly (the practicing convention: a success
// affirms the skill cell). One teach is enough here; the mage's int edge carries the rest.
const teach = (who, path, t) =>
  doing({ root: world, subject: who, predicate: `skill:${path}`, object: path, t });

// make an actor a `mover` with the given int and a torso (so it can be a caster / a target).
const actor = async (who, int, t) => {
  await doing({ root: world, subject: who, predicate: "kind", object: "player", t: `${t}a` });
  await doing({ root: world, subject: who, predicate: "naming", object: who, t: `${t}b` });
  await doing({ root: world, subject: who, predicate: "mover", object: true, t: `${t}c` });
  await doing({ root: world, subject: who, predicate: "attr:int", object: int, t: `${t}d` });
};

try {
  // A caster: int 14, a learned fireball, the evocation school taught once. A target dummy.
  await actor("mage", 14, "seed:000001");
  await actor("goblin", 10, "seed:000002");
  await teach("mage", "magic.evocation", "seed:000010");
  await teach("mage", "magic.healing", "seed:000011");
  await learn(world, "mage", "fireball", "seed:000020");
  await learn(world, "mage", "shield", "seed:000021");
  // give the mage an explicit mana pool of 20.
  await doing({ root: world, subject: "mage", predicate: "mana", object: 20, t: "seed:000030" });

  // --- listSpells / catalog ---------------------------------------------------------------
  await ok("listSpells returns the catalog with school/cost/need/effect", async () => {
    const spells = listSpells();
    assert.equal(spells, SPELLS);
    assert.ok(Object.keys(spells).length >= 12, "the catalog has at least a dozen spells");
    for (const [name, spec] of Object.entries(spells)) {
      assert.ok(spec.school.startsWith("magic."), `${name} names a magic.* school`);
      assert.equal(typeof spec.cost, "number");
      assert.equal(typeof spec.need, "number");
      assert.ok(["harm", "heal", "afflict", "reveal"].includes(spec.effect.kind), `${name} effect kind`);
    }
  });

  // --- learn / spellsKnown ----------------------------------------------------------------
  await ok("spellsKnown lists the learned spells", async () => {
    const known = await spellsKnown(world, "mage");
    assert.deepEqual(known, ["fireball", "shield"]);
    assert.deepEqual(await spellsKnown(world, "goblin"), [], "goblin knows nothing");
  });

  // --- fireball lands an injury AND debits mana -------------------------------------------
  await ok("cast fireball at the target lands a wound and debits mana", async () => {
    const before = await manaOf(world, "mage");
    assert.equal(before, 20, "mage starts with the explicit pool of 20");
    const out = await cast(world, "mage", "fireball", "goblin", "tick:1/cast:1");
    assert.equal(out.ok, true, out.reason);
    assert.equal(out.spell, "fireball");
    // the target now shows a torso wound.
    const health = await healthOf(world, "goblin");
    assert.ok(health.injuries.some((i) => i.part === "torso" && i.severity > 0), "goblin has a torso wound");
    // mana debited by the spell's cost.
    const after = await manaOf(world, "mage");
    assert.equal(after, 20 - SPELLS.fireball.cost, "mana debited by fireball's cost");
    assert.equal(out.mana, after, "returned mana matches the new pool");
  });

  // --- too little mana fails, changes nothing ---------------------------------------------
  await ok("cast with mana below cost returns { ok:false, reason } and changes nothing", async () => {
    // drain the mage to 1 mana — below any spell's cost.
    await doing({ root: world, subject: "mage", predicate: "mana", object: 1, t: "tick:2/drain:1" });
    const healthBefore = await healthOf(world, "goblin");
    const out = await cast(world, "mage", "fireball", "goblin", "tick:2/cast:1");
    assert.equal(out.ok, false, "casting with too little mana fails");
    assert.match(out.reason, /mana/, "the reason names mana");
    assert.equal(await manaOf(world, "mage"), 1, "mana untouched on a failed cast");
    const healthAfter = await healthOf(world, "goblin");
    assert.deepEqual(healthAfter.injuries, healthBefore.injuries, "target unharmed on a failed cast");
  });

  // --- an unlearned / unknown spell fails -------------------------------------------------
  await ok("cast an unlearned spell fails; cast an unknown spell fails", async () => {
    // refill mana so the failure is purely about knowledge, not fuel.
    await doing({ root: world, subject: "mage", predicate: "mana", object: 20, t: "tick:3/refill:1" });
    const unlearned = await cast(world, "mage", "mend", "mage", "tick:3/cast:1");
    assert.equal(unlearned.ok, false, "mage never learned mend");
    assert.match(unlearned.reason, /learned/);
    const unknown = await cast(world, "mage", "wingardium", "goblin", "tick:3/cast:2");
    assert.equal(unknown.ok, false, "no such spell");
    assert.match(unknown.reason, /no such spell/);
  });

  // --- shield (self) afflicts the CASTER --------------------------------------------------
  await ok("cast shield (self-target) afflicts the caster with 'blessed'", async () => {
    const out = await cast(world, "mage", "shield", null, "tick:4/cast:1");
    assert.equal(out.ok, true, out.reason);
    const conds = await conditionsOf(world, "mage");
    assert.ok(conds.some((c) => c.name === "blessed" && c.intensity > 0), "mage is blessed");
  });

  // --- manaOf defaults from int when no mana cell exists ----------------------------------
  await ok("manaOf defaults to attr:int * 2 when no mana cell was ever filed", async () => {
    await actor("apprentice", 12, "seed:000100"); // int 12, never filed a mana cell
    assert.equal(await manaOf(world, "apprentice"), 24, "default pool is int*2 = 24");
  });

  console.log(`\n${pass} magic checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
