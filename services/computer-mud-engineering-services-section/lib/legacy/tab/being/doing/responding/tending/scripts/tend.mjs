// tending — MEDICINE: one actor TREATS another's wounds, scaled by their doctoring skill, and an
// untended severe wound FESTERS into sickness. `tending/` nests under `responding/` (a sibling of
// `fighting` and `crafting`) because, like a fight, it is an actor RESPONDING to another being's
// state: where `fighting` files an injury, `tending` LOWERS one. It adds no new column of its own —
// it READS being's residue through `#health` and `#conditions` and writes BACK through their own
// morphisms (heal / relieve / afflict), so the shared body-and-status model stays the single source.
//
// Discworld-flavoured reading: a doctor's hands are only as good as their TEACHING. The amount a
// treat closes is dominated by a flat base, nudged UP by how practised the healer is at the
// `people.healing` skill — so a master closes more of a wound per visit than a novice, but everyone
// can stop the bleeding. Nothing here is random: bonus in, healed-amount out.
//
// SHARED CELL MODEL (so tending interlocks on the SAME cells the rest of the sim reads):
//   - WOUNDS are `injury:<part>` cells (object = severity 1..10), read/written via #health
//     (healthOf / heal / PARTS). A treat lowers a part's severity by a computed amount; #health.heal
//     supersedes the prior reading (append-only). leg→moving arm→manipulation eye→sight torso→both.
//   - INFECTION is the `sick` condition (object = intensity), read/written via #conditions
//     (conditionsOf / afflict / relieve). A successful treat RELIEVES one point of `sick` — clean
//     hands fight the fever — and an untended SEVERE wound (severity ≥ INFECTION_THRESHOLD) FESTERS,
//     raising `sick` by 1 on the tick. We use the catalogued `sick` condition; we invent none.
//   - SKILL is `skill:people.healing` (accrues by being taught); the healer's edge is read via
//     #proficiency.bonusOf(root, healer, "people.healing").
//
// HEAL-SCALING FORMULA (deterministic, integer, clamped):
//   healedBy = clamp(BASE + floor(bonus / PER), 1, MAX)   with BASE=2, PER=15, MAX=8
//   — every healer closes at least BASE=2 of a wound; each full PER=15 points of healing-bonus adds
//   one more point closed, capped at MAX=8 so no single visit erases a near-fatal wound outright. A
//   more-skilled healer therefore closes strictly MORE (or equal, at the cap) than a lesser one.
//
// INFECTION MODEL (deterministic tick-fold, mirrors ecology/regen.mjs's shape):
//   tickWounds(root, t): for each ACTOR carrying an untended wound of severity ≥ INFECTION_THRESHOLD
//   (=7), raise its `sick` condition by 1 (the wound festers). A wound being treated this tick is
//   not "untended" — but tending writes through #health, so a wound the healer just lowered below
//   the threshold no longer festers; that IS the break. Conservative: at most +1 sick per actor per
//   tick, only the worst wound counts, no row when nothing festers. Same world + t → same appends.
//
// API:
//   treat(root, healer, patient, part, t)  [DEFAULT] -> { ok, part, healedBy, severityAfter } | { ok:false, reason }
//   bandage(root, healer, patient, t)                -> treat the patient's WORST wound (convenience)
//   diagnose(root, patient)               [pure read]-> { injuries, infected, worst, advice }
//   tickWounds(root, t)                   [tick-fold]-> { appended:[row] }

import { subjects, rowsFor } from "#substrate";
import { healthOf, heal, PARTS } from "#health";
import { conditionsOf, afflict, relieve } from "#conditions";
import { bonusOf } from "#proficiency";

// The doctoring skill path (a `people.*` skill — people-work, the bedside manner of healing).
export const HEALING_SKILL = "people.healing";

// The infection condition an untended wound festers into — a CATALOGUED #conditions name (`sick`:
// "feverish and aching"). We use it; we never invent a condition name.
export const INFECTION = "sick";

