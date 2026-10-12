// fight — combat as COMPOSITION, not a dice roll. `fighting/` nests under `responding/` because a
// strike is one fiber composed against another: the attacker's relevant `skill:*` cell is the
// MESSAGE, the target's defence (its `capacity:moving` read off `#health`) is the cell that
// answers, and the two fuse via `respond`/`truthMeet` (⊙). The outcome IS the settled glyph:
//   t (hit)   — the attacker's skill affirms and the target cannot answer in kind: a wound lands.
//   f (miss)  — the strike is available but the target's defence denies it: nothing lands.
//   ⊤ (clash) — BOTH land: a contested situation the world holds as first-class (a melee where
//               attacker and defender each wound the other), not a bug.
// There is NO RNG and NO Date anywhere. The contest is resolved by comparing two integers derived
// from state (attacker skill vs. target defence), and the body part struck is chosen by a
// deterministic hash of attacker + target + tick. Replay reproduces every blow byte-for-byte.
//
// Death is not special-cased here: a struck part feeds `#health`'s capacity reduction, and when a
// VITAL capacity (torso) reaches 0 the target's `alive` reads false. Combat only files wounds; the
// body-graph in `#health` decides life.
//
// attack({ root, agent:attacker, target, t }) ->
//   { outcome:'hit'|'miss'|'clash', glyph, injury?:{part,severity}, appended:[row] }
// canAttack({ root, attacker, target }) -> boolean   (is a strike even available?)

import { truthMeet, value, neg, glyph as glyphOf, isTop, holds } from "#value";
import { settle } from "#substrate";
import { healthOf, injure, PARTS } from "#health";
import { combatProfile } from "#arsenal";
import { bonusOf } from "#proficiency";
import { modifiersOf } from "#conditions";

// The combat channel: a strike is a message on `combat`, carried by the attacker's skill.
const COMBAT_SKILL = "skill:combat";

// PART_CHOICES — the body parts a blow can land on, in a fixed deterministic order. The choice is
// a hash of (attacker, target, tick) modulo this list, so the SAME inputs always strike the SAME
// part (replay-safe) while different fights spread wounds across the body (story texture).
const PART_CHOICES = Object.keys(PARTS); // ["leg","arm","eye","torso"] — frozen order from #health

