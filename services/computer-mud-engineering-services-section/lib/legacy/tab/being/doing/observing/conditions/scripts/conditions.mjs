// conditions — the STATUS-EFFECTS layer read off (and written onto) a settled being. `conditions/`
// nests under `observing/` because, like `health` and `needing`, it READS being's residue (a settled
// fiber) into a derived view and adds no new column: a status condition is just a cell
// `condition:<name>` on an actor whose OBJECT is an integer INTENSITY (e.g. `condition:drunk` = 6),
// in the spirit of `injury:<part>` (the suffix names the condition; the object carries its degree).
// `condition:` is a FUNCTIONAL family by convention — we read the LATEST `condition:<name>` cell per
// name (a local functional set, latest-t wins), so a fresh affliction or a decay step supersedes the
// old reading WITHOUT mutating history (append-only, like health's injuries and needing's decay).
//
// A condition MODIFIES the actor's effective stats/skills/capacities. The `per` map of each catalog
// entry says how much one POINT of intensity shifts each attribute / capacity / skill-root; the net
// shift is that per-map SCALED by the live intensity and summed across all active conditions. The
// combat & proficiency systems read `modifiersOf` and ADD it to their base numbers. Nothing here is
// random — intensity in, deltas out — and decay is a pure step (intensity − 1 toward 0 per tick),
// mirroring needing's `decayed` and ecology's `grownTo`.
//
// CONDITIONS                 : catalog name -> { desc, per:{<attr|capacity|skillRoot>: deltaPerPoint} }
// conditions(thing)          -> [{ name, intensity, desc, per }] for each live condition (intensity>0)
// conditionsOf(root, id)     = conditions(settle(root, id, { functional: CONDITION_FUNCTIONAL }))
// modifiersOf(root, id)      -> { attr:{…}, capacity:{…}, skill:{…} } net deltas (only nonzero keys)
// afflict(root, id, name, intensity, t) -> raise condition:<name> to MAX(current, intensity)
// relieve(root, id, name, t)            -> set condition:<name> to 0 (the condition lifts)
// tickConditions(root, t)               -> decay every actor's conditions by 1; { appended:[row] }
//
// Default export = conditionsOf.

import { settle, rowsFor, subjects, FUNCTIONAL } from "#substrate";
import { holds } from "#value";
import doing from "#doing";
import changing from "#changing";

const CONDITION = "condition:";

// Which kind of target each `per` key shifts: an attribute, a derived capacity, or a skill-tree root.
// Used to bucket the summed deltas in `modifiersOf` so each system reads its own slice.
const ATTRS = new Set(["str", "dex", "int", "wis", "con"]);
const CAPACITIES = new Set(["moving", "manipulation", "sight"]);
const SKILLS = new Set(["fighting", "covert", "crafting", "magic", "faith", "people", "adventuring"]);

// CONDITIONS — the catalog. Each `per` value is the delta applied to that target PER POINT of
// intensity; the net is `per * intensity` summed across the actor's live conditions. Evocative by
// design: a condition trades one capacity for another (drunk: looser tongue, worse hands).
export const CONDITIONS = Object.freeze({
  drunk:       { desc: "reeling with drink",        per: { dex: -1, int: -1, people: +2 } },
  poisoned:    { desc: "green and sweating",        per: { con: -1, str: -1, moving: -3 } },
  exhausted:   { desc: "dead on your feet",         per: { str: -1, dex: -1, moving: -2 } },
  sick:        { desc: "feverish and aching",       per: { con: -1, manipulation: -2 } },
  "well-fed":  { desc: "comfortably full",          per: { con: +1 } },
  inspired:    { desc: "struck by inspiration",     per: { crafting: +3, magic: +2 } },
  afraid:      { desc: "gripped by fear",           per: { fighting: -3, moving: +1 } },
  blessed:     { desc: "touched by a god",          per: { faith: +3, wis: +1 } },
  enraged:     { desc: "blind with fury",           per: { str: +2, fighting: +2, wis: -2 } },
  blinded:     { desc: "robbed of sight",           per: { sight: -8, fighting: -2, covert: -2 } },
  focused:     { desc: "calm and clear-eyed",       per: { covert: +2, adventuring: +1, int: +1 } },
  charmed:     { desc: "warm toward all comers",     per: { people: +3, wis: -1 } },
});