// Heal-scaling constants (documented in the header formula).
export const HEAL_BASE = 2; // everyone closes at least this much of a wound
export const HEAL_PER = 15; // each full this-many points of healing-bonus adds one more point closed
export const HEAL_MAX = 8; // a single visit never closes more than this (no instant full cure)

// A wound at or above this severity, left untended, festers into `sick` on the tick.
export const INFECTION_THRESHOLD = 7;

const INJURY = "injury:";

// healAmountFor — the PURE heal-scaling step: how much of a wound a healer with `bonus` closes per
// treat. Integer in, integer out, no RNG. clamp(BASE + floor(bonus/PER), 1, MAX). Documented above.
export function healAmountFor(bonus) {
  const b = Number.isFinite(Number(bonus)) ? Math.trunc(Number(bonus)) : 0;
  const raw = HEAL_BASE + Math.floor(b / HEAL_PER);
  return Math.min(HEAL_MAX, Math.max(1, raw));
}

// severityOnPart — the patient's CURRENT severity for one part, read off their settled health view
// (latest injury:<part> wins; absent/healed ⇒ 0). Pure over the settled reading.
function severityOnPart(injuries, part) {
  const found = injuries.find((w) => w.part === part);
  return found ? found.severity : 0;
}

// worstWound — the highest-severity live wound from a list of {part,severity}, deterministic tie-
// break by part name (alphabetical), or null when there are no wounds.
function worstWound(injuries) {
  let best = null;
  for (const w of injuries) {
    if (!best || w.severity > best.severity ||
        (w.severity === best.severity && w.part.localeCompare(best.part) < 0)) {
      best = w;
    }
  }
  return best;
}

// isInfected — does the patient carry the `sick` condition at live intensity?
function infectedFrom(conditions) {
  return conditions.some((c) => c.name === INFECTION && c.intensity > 0);
}

// treat — DEFAULT export. A `healer` tends a `patient`'s `part`: close the wound by an amount scaled
// to the healer's people.healing bonus (via #health.heal, attributed to the healer), and — when the
// treat lands on a real wound — relieve one point of any `sick` infection (clean hands fight fever).
// Returns { ok:true, part, healedBy, severityAfter }, or { ok:false, reason } when there is no live
// wound on that part (you cannot treat what is not hurt). Writes through #health/#conditions only.
export default async function treat(root, healer, patient, part, t) {
  if (!root || patient == null || part == null || t == null) {
    throw new TypeError("treat: root, patient, part, t are required");
  }
  if (!PARTS[part]) return { ok: false, reason: `unknown part '${part}'` };

  const before = await healthOf(root, patient);
  const severityBefore = severityOnPart(before.injuries, part);
  if (severityBefore <= 0) return { ok: false, reason: `no wound on ${part}` };

  // how much this healer closes, scaled by their doctoring skill.
  const bonus = healer != null ? await bonusOf(root, healer, HEALING_SKILL) : 0;
  const healedBy = healAmountFor(bonus);

  // lower the part's severity via #health (append-only supersession). agent = the healer.
  await heal({ root, subject: patient, part, t: `${t}/heal`, by: healedBy, agent: healer });

  // a successful treat also fights infection: lower `sick` by one point if present. afflict only
  // RAISES (sets MAX(current, want)), so to step `sick` DOWN we relieve to 0 first, then — when a
  // point remains — re-afflict to the lower value. Two appends at ordered sub-ticks; latest wins.
  const conditions = await conditionsOf(root, patient);
  const sick = conditions.find((c) => c.name === INFECTION && c.intensity > 0);
  if (sick) {
    const next = Math.max(0, sick.intensity - 1);
    await relieve(root, patient, INFECTION, `${t}/cure-a`);
    if (next > 0) await afflict(root, patient, INFECTION, next, `${t}/cure-b`);
  }

  const severityAfter = Math.max(0, severityBefore - healedBy);
  return { ok: true, part, healedBy, severityAfter };
}

