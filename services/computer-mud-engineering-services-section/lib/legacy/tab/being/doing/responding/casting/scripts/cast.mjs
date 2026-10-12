// casting — SPELLCASTING as an intra-action. `casting/` nests under `responding/` beside
// `fighting`, `crafting`, and `socializing`: like those, it is a MOVE an actor RESPONDS with —
// it reads the actor's settled proficiency/resources, decides whether the act is afforded, and
// (if so) appends the cells that change the world. Nothing here is random; a spell is a pure
// function of the caster's mana, the school bonus, and the target's body — severity/intensity in,
// world-change out — mirroring health's injuries and conditions' afflictions.
//
// A spell COSTS mana (the caster's spell-fuel) and GATES on the magic-school bonus. The shared
// cell model (see proficiency.mjs, conditions.mjs, health.mjs) is reused wholesale:
//   - `mana`            : a FUNCTIONAL int cell, the caster's spell-fuel pool. When no mana cell
//                         has ever been filed, the pool DEFAULTS to attr:int * 2 — an unspent mage
//                         walks in with a full reservoir derived from intelligence.
//   - `knows-spell:<n>` : a FUNCTIONAL (by prefix) marker that the caster has LEARNED spell n.
//   - magic-school bonus: `#proficiency.bonusOf(root, caster, school)` over the `magic.*` tree
//                         (magic.evocation, magic.healing, magic.illusion, …) — the taught depth
//                         plus the int edge. A spell's `need` is the minimum bonus to cast it.
//
// A spell's EFFECT is one of four kinds, each delegated to an EXISTING system (we add no column):
//   {kind:"harm",    severity, part}        — injure the target a part        (#health.injure)
//   {kind:"heal",    part|"*"}              — heal the target a part, or all    (#health.heal)
//   {kind:"afflict", condition, intensity}  — afflict caster/target a condition (#conditions.afflict)
//   {kind:"reveal"}                         — read the target's wounds/conditions (NO world change)
// A self-target spell (shield, haste) afflicts the CASTER when no target is given.
//
// cast(root, caster, spellName, target=null, t) — the DEFAULT export. Requires (1) the caster
//   KNOWS the spell, (2) manaOf(caster) ≥ cost, (3) bonusOf(caster, school) ≥ need. On success it
//   DEBITS mana (files a fresh, lower mana cell — append-only, latest-t supersedes), applies the
//   effect, and returns { ok:true, spell, effect, result }. On any failure it changes NOTHING and
//   returns { ok:false, reason }. Deterministic: t is stamped from the passed value; no Date/RNG.
//
// learn(root, caster, spellName, t)  — file a knows-spell:<name> marker (the caster learns it).
// spellsKnown(root, caster)          — the sorted list of learned spell names.
// manaOf(root, caster)               — current mana pool (latest mana cell, or attr:int*2 default).
// listSpells()                       — the SPELLS catalog (name -> spec).

import { rowsFor } from "#substrate";
import doing from "#doing";
import { injure, heal, healthOf } from "#health";
import { afflict, conditionsOf } from "#conditions";
import { bonusOf, attributesOf } from "#proficiency";

const KNOWS = "knows-spell:";
const MANA = "mana";

// LOCAL functional set — substrate FUNCTIONAL ∪ {mana} ∪ {knows-spell:<…>} prefix. The substrate
// already carries mana and the knows-spell: prefix; we never mutate it. We read these cells off the
// RAW trace (latest-t wins) rather than settling against this set, so the set is documentary: it
// records WHICH cells casting treats as single-valued. (Kept for parity with needs.mjs's pattern.)
export const MAGIC_FUNCTIONAL = new Set([MANA]);
export const MAGIC_PREFIXES = [KNOWS];