// intensityOf — read one condition:<name> intensity off a settled fiber as an integer ≥ 0. The
// caller settles condition:* as FUNCTIONAL (latest-t per name wins), so at most one cell per name
// survives. If a non-superseded fiber somehow carries several, the LATEST positive reading wins by
// MAX intensity, so a stale read never under-reports. Absent / non-positive ⇒ 0 (the condition is gone).
function intensityOf(thing, name) {
  const pred = `${CONDITION}${name}`;
  let best = null;
  for (const c of thing.fiber) {
    if (c.predicate !== pred) continue;
    if (!holds(c.value)) continue; // only an asserted intensity counts
    const n = Math.trunc(Number(c.object));
    if (!Number.isFinite(n)) continue;
    if (best === null || n > best) best = n;
  }
  return best === null || best < 0 ? 0 : best;
}

// liveNamesOf — the names of every condition:<name> cell present on a settled fiber, sorted, so we
// only read catalog entries the actor actually carries (and never invent one).
function liveNamesOf(thing) {
  const names = new Set();
  for (const c of thing.fiber) {
    if (typeof c.predicate !== "string" || !c.predicate.startsWith(CONDITION)) continue;
    const name = c.predicate.slice(CONDITION.length);
    if (name) names.add(name);
  }
  return [...names].sort();
}

// conditions — the PURE view: every condition with live intensity (> 0), with its catalog desc and
// per-map, sorted by name. A condition decayed to 0, or one not in the catalog, drops out.
export function conditions(thing) {
  if (!thing || !Array.isArray(thing.fiber)) {
    throw new TypeError("conditions: thing must be a settled being { entity, fiber }");
  }
  const out = [];
  for (const name of liveNamesOf(thing)) {
    const spec = CONDITIONS[name];
    if (!spec) continue; // an uncatalogued condition modifies nothing derivable
    const intensity = intensityOf(thing, name);
    if (intensity <= 0) continue; // gone
    out.push({ name, intensity, desc: spec.desc, per: spec.per });
  }
  return out;
}

// CONDITION_FUNCTIONAL — the substrate's functional set PLUS each live condition:<name>, so settling
// an actor supersedes condition history to the latest intensity (afflict/decay leave a trail of
// appends). condition: is already a functional FAMILY by prefix-convention, but we union the explicit
// names too so a caller passing this set as `functional` keeps the substrate's other functionals.
export function conditionFunctional(extraNames = []) {
  return new Set([...FUNCTIONAL, ...extraNames.map((n) => `${CONDITION}${n}`)]);
}

// conditionsOf — settle the actor with condition:<name> folded in as FUNCTIONAL (latest-t per name
// wins), then read the live conditions off the superseded fiber.
export async function conditionsOf(root, id) {
  const rows = await rowsFor(root, id);
  const names = new Set();
  for (const r of rows) {
    if (typeof r.a === "string" && r.a.startsWith(CONDITION)) names.add(r.a.slice(CONDITION.length));
  }
  return conditions(await settle(root, id, { functional: conditionFunctional([...names]) }));
}

// Default export = conditionsOf (the disk-settling read; `conditions` is the pure-view named export).
export default conditionsOf;

// modifiersOf — the NET deltas across all live conditions, each per-map SCALED by its intensity and
// summed, bucketed into attr / capacity / skill. Only nonzero keys survive, so a system reads exactly
// the slice it cares about and adds it to its base numbers. This is what scales by intensity (yes):
// drunk at intensity 5 contributes dex −1×5 = −5.
export async function modifiersOf(root, id) {
  const active = await conditionsOf(root, id);
  const attr = {};
  const capacity = {};
  const skill = {};
  for (const { intensity, per } of active) {
    for (const [key, delta] of Object.entries(per)) {
      const scaled = delta * intensity;
      const bucket = ATTRS.has(key) ? attr : CAPACITIES.has(key) ? capacity : SKILLS.has(key) ? skill : null;
      if (!bucket) continue; // an unrecognized target shifts nothing readable
      bucket[key] = (bucket[key] ?? 0) + scaled;
    }
  }
  // drop any key that summed to zero (e.g. +3 and −3 across two conditions cancel out)
  for (const bucket of [attr, capacity, skill]) {
    for (const k of Object.keys(bucket)) if (bucket[k] === 0) delete bucket[k];
  }
  return { attr, capacity, skill };
}

