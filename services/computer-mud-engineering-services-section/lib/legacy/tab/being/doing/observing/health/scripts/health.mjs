// health — body-part capacities read off a settled being. `health/` nests under `observing/`
// because, like observing, it READS being's residue (a settled fiber) into a derived view; it
// adds no new column. An INJURY is a cell `injury:<part>` whose object IS the severity (1..10),
// in the spirit of the `skill:<name>` convention (the suffix names the part; the object carries
// the degree). Capacities — moving, manipulation, sight — are DERIVED, not stored: each starts at
// 100% and is reduced by the injuries to the parts that serve it. This is the RimWorld/Dwarf-
// Fortress reading: the body is a graph of parts, a capacity is a function of the parts' state,
// and the rest of the sim reads the capacity (low `moving` → the tick/AI slows the NPC; a wound
// that reaches a vital part's zero is death). Nothing here is random — severity in, capacity out.
//
// PART → CAPACITY map (which part serves which capacity, and whether it is VITAL — a part whose
// capacity reaching 0 ends the life):
//   leg   → moving         arm → manipulation       eye → sight
//   torso → moving + manipulation, and VITAL (torso destroyed ⇒ dead).
// Severity is a 1..10 wound depth; each point of severity removes 10% of every capacity the part
// serves, so a severity-10 wound destroys that part's contribution (drives the capacity to 0).
//
// health(thing) -> { capacities:{moving,manipulation,sight}, injuries:[{part,severity}], alive }
//   thing : a settled being { entity, fiber:[{ predicate, object, value:{pos,neg,glyph}, ... }] }
//   capacities are integer PERCENTS in [0,100]; alive is false when a VITAL capacity hits 0.
// healthOf(root, subject, opts?) = health(await settle(root, subject)).
//
// injure({root,agent,subject,part,severity,t}) — a `changing` that files an injury cell
//   {e:subject, a:"injury:<part>", v:severity}. injury:<part> is FUNCTIONAL-by-convention here:
//   we read the LATEST injury cell per part off the fiber (max-t), so a new wound supersedes the
//   old reading and healing can lower it — without mutating history (append-only).
// heal({root,subject,part,t,by?}) — reduce a part's severity by `by` (default: clear to 0). A
//   severity that reaches 0 is recorded as injury:<part>=0 (a healed part contributes nothing).
//   CLI: node health.mjs <world> <subject>

import { holds } from "#value";
import { settle, rowsFor, FUNCTIONAL } from "#substrate";
import doing from "#doing";

const INJURY = "injury:";

// PARTS — which capacity each part serves, and whether the part is vital.
export const PARTS = Object.freeze({
  leg: { serves: ["moving"], vital: false },
  arm: { serves: ["manipulation"], vital: false },
  eye: { serves: ["sight"], vital: false },
  torso: { serves: ["moving", "manipulation"], vital: true },
});
export const CAPACITIES = Object.freeze(["moving", "manipulation", "sight"]);
const MAX_SEVERITY = 10; // a severity-10 wound destroys the part's contribution (10% per point).

export const injuryPredicate = (part) => `${INJURY}${part}`;

// readInjuries — pull the current injury reading off a settled fiber. The caller settles injury:
// predicates as FUNCTIONAL (latest-t per part wins — see healthOf), so the fiber already carries
// at most ONE injury:<part> cell per part: the current reading, healing included. Only positive-
// evidence (`holds`) cells with severity > 0 count as live wounds; a healed-to-0 cell drops out.
// If a part somehow carries more than one cell (called on a non-superseded fiber), the HIGHEST
// severity is kept so a stale read never under-reports a wound.
function readInjuries(thing) {
  const byPart = new Map();
  for (const cell of thing.fiber) {
    if (typeof cell.predicate !== "string" || !cell.predicate.startsWith(INJURY)) continue;
    const part = cell.predicate.slice(INJURY.length);
    if (!part) continue;
    if (!holds(cell.value)) continue; // require positive evidence the wound is in force
    const severity = Number(cell.object);
    if (!Number.isFinite(severity) || severity <= 0) continue;
    const sev = Math.min(MAX_SEVERITY, Math.max(0, Math.round(severity)));
    if (!byPart.has(part) || sev > byPart.get(part)) byPart.set(part, sev);
  }
  return [...byPart.entries()]
    .map(([part, severity]) => ({ part, severity }))
    .sort((a, b) => a.part.localeCompare(b.part));
}

