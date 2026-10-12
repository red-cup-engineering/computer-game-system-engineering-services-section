// arsenal — the PURE equipment reads combat folds in. `arsenal/` nests under `fighting/` because a
// blow is composed not only from raw skill (fight.mjs) but from what the actor BEARS: the weapon it
// wields, the armour it wears on each body part, and the tactics it has chosen. Nothing here is an
// action — these are QUOTES of an actor's combat loadout, read off a settled fiber the way #health
// reads capacities. fight.mjs will fold these reads to turn a bare skill contest into an armed one.
//
// THE SHARED CELL MODEL it reads (all single-valued, so the LATEST supersedes):
//   on an ACTOR:  `wielding` -> weapon item id        (FUNCTIONAL: one weapon in hand)
//                 `wearing:<part>` -> armour item id  (FUNCTIONAL family: one armour per part)
//                 `tactics:attack` ∈ {offensive,neutral,defensive}   (FUNCTIONAL family `tactics:`)
//                 `tactics:defense` ∈ {dodge,parry,block}
//   on a WEAPON item:  `weapon-damage` (int)  `weapon-skill` (a skill path)  `weight` (int)
//   on an ARMOUR item: `armor-protection` (int)  `armor-covers` (a part name)
//
// Because `wielding`, `wearing:*`, and `tactics:*` are NOT in the substrate's FUNCTIONAL set, we
// settle actors against a LOCAL functional set (substrate FUNCTIONAL ∪ {"wielding"} ∪ prefixes
// "wearing:","tactics:") so a re-wield / re-wear / re-tactic supersedes to the latest — exactly the
// LOCAL functional-set pattern #needing and #health use, without editing the substrate.
//
// wieldedOf(root, id)      -> weapon item id | null            (latest `wielding`)
// wornOf(root, id)         -> { <part>: itemId }               (each held `wearing:<part>`)
// tacticsOf(root, id)      -> { attack, defense }              (defaults neutral / dodge)
// weaponStats(root, wId)   -> { id, damage, skill, weight }    (the weapon item's cells)
// armorByPart(root, id)    -> { leg, arm, eye, torso }         (total protection worn per part)
// combatProfile(root, id)  -> { weapon, armorByPart, tactics, weaponWeight }  (the whole loadout)

import { holds } from "#value";
import { settle, FUNCTIONAL } from "#substrate";
import { PARTS } from "#health";

// The cells we read, named once so the morphism reads in the model's own words.
const WIELDING = "wielding";
const WEARING = "wearing:"; // family prefix: wearing:<part>
const TACTICS = "tactics:"; // family prefix: tactics:attack / tactics:defense

// The body parts armour can cover — the same frozen part set #health defines (leg/arm/eye/torso).
const ARMOR_PARTS = Object.keys(PARTS);

// UNARMED — the default weapon profile when nothing is wielded: a bare-handed strike. Damage 2,
// skilled as fighting.melee.unarmed. fight.mjs reads this as the weapon when `weapon` carries no id.
export const UNARMED = Object.freeze({ id: null, damage: 2, skill: "fighting.melee.unarmed" });

// Tactics defaults — a stance never declared reads as a measured one: neutral attack, dodge defence.
export const DEFAULT_TACTICS = Object.freeze({ attack: "neutral", defense: "dodge" });

// EQUIP_FUNCTIONAL — the LOCAL functional set for settling an ACTOR's equipment. The substrate
// FUNCTIONAL set, plus `wielding` and the `wearing:` / `tactics:` prefix families, so each single-
// valued equipment cell supersedes to its latest value. Built like #needing's NEED_FUNCTIONAL: a
// fresh Set the substrate never sees, so we change the substrate's behaviour nowhere.
export const EQUIP_FUNCTIONAL = (() => {
  const fn = new Set(FUNCTIONAL);
  fn.add(WIELDING);
  return fn; // the prefix families are added per-actor below (settle matches them explicitly)
})();

// latestOf — the object of the actor's latest surviving `predicate` cell that holds, or null. We
// settle with the local functional set first, so at most one cell per functional predicate remains;
// this just reads its object. Used for the single-valued equipment cells (wielding, tactics:*).
function holdingObject(thing, predicate) {
  for (const c of thing.fiber) {
    if (c.predicate !== predicate) continue;
    if (!holds(c.value)) continue;
    return c.object;
  }
  return null;
}

// settleActor — settle an actor against the equipment-local functional set. We union the substrate
// FUNCTIONAL set with `wielding` and EVERY `wearing:<part>` / `tactics:<face>` predicate present on
// the actor's trace (matched by prefix), so each single-valued equipment cell supersedes to latest.
async function settleActor(root, id) {
  const functional = new Set(EQUIP_FUNCTIONAL);
  // The settle below supersedes by membership in `functional`; the wearing:/tactics: families are
  // dynamic, so add each concrete predicate the actor actually carries. We read the raw fiber once
  // by settling with the base set, then re-settle with the families folded in.
  const base = await settle(root, id, { functional });
  for (const c of base.fiber) {
    const p = c.predicate;
    if (typeof p === "string" && (p.startsWith(WEARING) || p.startsWith(TACTICS))) functional.add(p);
  }
  return settle(root, id, { functional });
}

