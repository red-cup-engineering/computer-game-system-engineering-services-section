// socialize — relationships as COMPOSING fibers. `socializing/` nests under `responding/` because
// an opinion is computed the same way an interaction is: by composing one fiber against another
// (respond / ⊙), never rolled. The Dwarf-Fortress / RimWorld reading: A's stance toward B is a
// function of how their social make-up AGREES or OPPOSES — shared traits pull toward friendship,
// opposed traits toward rivalry, and a fiber that supplies BOTH warm and cold evidence settles to
// ⊤ (ambivalent — a real, contested relationship, not a bug). Deterministic: same fibers in, same
// stance out; nothing here consults a clock or RNG.
//
// SOCIAL CONVENTION (entity cells the opinion reads):
//   disposition=<warm|cold>     — the NPC's baseline social temperature.
//   trait=<name>                — character traits (the existing `trait=<x>` cell convention).
//   opinion-of:<other>=<stance> — the RECORDED relationship (functional-by-convention; latest wins).
// A is WARM toward B when they SHARE social signal (same disposition, and/or shared traits); COLD
// when they OPPOSE (warm-vs-cold disposition, or a trait one holds and the other holds its converse
// via a `trait has-converse anti-trait` style declaration — here we read opposition as a trait B
// holds whose name appears among A's `dislikes=<name>` cells, and shared as A's `trait` ∩ B's
// `trait`). Warm-only → friend; cold-only → rival; both → ambivalent (⊤); neither → neutral.
//
// opinion(aThing, bThing) -> { stance:'friend'|'rival'|'neutral'|'ambivalent', glyph, basis }
//   a/bThing : settled beings { entity, fiber:[...] }. PURE — reads the two fibers only.
//   basis    : { shared:[trait...], opposed:[trait...], dispositionA, dispositionB } — why.
// socialize({root, agent:a, other:b, t}) — settle both, compute opinion, file opinion-of:<b> on A.
// relationshipsOf(root, subject) -> [{ other, stance, glyph }]  (A's recorded opinions).
//   CLI: node socialize.mjs <world> <a> <b>

import { value, glyph as glyphOf, holds, isTop } from "#value";
import { settle, rowsFor, FUNCTIONAL } from "#substrate";
import doing from "#doing";

export const OPINION = "opinion-of:";
export const opinionPredicate = (other) => `${OPINION}${other}`;

// cellsWith — the objects of every positive-evidence cell on `thing` whose predicate is `pred`.
const cellsWith = (thing, pred) =>
  thing.fiber.filter((c) => c.predicate === pred && holds(c.value)).map((c) => c.object);

const firstCell = (thing, pred) => cellsWith(thing, pred)[0];

export default function opinion(aThing, bThing) {
  if (!aThing || !Array.isArray(aThing.fiber)) throw new TypeError("opinion: aThing must be a settled being");
  if (!bThing || !Array.isArray(bThing.fiber)) throw new TypeError("opinion: bThing must be a settled being");

  const aTraits = new Set(cellsWith(aThing, "trait"));
  const bTraits = new Set(cellsWith(bThing, "trait"));
  const aDislikes = new Set(cellsWith(aThing, "dislikes"));
  const dispositionA = firstCell(aThing, "disposition") ?? null;
  const dispositionB = firstCell(bThing, "disposition") ?? null;

  // SHARED — traits both hold (a warm pull). OPPOSED — traits B holds that A explicitly dislikes
  // (a cold pull). Disposition agreement adds a warm signal; disposition clash adds a cold one.
  const shared = [...aTraits].filter((tr) => bTraits.has(tr)).sort();
  const opposed = [...bTraits].filter((tr) => aDislikes.has(tr)).sort();

  let warm = shared.length > 0;
  let cold = opposed.length > 0;
  if (dispositionA && dispositionB) {
    if (dispositionA === dispositionB) warm = true;            // same temperature → warm signal
    else cold = true;                                          // warm vs cold → cold signal
  }

  // Compose the two signals into a bilattice mark the SAME way the fiber fold does: a warm signal
  // is a positive face (t), a cold signal the converse face (f). Both present fuse to ⊤ — exactly
  // what being() produces when a cell and its converse co-occur — so the stance and its glyph stay
  // consistent with the rest of TAB. (0,0) is ⊥: no signal either way → neutral.
  const mark = value(warm ? 1 : 0, cold ? 1 : 0);

  let stance;
  if (isTop(mark)) stance = "ambivalent";
  else if (mark.pos === 1 && mark.neg === 0) stance = "friend";
  else if (mark.pos === 0 && mark.neg === 1) stance = "rival";
  else stance = "neutral";

  return Object.freeze({
    stance,
    glyph: glyphOf(mark),
    basis: Object.freeze({ shared, opposed, dispositionA, dispositionB }),
  });
}

// socialize — the effectful move: settle A and B (A through its own view), compute the opinion,
// and file it as a functional opinion-of:<b> cell on A's trace (attributed to A as the agent that
// formed the view). Returns the computed opinion and the appended row.
export async function socialize({ root, agent, other, t, a, b }) {
  const subject = a ?? agent;
  const target = b ?? other;
  if (!root || subject == null || target == null || t == null) {
    throw new TypeError("socialize: root, agent (a), other (b), t are required");
  }
  const aThing = await settle(root, subject, { observer: subject });
  const bThing = await settle(root, target);
  const op = opinion(aThing, bThing);
  const { row, id } = await doing({
    root, agent: subject, subject, predicate: opinionPredicate(target), object: op.stance, t,
  });
  return { opinion: op, row, id };
}

// settleWithOpinionsFunctional — settle a subject with its opinion-of:<other> predicates folded
// in as FUNCTIONAL, so re-socializing supersedes the prior recorded stance (latest-t per other
// wins) without rewriting history — the same trick health uses for injury:<part>.
async function settleWithOpinionsFunctional(root, subject, extra = {}) {
  const rows = await rowsFor(root, subject);
  const functional = new Set(FUNCTIONAL);
  for (const r of rows) if (typeof r.a === "string" && r.a.startsWith(OPINION)) functional.add(r.a);
  return settle(root, subject, { ...extra, functional });
}

// relationshipsOf — A's recorded opinions: every opinion-of:<other> cell on its settled fiber.
export async function relationshipsOf(root, subject, opts = {}) {
  const thing = await settleWithOpinionsFunctional(root, subject, opts.settle ?? {});
  return thing.fiber
    .filter((c) => typeof c.predicate === "string" && c.predicate.startsWith(OPINION))
    .map((c) => ({ other: c.predicate.slice(OPINION.length), stance: c.object, glyph: c.value.glyph }))
    .sort((x, y) => x.other.localeCompare(y.other));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [world, a, b] = process.argv.slice(2);
  if (!world || !a || !b) {
    console.error("usage: node socialize.mjs <world> <a> <b>");
    process.exit(2);
  }
  const aThing = await settle(world, a, { observer: a });
  const bThing = await settle(world, b);
  console.log(JSON.stringify(opinion(aThing, bThing)));
}