export default function health(thing) {
  if (!thing || !Array.isArray(thing.fiber)) {
    throw new TypeError("health: thing must be a settled being { entity, fiber }");
  }
  const injuries = readInjuries(thing);

  // Each capacity starts at 100% and is reduced by every injury to a part that serves it.
  const capacities = {};
  for (const cap of CAPACITIES) capacities[cap] = 100;
  for (const { part, severity } of injuries) {
    const spec = PARTS[part];
    if (!spec) continue; // an unknown part injures nothing derivable
    const reduction = severity * 10; // 10% per point of severity
    for (const cap of spec.serves) capacities[cap] = Math.max(0, capacities[cap] - reduction);
  }

  // alive — false when a VITAL part's served capacity has hit 0 (the wound is mortal).
  let alive = true;
  for (const { part, severity } of injuries) {
    const spec = PARTS[part];
    if (!spec || !spec.vital) continue;
    if (spec.serves.some((cap) => capacities[cap] <= 0)) alive = false;
  }

  return deepFreeze({ capacities, injuries, alive });
}

function deepFreeze(v) {
  if (v && typeof v === "object" && !Object.isFrozen(v)) {
    for (const c of Object.values(v)) deepFreeze(c);
    Object.freeze(v);
  }
  return v;
}

// healthOf — settle the subject with injury:<part> predicates folded in as FUNCTIONAL (latest-t
// per part wins), so a heal lowering a wound (or a heavier wound) supersedes the prior reading
// without rewriting history. We union the substrate's FUNCTIONAL set with every injury:<part>
// predicate found on the subject's trace, then read capacities off the superseded fiber.
export async function healthOf(root, subject, opts = {}) {
  const rows = await rowsFor(root, subject);
  const functional = new Set(FUNCTIONAL);
  for (const r of rows) {
    if (typeof r.a === "string" && r.a.startsWith(INJURY)) functional.add(r.a);
  }
  const settleOpts = { ...(opts.settle ?? {}), functional };
  return health(await settle(root, subject, settleOpts));
}

// injure — file an injury cell. Latest-t reading wins, so a heavier wound (or a heal lowering it)
// supersedes the prior reading without rewriting history. The object IS the severity (clamped
// 1..10). Attributed to `agent` when given (the reified enacted-by row).
export async function injure({ root, agent, subject, part, severity, t }) {
  if (!root || subject == null || part == null || severity == null || t == null) {
    throw new TypeError("injure: root, subject, part, severity, t are required");
  }
  const sev = Math.min(MAX_SEVERITY, Math.max(1, Math.round(Number(severity))));
  return doing({ root, agent, subject, predicate: injuryPredicate(part), object: sev, t });
}

// heal — lower a part's severity. With `by` unset the part is cleared (healed to 0); otherwise the
// current reading drops by `by` (floored at 0). A 0 reading is filed so the latest cell reads as
// no-wound. Reads the part's current severity off disk (latest injury:<part> row) to compute the
// new value, then files it as a fresh (later-t) cell — append-only.
export async function heal({ root, subject, part, t, by, agent }) {
  if (!root || subject == null || part == null || t == null) {
    throw new TypeError("heal: root, subject, part, t are required");
  }
  const pred = injuryPredicate(part);
  let current = 0;
  for (const r of await rowsFor(root, subject)) {
    if (r.e === subject && r.a === pred && r.v != null) {
      const v = Number(r.v);
      if (Number.isFinite(v)) current = v; // append-only log is in write order; last wins
    }
  }
  const next = by == null ? 0 : Math.max(0, Math.round(current - Number(by)));
  return doing({ root, agent, subject, predicate: pred, object: next, t });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [world, subject] = process.argv.slice(2);
  if (!world || !subject) {
    console.error("usage: node health.mjs <world> <subject>");
    process.exit(2);
  }
  console.log(JSON.stringify(await healthOf(world, subject)));
}
