// prove-arsenal — the PURE equipment reads #arsenal folds into combat: what an actor wields, wears,
// and intends. Builds a tiny world by hand in a UNIQUE /tmp dir (no examples, no fixtures), files
// equipment cells directly via #doing, and asserts the agential-realist properties: a wielded weapon
// surfaces its damage/skill; armour worn on a part sums its protection there; tactics default to
// neutral/dodge; an unwielded actor reads UNARMED with zero armour; re-wielding supersedes (latest
// wins). All reads are pure — no RNG, no Date, deterministic content.
//
// Same tiny harness as prove-comms.mjs. Standalone: run `node tests/prove-arsenal.mjs`.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import doing from "#doing";

import combatProfile, {
  wieldedOf,
  wornOf,
  tacticsOf,
  weaponStats,
  armorByPart,
  UNARMED,
  DEFAULT_TACTICS,
} from "../being/doing/responding/fighting/library/arsenal/scripts/arsenal.mjs";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );

const tmp = mkdtempSync(join(tmpdir(), "tab-arsenal-"));
const world = join(tmp, "w");

// file one cell on a subject (a plain `changing` via #doing).
const cell = (subject, predicate, object, t) =>
  doing({ root: world, subject, predicate, object, t });

try {
  // --- a sword item: damage 12, skill fighting.melee.sword, weight 4 ------------------------
  await cell("sword", "kind", "weapon", "seed:000001");
  await cell("sword", "weapon-damage", 12, "seed:000002");
  await cell("sword", "weapon-skill", "fighting.melee.sword", "seed:000003");
  await cell("sword", "weight", 4, "seed:000004");

  // --- a breastplate: protection 8, covers torso -------------------------------------------
  await cell("breastplate", "kind", "armor", "seed:000010");
  await cell("breastplate", "armor-protection", 8, "seed:000011");
  await cell("breastplate", "armor-covers", "torso", "seed:000012");

  // --- a knight: wields the sword, wears the breastplate on the torso, attacks offensively --
  await cell("knight", "kind", "player", "seed:000020");
  await cell("knight", "wielding", "sword", "seed:000021");
  await cell("knight", "wearing:torso", "breastplate", "seed:000022");
  await cell("knight", "tactics:attack", "offensive", "seed:000023");

  // --- weaponStats reads the weapon item's cells -------------------------------------------
  await ok("weaponStats reads damage, skill, and weight off the weapon item", async () => {
    const s = await weaponStats(world, "sword");
    assert.equal(s.id, "sword");
    assert.equal(s.damage, 12);
    assert.equal(s.skill, "fighting.melee.sword");
    assert.equal(s.weight, 4);
  });

  // --- wieldedOf / wornOf / tacticsOf read the actor's loadout ------------------------------
  await ok("wieldedOf returns the wielded weapon id", async () => {
    assert.equal(await wieldedOf(world, "knight"), "sword");
  });

  await ok("wornOf maps each worn part to its armour item id", async () => {
    const worn = await wornOf(world, "knight");
    assert.equal(worn.torso, "breastplate");
    assert.equal(worn.leg, undefined, "an unworn part carries no entry");
  });

  await ok("tacticsOf reports the chosen attack with a defaulted defense", async () => {
    const t = await tacticsOf(world, "knight");
    assert.equal(t.attack, "offensive", "the declared attack stance");
    assert.equal(t.defense, DEFAULT_TACTICS.defense, "defense defaults to dodge");
    assert.equal(t.defense, "dodge");
  });

  // --- armorByPart sums protection on the covered part, zero elsewhere ----------------------
  await ok("armorByPart totals torso protection at 8 and leaves other parts at 0", async () => {
    const a = await armorByPart(world, "knight");
    assert.equal(a.torso, 8);
    assert.equal(a.leg, 0);
    assert.equal(a.arm, 0);
    assert.equal(a.eye, 0);
  });

  // --- combatProfile assembles the whole loadout -------------------------------------------
  await ok("combatProfile reports weapon 12/skill, torso armour 8, offensive/dodge tactics", async () => {
    const p = await combatProfile(world, "knight");
    assert.equal(p.weapon.id, "sword");
    assert.equal(p.weapon.damage, 12);
    assert.equal(p.weapon.skill, "fighting.melee.sword");
    assert.equal(p.weaponWeight, 4, "the weapon's weight surfaces alongside the weapon face");
    assert.equal(p.armorByPart.torso, 8);
    assert.equal(p.armorByPart.leg, 0);
    assert.equal(p.tactics.attack, "offensive");
    assert.equal(p.tactics.defense, "dodge");
  });

  // --- a bare actor reads UNARMED, zero armour, default tactics -----------------------------
  await ok("an unequipped actor is UNARMED with all-zero armour and neutral/dodge tactics", async () => {
    await cell("peasant", "kind", "player", "seed:000030");
    const p = await combatProfile(world, "peasant");
    assert.equal(p.weapon.id, UNARMED.id);
    assert.equal(p.weapon.id, null);
    assert.equal(p.weapon.damage, 2, "UNARMED damage is 2");
    assert.equal(p.weapon.skill, "fighting.melee.unarmed", "UNARMED skill");
    assert.equal(p.weaponWeight, 0, "an empty hand has no weight");
    assert.equal(p.armorByPart.leg, 0);
    assert.equal(p.armorByPart.arm, 0);
    assert.equal(p.armorByPart.eye, 0);
    assert.equal(p.armorByPart.torso, 0);
    assert.equal(p.tactics.attack, "neutral", "default attack stance");
    assert.equal(p.tactics.defense, "dodge", "default defense stance");
  });

  // --- re-wielding supersedes: latest weapon wins ------------------------------------------
  await ok("re-wielding a second weapon supersedes (latest wins)", async () => {
    await cell("axe", "kind", "weapon", "seed:000040");
    await cell("axe", "weapon-damage", 15, "seed:000041");
    await cell("axe", "weapon-skill", "fighting.melee.axe", "seed:000042");
    await cell("axe", "weight", 6, "seed:000043");
    // the knight drops the sword and takes up the axe at a LATER tick.
    await cell("knight", "wielding", "axe", "seed:000099");
    assert.equal(await wieldedOf(world, "knight"), "axe", "the latest wielding supersedes");
    const p = await combatProfile(world, "knight");
    assert.equal(p.weapon.id, "axe");
    assert.equal(p.weapon.damage, 15, "the axe's damage, not the sword's");
    assert.equal(p.weapon.skill, "fighting.melee.axe");
    assert.equal(p.weaponWeight, 6);
    // armour and tactics are untouched by the re-wield.
    assert.equal(p.armorByPart.torso, 8);
    assert.equal(p.tactics.attack, "offensive");
  });

  console.log(`\n${pass} arsenal checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