// bandage — convenience: treat the patient's WORST live wound (highest severity, alpha tie-break).
// Returns treat()'s shape, or { ok:false, reason } when the patient has no wounds.
export async function bandage(root, healer, patient, t) {
  if (!root || patient == null || t == null) {
    throw new TypeError("bandage: root, patient, t are required");
  }
  const { injuries } = await healthOf(root, patient);
  const worst = worstWound(injuries);
  if (!worst) return { ok: false, reason: "no wounds to bandage" };
  return treat(root, healer, patient, worst.part, t);
}

// diagnose — PURE read: the patient's wounds, whether they are infected, their worst wound, and a
// one-line advice string. Reads through #health/#conditions; writes nothing.
export async function diagnose(root, patient) {
  if (!root || patient == null) throw new TypeError("diagnose: root, patient are required");
  const { injuries } = await healthOf(root, patient);
  const conditions = await conditionsOf(root, patient);
  const infected = infectedFrom(conditions);
  const worst = worstWound(injuries);
  let advice;
  if (!worst && !infected) advice = "in good health";
  else if (infected && worst) advice = `infected and wounded — treat the ${worst.part} and the fever`;
  else if (infected) advice = "fevered — the infection must be relieved";
  else if (worst.severity >= INFECTION_THRESHOLD) advice = `the ${worst.part} is grave — treat it before it festers`;
  else advice = `treat the ${worst.part}`;
  return { injuries, infected, worst, advice };
}

// ---- INFECTION TICK-FOLD: untended severe wounds fester ---------------------------------------

// actorInjuries — read every ACTOR (a subject carrying a `mover` cell, mirroring tickConditions)
// with its current per-part injury severities (latest-t per injury:<part>, positive readings only).
// Pure-ish read over disk; returns [{ subject, worstSeverity }].
async function actorWoundsOf(root) {
  const out = [];
  for (const s of await subjects(root)) {
    const rows = await rowsFor(root, s);
    // is this subject an actor? (a `mover` cell present, latest-t, non-null)
    let mover = null;
    for (const r of rows) {
      if (r.e === s && r.a === "mover" && r.v != null && (mover === null || r.t > mover.t)) mover = r;
    }
    if (!mover) continue;
    // latest-t severity per injury:<part>
    const byPart = new Map();
    for (const r of rows) {
      if (r.e !== s || typeof r.a !== "string" || !r.a.startsWith(INJURY) || r.v == null) continue;
      const prev = byPart.get(r.a);
      if (!prev || r.t > prev.t) byPart.set(r.a, r);
    }
    let worst = 0;
    for (const row of byPart.values()) {
      const sev = Math.trunc(Number(row.v));
      if (Number.isFinite(sev) && sev > worst) worst = sev;
    }
    if (worst > 0) out.push({ subject: s, worstSeverity: worst });
  }
  return out;
}

// tickWounds — the effectful tick-rule, mirroring ecology/regen.mjs's shape. For each actor whose
// WORST untended wound is severe (severity ≥ INFECTION_THRESHOLD), raise its `sick` condition by 1
// (the wound festers). Conservative: at most one fester per actor per tick; no row for an actor
// below the threshold. A wound treated (lowered below the threshold) before the tick no longer
// festers — that is the break. Deterministic: same world + t → same appends.
export async function tickWounds(root, t) {
  if (!root || t == null) throw new TypeError("tickWounds: root and t are required");
  const appended = [];
  for (const { subject, worstSeverity } of await actorWoundsOf(root)) {
    if (worstSeverity < INFECTION_THRESHOLD) continue; // not grave enough to fester — stay quiet
    // current `sick` intensity, then raise by 1 (afflict sets MAX(current, want), so want=cur+1).
    const conditions = await conditionsOf(root, subject);
    const cur = conditions.find((c) => c.name === INFECTION)?.intensity ?? 0;
    const { row } = await afflict(root, subject, INFECTION, cur + 1, t);
    appended.push(row);
  }
  return { appended };
}

// CLI: node tend.mjs <world> <patient>   (diagnose)
if (import.meta.url === `file://${process.argv[1]}`) {
  const [world, patient] = process.argv.slice(2);
  if (!world || !patient) {
    console.error("usage: node tend.mjs <world> <patient>");
    process.exit(2);
  }
  console.log(JSON.stringify(await diagnose(world, patient)));
}