// hash32 — a tiny deterministic string hash (FNV-1a, 32-bit). Pure: no RNG, no Date. Used only to
// pick a body part and to break ties; never to decide hit/miss (that is the skill-vs-defence meet).
function hash32(s) {
  let h = 0x811c9dc5;
  const str = String(s);
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// skillOf — the attacker's combat skill level (the object of its latest skill:combat cell), as an
// integer. Absent ⇒ 0 (an untrained attacker still swings, but weakly). Reads the settled fiber.
function skillOf(thing) {
  let best = 0;
  for (const c of thing.fiber) {
    if (c.predicate !== COMBAT_SKILL) continue;
    if (!holds(c.value)) continue;
    const n = Math.trunc(Number(c.object));
    if (Number.isFinite(n) && n > best) best = n; // skills accrue (not functional) → highest wins
  }
  return best < 0 ? 0 : best;
}

// markOf — turn an integer contest score into a bilattice mark. A positive score AFFIRMS (t),
// a non-positive score is no positive evidence (⊥). Two marks then meet via ⊙ to settle the blow.
const markOf = (score) => (score > 0 ? value(1, 0) : value(0, 0));

// resolve — the PURE heart of combat: compose the attacker's strike with the target's defence.
//   attackScore  = attacker combat skill (offence).
//   defenceScore = a fraction of the target's `capacity:moving` (it dodges with its legs/torso);
//                  a defenceless (immobilised) target cannot answer, so its defence is 0.
// The strike-mark (t when attackScore>0) meets the defence the way respond() fuses a message with
// a cell. We model it with truthMeet for transparency, then read the glyph off the fused value:
//   attacker affirms, target defenceless (defence < attack) → t   (HIT, the wound lands)
//   attacker affirms, target out-defends (defence ≥ attack)  → f   (MISS, denied)
//   attacker affirms, target out-defends AND counters        → ⊤   (CLASH, both land)
// "Counter" = the out-defending target is ALSO skilled enough to strike back through the exchange
// (its combat skill ≥ the defensive footing it just won). ⊤ is the only path where both wound, and
// it is a deterministic integer comparison — never manufactured by chance.
export function resolve({ attackScore, defenceScore, counterScore }) {
  const attackMark = markOf(attackScore); // t (1,0) when the attacker swings with real skill, else ⊥.
  // the target DENIES the blow when its defence meets or beats the attack: negative evidence (f).
  const targetDenies = attackScore > 0 && defenceScore >= attackScore;
  // the defence is a CONVERSE mark on the same channel: it affirms "the strike is turned aside" (f)
  // when it denies, and stays ⊥ (silent — no answer) when it cannot. We fuse the attack with the
  // defence via truthMeet (⊙), exactly as respond() composes a message with the cell it bears on:
  //   attack t ⊙ defence ⊥ = t  (HIT — nothing turns the blow aside)
  //   attack t ⊙ defence f = f  (MISS — the denial accrues, the positive face is meet-ed away)
  //   ⊥ ⊙ x = ⊥                 (a skill-less swing composes trivially → no action)
  const defenceMark = targetDenies ? neg(value(1, 0)) : value(1, 0);
  let out = truthMeet(attackMark, defenceMark);
  // a true CLASH (⊤): the out-defending target ALSO lands a counter — its combat skill meets/exceeds
  // the defensive footing it just won, so it strikes back through the exchange. Both faces go to 1 →
  // ⊤, the situation the world holds as first-class. Pure integer comparison; never chance.
  const counters = targetDenies && counterScore > 0 && counterScore >= defenceScore;
  if (counters) out = value(1, 1);
  return out;
}

// partFor — the body part a landed blow strikes: a deterministic hash of attacker+target+tick over
// the fixed PART_CHOICES. NO RNG. The same (attacker,target,t) always strikes the same part.
export function partFor(attacker, target, t) {
  const idx = hash32(`${attacker}|${target}|${t}`) % PART_CHOICES.length;
  return PART_CHOICES[idx];
}

// severityFor — how deep the wound, 1..10. Scales with how much the attacker out-skills the
// defence (a lopsided blow wounds deeper), with a deterministic +1 jitter from the hash so equal
// fights still vary their wounds across ticks. Pure; clamped 1..10.
export function severityFor({ attackScore, defenceScore }, attacker, target, t) {
  const edge = Math.max(0, attackScore - Math.max(0, defenceScore));
  const base = 1 + Math.floor(edge / 10); // every 10 points of edge adds a point of depth
  const jitter = hash32(`sev|${attacker}|${target}|${t}`) % 2; // 0 or 1, deterministic
  const sev = base + jitter;
  return sev < 1 ? 1 : sev > 10 ? 10 : sev;
}

// combatScores — read both combatants into the integers resolve() needs, now DEEP: a blow is the
// composition of weapon + skill + tactics + condition against mobility + armour + defensive skill.
// It is strictly BACKWARD-COMPATIBLE: an actor with only the legacy `skill:combat` cell and no gear
// settles to EXACTLY the old numbers (no weapon ⇒ offence falls back to skillOf; no dodge skill,
// neutral tactics, no conditions, no armour ⇒ every added term is 0). Geared actors get the depth.
//   offence  = (wielding ? proficiency(weapon-skill) + weapon-damage : legacy skill:combat)
//              + condition fighting-modifier + tactics(offensive +5 / defensive −5)
//   defence  = floor(effective-mobility / 2)               (mobility = capacity:moving + condition)
//              + proficiency(defence-skill by stance)       (dodge / parry / block)
//              + (defensive stance +5) + condition fighting-modifier
//   counter  = the target's OWN offence (can it strike back through the exchange?)
// Returns the three scores plus the armour maps and the attacker's mobility, so attack() can soak
// landed wounds against worn armour at the struck part. Deterministic end to end (no RNG/Date).
const TAC_ATTACK = { offensive: 5, defensive: -5, neutral: 0 };
async function combatScores({ root, attacker, target, attackerThing, targetThing, attackerHealth, targetHealth }) {
  const aProf = await combatProfile(root, attacker);
  const tProf = await combatProfile(root, target);
  const aMod = await modifiersOf(root, attacker);
  const tMod = await modifiersOf(root, target);

  const mobility = (health, mod) => Math.max(0, (health.capacities.moving ?? 0) + (mod.capacity?.moving ?? 0));
  const offence = async (id, prof, thing, mod) => {
    // The fighter's REACH is the better of innate combat (legacy flat `skill:combat`) and the
    // proficiency in the weapon they wield; the wielded weapon then ADDS its damage on top. With no
    // weapon, weapon-skill and damage are 0, so this is exactly the legacy `skill:combat` — un-geared
    // actors stay byte-identical, while a weapon raises a brawler and proficiency rewards training.
    const legacy = skillOf(thing);
    const weaponSkill = prof.weapon.id ? await bonusOf(root, id, prof.weapon.skill) : 0;
    const base = Math.max(legacy, weaponSkill) + (prof.weapon.id ? prof.weapon.damage : 0);
    return Math.max(0, base + (mod.skill?.fighting ?? 0) + (TAC_ATTACK[prof.tactics.attack] ?? 0));
  };
  const defence = async (id, prof, health, mod) => {
    const defSkill = prof.tactics.defense === "parry" ? "fighting.defense.parry"
      : prof.tactics.defense === "block" ? "fighting.defense.block" : "fighting.defense.dodge";
    const stance = prof.tactics.attack === "defensive" ? 5 : 0;
    return Math.max(0, Math.floor(mobility(health, mod) / 2) + (await bonusOf(root, id, defSkill)) + stance + (mod.skill?.fighting ?? 0));
  };

  return {
    attackScore: await offence(attacker, aProf, attackerThing, aMod),
    defenceScore: await defence(target, tProf, targetHealth, tMod),
    counterScore: await offence(target, tProf, targetThing, tMod),
    attackerMobility: Math.floor(mobility(attackerHealth, aMod) / 2),
    targetArmor: tProf.armorByPart,
    attackerArmor: aProf.armorByPart,
  };
}

// canAttack — is a strike even AVAILABLE? It is, when the attacker is alive and the target is a
// live thing the attacker can reach a `combat` channel on. We use respond() as the availability
// oracle (the same Umwelt test the rest of the engine uses): the target composes on `combat` when
// it carries a `capacity:moving` cell (everything with a body does), and both must be alive.
export async function canAttack({ root, attacker, target }) {
  if (!root || attacker == null || target == null) return false;
  if (attacker === target) return false;
  const aH = await healthOf(root, attacker);
  const tH = await healthOf(root, target);
  if (!aH.alive || !tH.alive) return false;
  // the attacker must retain SOME moving capacity to press an attack.
  return (aH.capacities.moving ?? 0) > 0;
}

// attack — settle both beings, resolve the contest by composition, and (on a determined positive
// outcome) file a wound via #health.injure. Returns the outcome glyph, the wound (if any), and the
// appended rows. Attribution flows through injure (agent = attacker). Deterministic end to end.
export default async function attack({ root, agent: attacker, target, t }) {
  if (!root || attacker == null || target == null || t == null) {
    throw new TypeError("attack: root, agent (attacker), target, t are required");
  }
  const attackerThing = await settle(root, attacker);
  const targetThing = await settle(root, target);
  const attackerHealth = await healthOf(root, attacker);
  const targetHealth = await healthOf(root, target);

  const scores = await combatScores({ root, attacker, target, attackerThing, targetThing, attackerHealth, targetHealth });
  const out = resolve(scores);
  const g = glyphOf(out);

  const appended = [];
  // soak — worn armour at the struck part absorbs depth of wound, floored at 1 (a landed blow always
  // leaves at least a scratch). Un-armoured parts (the legacy case) subtract 0, so behaviour is
  // unchanged; a breastplate turns a deep torso wound into a shallow one.
  const soak = (sev, armorMap, part) => Math.max(1, sev - (armorMap[part] ?? 0));

  // f (miss) — available but denied: nothing lands. We still record the attempt as a combat trace
  // (a meaningful failure leaves a mark) via respondAt on the target's `combat`-bearing fiber, but
  // never an injury. To keep the wound path the single source of truth we record nothing on a pure
  // miss except the returned outcome (the tick can narrate it). No body change.
  if (g === "f" || g === "⊥") {
    return { outcome: "miss", glyph: g, appended };
  }

  // t (hit) or ⊤ (clash) — at least the attacker lands. File the attacker's blow on the target,
  // its depth soaked by any armour worn on the struck part.
  const part = partFor(attacker, target, t);
  const severity = soak(severityFor(scores, attacker, target, t), scores.targetArmor, part);
  const { row } = await injure({ root, agent: attacker, subject: target, part, severity, t });
  appended.push(row);

  // ⊤ (clash) — BOTH land: the target also wounds the attacker. A symmetric blow, deterministically
  // placed on the attacker's body and scaled by the target's counter skill, soaked by the attacker's
  // own armour. This is the situation the world holds first-class.
  let injury = { part, severity };
  if (isTop(out)) {
    const cPart = partFor(target, attacker, t);
    const cSeverity = soak(
      severityFor({ attackScore: scores.counterScore, defenceScore: scores.attackerMobility }, target, attacker, t),
      scores.attackerArmor, cPart,
    );
    const { row: cRow } = await injure({ root, agent: target, subject: attacker, part: cPart, severity: cSeverity, t });
    appended.push(cRow);
    return { outcome: "clash", glyph: g, injury, counter: { part: cPart, severity: cSeverity }, appended };
  }

  return { outcome: "hit", glyph: g, injury, appended };
}

// CLI: node fight.mjs <world> <attacker> <target> <t>
if (import.meta.url === `file://${process.argv[1]}`) {
  const [world, attacker, target, t] = process.argv.slice(2);
  if (!world || !attacker || !target || !t) {
    console.error("usage: node fight.mjs <world> <attacker> <target> <t>");
    process.exit(2);
  }
  console.log(JSON.stringify(await attack({ root: world, agent: attacker, target, t })));
}