// SPELLS — the catalog. Each spell names a magic-school path (gated via the school bonus), a mana
// `cost`, a minimum school `need`, and an `effect` delegating to an existing system. Evocative by
// design; every condition named below is in #conditions' CONDITIONS catalog (drunk, exhausted,
// blessed, focused, sick, afraid, blinded, inspired, …) — we never invent one.
export const SPELLS = Object.freeze({
  fireball:  { school: "magic.evocation",  cost: 8,  need: 5,  effect: { kind: "harm", severity: 6, part: "torso" } },
  frostbite: { school: "magic.evocation",  cost: 5,  need: 3,  effect: { kind: "harm", severity: 3, part: "arm", then: { kind: "afflict", condition: "exhausted", intensity: 3 } } },
  spark:     { school: "magic.evocation",  cost: 2,  need: 0,  effect: { kind: "harm", severity: 1, part: "arm" } },
  smite:     { school: "magic.evocation",  cost: 10, need: 7,  effect: { kind: "harm", severity: 8, part: "torso" } },

  mend:      { school: "magic.healing",    cost: 6,  need: 2,  effect: { kind: "heal", part: "*" } },
  knit:      { school: "magic.healing",    cost: 4,  need: 1,  effect: { kind: "heal", part: "leg" } },
  shield:    { school: "magic.healing",    cost: 4,  need: 2,  effect: { kind: "afflict", condition: "blessed", intensity: 4, self: true } },
  haste:     { school: "magic.healing",    cost: 5,  need: 3,  effect: { kind: "afflict", condition: "focused", intensity: 3, self: true } },

  befuddle:  { school: "magic.illusion",   cost: 3,  need: 1,  effect: { kind: "afflict", condition: "drunk", intensity: 4 } },
  curse:     { school: "magic.illusion",   cost: 6,  need: 4,  effect: { kind: "afflict", condition: "afraid", intensity: 5 } },
  blind:     { school: "magic.illusion",   cost: 7,  need: 5,  effect: { kind: "afflict", condition: "blinded", intensity: 6 } },
  scry:      { school: "magic.illusion",   cost: 1,  need: 0,  effect: { kind: "reveal" } },
});

// listSpells — the catalog as a plain object (name -> spec). Pure; no disk.
export function listSpells() {
  return SPELLS;
}

// learnPredicate — the knows-spell:<name> cell that marks a learned spell.
export const learnPredicate = (spellName) => `${KNOWS}${spellName}`;

// rawLatest — read the latest-t value of a single (subject, predicate) cell off the RAW trace. The
// append-only log is read in arrival order; the highest t wins (functional, single-valued). Returns
// the row's value `v`, or null when no such cell was ever filed.
async function rawLatest(root, subject, predicate) {
  let best = null;
  for (const r of await rowsFor(root, subject)) {
    if (r.e !== subject || r.a !== predicate || r.v == null) continue;
    if (best === null || r.t > best.t) best = r;
  }
  return best ? best.v : null;
}

// manaOf — the caster's current mana pool. The latest mana cell wins; when no mana cell has ever
// been filed, the pool DEFAULTS to attr:int * 2 (an unspent mage walks in with a full reservoir).
export async function manaOf(root, caster) {
  const v = await rawLatest(root, caster, MANA);
  if (v != null) {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }
  const attrs = await attributesOf(root, caster);
  return Math.max(0, Math.trunc(attrs.int) * 2);
}

// knowsSpell — has the caster learned this spell? (a knows-spell:<name> cell that holds, latest-t).
export async function knowsSpell(root, caster, spellName) {
  const v = await rawLatest(root, caster, learnPredicate(spellName));
  return v === true;
}

// spellsKnown — the sorted names of every spell the caster currently knows (latest-t per spell;
// a marker filed as false / null drops out).
export async function spellsKnown(root, caster) {
  const latest = new Map(); // name -> { v, t }
  for (const r of await rowsFor(root, caster)) {
    if (r.e !== caster || typeof r.a !== "string" || !r.a.startsWith(KNOWS)) continue;
    const name = r.a.slice(KNOWS.length);
    if (!name) continue;
    const prev = latest.get(name);
    if (!prev || r.t > prev.t) latest.set(name, { v: r.v, t: r.t });
  }
  return [...latest.entries()]
    .filter(([, rec]) => rec.v === true)
    .map(([name]) => name)
    .sort();
}

// learn — file a knows-spell:<name> marker so the caster knows the spell. FUNCTIONAL-by-prefix in
// the substrate, so re-learning supersedes without mutating history. Returns the filed row.
export async function learn(root, caster, spellName, t) {
  if (!root || caster == null || spellName == null || t == null) {
    throw new TypeError("learn: root, caster, spellName, t are required");
  }
  return doing({ root, subject: caster, predicate: learnPredicate(spellName), object: true, t });
}