// currentIntensity — read the actor's current condition:<name> intensity off the raw trace (latest-t
// row wins). Used by afflict to compute MAX(current, intensity). Append-only log is read in order.
async function currentIntensity(root, id, name) {
  const pred = `${CONDITION}${name}`;
  let best = null;
  for (const r of await rowsFor(root, id)) {
    if (r.e !== id || r.a !== pred || r.v == null) continue;
    if (best === null || r.t > best.t) best = r;
  }
  if (!best) return 0;
  const n = Math.trunc(Number(best.v));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// afflict — file/raise condition:<name> to MAX(current, intensity): re-applying a milder dose of an
// affliction the actor already suffers does NOT weaken it; a heavier dose deepens it. The name MUST
// be in the catalog. Intensity is clamped to ≥ 0 (a non-positive afflict is a no-op relieve). Filed as
// a fresh later-t cell — append-only; functional supersession reads it as the current reading.
export async function afflict(root, id, name, intensity, t) {
  if (!root || id == null || name == null || t == null) {
    throw new TypeError("afflict: root, id, name, t are required");
  }
  if (!CONDITIONS[name]) throw new RangeError(`afflict: unknown condition '${name}'`);
  const want = Math.max(0, Math.trunc(Number(intensity)));
  const cur = await currentIntensity(root, id, name);
  const next = Math.max(cur, want);
  return changing({ root, subject: id, predicate: `${CONDITION}${name}`, object: next, t });
}

// relieve — lift a condition: set condition:<name> to 0 so the latest reading is no-condition. The
// name need not be catalogued (you can always clear a cell). Append-only.
export async function relieve(root, id, name, t) {
  if (!root || id == null || name == null || t == null) {
    throw new TypeError("relieve: root, id, name, t are required");
  }
  return changing({ root, subject: id, predicate: `${CONDITION}${name}`, object: 0, t });
}

// decayed — the pure decay step: drop one intensity point toward 0, clamped. Integer in, integer out,
// no RNG — mirrors needing's `decayed` and ecology's `grownTo`. This is the function the tick folds.
export function decayed(intensity) {
  const n = Math.trunc(Number(intensity));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n - 1;
}

// tickConditions — the effectful tick-rule, mirroring regen.mjs's shape. For every ACTOR (a subject
// with a `mover` cell), decay each live condition:<name> by 1 toward 0 and append the change
// (functional condition: supersession keeps it append-only). A condition already at 0 is skipped (no
// row — quiet when nothing to do). Returns the rows it wrote so the tick can fold/narrate them.
// Deterministic: same world + t → same appends.
export async function tickConditions(root, t) {
  if (!root || t == null) throw new TypeError("tickConditions: root and t are required");
  const appended = [];
  for (const s of await subjects(root)) {
    const rows = await rowsFor(root, s);
    // is this subject an actor? (a `mover` cell present, latest-t, non-null)
    let mover = null;
    for (const r of rows) {
      if (r.e === s && r.a === "mover" && r.v != null && (mover === null || r.t > mover.t)) mover = r;
    }
    if (!mover) continue;
    // current live intensity per condition:<name> on this actor (latest-t per name)
    const cur = new Map();
    for (const r of rows) {
      if (r.e !== s || typeof r.a !== "string" || !r.a.startsWith(CONDITION) || r.v == null) continue;
      const prev = cur.get(r.a);
      if (!prev || r.t > prev.t) cur.set(r.a, r);
    }
    for (const [pred, row] of cur) {
      const at = Math.trunc(Number(row.v));
      if (!Number.isFinite(at) || at <= 0) continue; // already gone — stay quiet
      const next = decayed(at);
      const { row: written } = await doing({ root, subject: s, predicate: pred, object: next, t });
      appended.push(written);
    }
  }
  return { appended };
}

// CLI: node conditions.mjs <world> <id>
if (import.meta.url === `file://${process.argv[1]}`) {
  const [world, id] = process.argv.slice(2);
  if (!world || !id) {
    console.error("usage: node conditions.mjs <world> <id>");
    process.exit(2);
  }
  console.log(JSON.stringify(await conditionsOf(world, id)));
}