// wieldedOf — the actor's wielded weapon item id, or null. Latest `wielding` (re-wield supersedes).
export async function wieldedOf(root, id) {
  const thing = await settleActor(root, id);
  return holdingObject(thing, WIELDING);
}

// wornOf — a map { <part>: itemId } of every armour the actor wears, one per part it covers. Reads
// each surviving `wearing:<part>` cell that holds (re-wear on a part supersedes to the latest item).
export async function wornOf(root, id) {
  const thing = await settleActor(root, id);
  const worn = {};
  for (const c of thing.fiber) {
    const p = c.predicate;
    if (typeof p !== "string" || !p.startsWith(WEARING)) continue;
    if (!holds(c.value)) continue;
    const part = p.slice(WEARING.length);
    if (!part) continue;
    worn[part] = c.object;
  }
  return worn;
}

// tacticsOf — the actor's chosen stance { attack, defense }, defaulting to neutral / dodge. Reads
// the latest `tactics:attack` and `tactics:defense` cells (each functional, so latest supersedes).
export async function tacticsOf(root, id) {
  const thing = await settleActor(root, id);
  const attack = holdingObject(thing, `${TACTICS}attack`);
  const defense = holdingObject(thing, `${TACTICS}defense`);
  return {
    attack: attack ?? DEFAULT_TACTICS.attack,
    defense: defense ?? DEFAULT_TACTICS.defense,
  };
}

// intOf — read a numeric cell off a settled item, defaulting when absent/non-finite. Pure.
function intOf(thing, predicate, fallback = 0) {
  for (const c of thing.fiber) {
    if (c.predicate !== predicate) continue;
    if (!holds(c.value)) continue;
    const n = Math.trunc(Number(c.object));
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

// strOf — read a string cell off a settled item, or null. Pure.
function strOf(thing, predicate) {
  for (const c of thing.fiber) {
    if (c.predicate !== predicate) continue;
    if (!holds(c.value)) continue;
    if (typeof c.object === "string") return c.object;
  }
  return null;
}

// weaponStats — the combat-relevant cells of a weapon item: { id, damage, skill, weight }. Damage
// and weight default to 0, skill to null, when the item does not carry them. A null/absent weaponId
// reads as the UNARMED profile (id null, damage 2, fighting.melee.unarmed, weight 0).
export async function weaponStats(root, weaponId) {
  if (weaponId == null) return { id: null, damage: UNARMED.damage, skill: UNARMED.skill, weight: 0 };
  const item = await settle(root, weaponId);
  return {
    id: weaponId,
    damage: intOf(item, "weapon-damage", 0),
    skill: strOf(item, "weapon-skill"),
    weight: intOf(item, "weight", 0),
  };
}

// armorByPart — total `armor-protection` worn on each body part: { leg, arm, eye, torso }. For each
// part the actor wears armour on, we settle that armour item and add its protection to the part it
// covers (`armor-covers`), falling back to the wearing slot when the item names no cover. A part
// with no armour reads 0. Multiple coverings on one part accrue (sum), though one-per-slot is usual.
export async function armorByPart(root, id) {
  const byPart = {};
  for (const part of ARMOR_PARTS) byPart[part] = 0;
  const worn = await wornOf(root, id);
  for (const [slot, itemId] of Object.entries(worn)) {
    if (itemId == null) continue;
    const item = await settle(root, itemId);
    const protection = intOf(item, "armor-protection", 0);
    const covers = strOf(item, "armor-covers") ?? slot;
    if (Object.prototype.hasOwnProperty.call(byPart, covers)) byPart[covers] += protection;
  }
  return byPart;
}

// combatProfile — the WHOLE loadout fight.mjs folds: the wielded weapon (UNARMED when bare-handed,
// without its weight — weaponWeight carries that), the armour worn per part, the chosen tactics, and
// the weapon's weight (0 unarmed). The `weapon` face omits weight (it is the {id,damage,skill} the
// contest reads); weaponWeight is surfaced alongside for encumbrance/initiative reads.
export async function combatProfile(root, id) {
  const wieldedId = await wieldedOf(root, id);
  const stats = await weaponStats(root, wieldedId);
  const weapon =
    wieldedId == null
      ? { ...UNARMED }
      : { id: stats.id, damage: stats.damage, skill: stats.skill };
  return {
    weapon,
    armorByPart: await armorByPart(root, id),
    tactics: await tacticsOf(root, id),
    weaponWeight: stats.weight,
  };
}

export default combatProfile;

// CLI: node arsenal.mjs <world> <actor> — print the actor's combat profile as JSON.
if (import.meta.url === `file://${process.argv[1]}`) {
  const [world, actor] = process.argv.slice(2);
  if (!world || !actor) {
    console.error("usage: node arsenal.mjs <world> <actor>");
    process.exit(2);
  }
  console.log(JSON.stringify(await combatProfile(world, actor)));
}