// applyEffect — enact one spell effect against `victim` (the target, or the caster for self-spells).
// Each kind delegates to the system that owns that column; `reveal` reads without changing. Returns
// the system's result so cast() can surface it. A `then` rider chains a second effect (frostbite:
// harm AND exhaust); a `self` flag means the effect always lands on the caster, not the target.
async function applyEffect({ root, caster, target, effect, t }) {
  const victim = effect.self ? caster : target;
  switch (effect.kind) {
    case "harm":
      return injure({ root, agent: caster, subject: victim, part: effect.part, severity: effect.severity, t });
    case "heal":
      if (effect.part === "*") {
        // heal every wounded part of the victim, deterministically by part name (healthOf sorts).
        const { injuries } = await healthOf(root, victim);
        const healed = [];
        let i = 0;
        for (const { part } of injuries) {
          const r = await heal({ root, subject: victim, part, t: `${t}/heal:${i}` });
          healed.push({ part, row: r.row });
          i += 1;
        }
        return { healed };
      }
      return heal({ root, subject: victim, part: effect.part, t });
    case "afflict":
      return afflict(root, victim, effect.condition, effect.intensity, t);
    case "reveal": {
      // a pure READING: the victim's current wounds and conditions, no world change.
      const health = await healthOf(root, victim);
      const conditions = await conditionsOf(root, victim);
      return { reading: { subject: victim, injuries: health.injuries, alive: health.alive, conditions } };
    }
    default:
      throw new RangeError(`cast: unknown effect kind '${effect.kind}'`);
  }
}

// cast — the spellcasting move (DEFAULT export). Gate, debit, apply, report. Deterministic.
export default async function cast(root, caster, spellName, target = null, t) {
  if (!root || caster == null || spellName == null || t == null) {
    throw new TypeError("cast: root, caster, spellName, t are required");
  }
  const spell = SPELLS[spellName];
  if (!spell) return { ok: false, reason: `no such spell '${spellName}'` };

  // (1) the caster must KNOW the spell.
  if (!(await knowsSpell(root, caster, spellName))) {
    return { ok: false, reason: `${caster} has not learned '${spellName}'` };
  }

  // (2) the caster must have enough mana.
  const mana = await manaOf(root, caster);
  if (mana < spell.cost) {
    return { ok: false, reason: `not enough mana (have ${mana}, need ${spell.cost})` };
  }

  // (3) the caster's magic-school bonus must meet the spell's need.
  const bonus = await bonusOf(root, caster, spell.school);
  if (bonus < spell.need) {
    return { ok: false, reason: `${spell.school} too weak (bonus ${bonus}, need ${spell.need})` };
  }

  // A self-target spell (shield/haste) targets the caster when no target is given. A non-self
  // spell that needs a target but got none cannot land.
  const self = spell.effect.self === true;
  const victim = self ? caster : target ?? caster;
  if (!self && target == null && spell.effect.kind !== "afflict" && spell.effect.kind !== "reveal" && spell.effect.kind !== "heal") {
    return { ok: false, reason: `'${spellName}' needs a target` };
  }

  // DEBIT mana FIRST — file a fresh, lower mana cell (append-only; latest-t supersedes the pool).
  const spent = mana - spell.cost;
  await doing({ root, subject: caster, predicate: MANA, object: spent, t: `${t}/mana` });

  // APPLY the effect (and any chained `then` rider).
  const result = await applyEffect({ root, caster, target: victim, effect: spell.effect, t });
  if (spell.effect.then) {
    await applyEffect({ root, caster, target: victim, effect: spell.effect.then, t: `${t}/then` });
  }

  return { ok: true, spell: spellName, effect: spell.effect, mana: spent, result };
}

// CLI guard — `node cast.mjs <world> <caster> <spell> [target]` casts and prints the outcome.
if (import.meta.url === `file://${process.argv[1]}`) {
  const [world, caster, spell, target] = process.argv.slice(2);
  if (!world || !caster || !spell) {
    console.error("usage: node cast.mjs <world> <caster> <spell> [target]");
    process.exit(2);
  }
  const t = `cli:${Date.now().toString(36)}`;
  console.log(JSON.stringify(await cast(world, caster, spell, target ?? null, t), null, 2));
}
