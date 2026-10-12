// closure — mood / experience read off a settled being as CLOSURE DISTANCE. Progression is
// SETTLEMENT, not a designed gate: a fiber's "mood" is how far it sits from its settled fixed
// point. A fiber is CLOSED when every cell is determined (not ⊥) and non-contradictory (not ⊤);
// at that fixed point its distance is 0. Distance is the count of cells holding it OFF that
// point: the ⊥ open cells (honest ignorance, not yet settled) plus the ⊤ contested cells
// (a situation the world still argues). This is the same `closed` predicate `fold` (grow.mjs)
// uses for the tower step, lifted to a quantity — fold asks "distance === 0?", closure measures
// the gap. Mirror of `richness`: pure, reads only the fiber + `#value`; a quote, not a move.
//
// closure(thing) -> { determined, open, contested, distance, closed, fraction, potential? }
//   thing : a settled being { entity, fiber:[{ predicate, object, value:{pos,neg,glyph}, ... }] }
//   determined : cells settled to a definite face (t, f, or ⊤)
//   open       : ⊥ cells (no evidence either way)
//   contested  : ⊤ cells (both faces asserted — a situation)
//   distance   : open + contested — cells keeping the fiber off its fixed point
//   closed     : distance === 0 AND the fiber is non-empty (nothing settled is not "closed")
//   fraction   : determined / (determined + distance) in [0,1]; 1 ⇒ fully settled toward t/f
//   potential  : (only present when the fiber carries `articulating` rows) the count of OPENED-but-
//                undetermined cells — ⊥-as-OPENED, distinguished from ⊥-as-ABSENT. An aperiodic seed
//                made visible: a question held open is closer to its fixed point than a never-asked one,
//                so the descent can SEE the opened cells distinct from the merely-silent ones. The
//                opened cells are a SUBSET of the ⊥ `open` count (an opened cell whose target is still
//                ⊥). The four-corner bilattice is untouched — `potential` is a row-kind reading, not a
//                fifth value.
// closureOf(root, subject, opts?) = closure(await settle(root, subject)).

import { isDetermined, isTop } from "#value";
import { settle } from "#substrate";
import { openings } from "#articulating";

export default function closure(thing) {
  if (!thing || !Array.isArray(thing.fiber)) {
    throw new TypeError("closure: thing must be a settled being { entity, fiber }");
  }

  let determined = 0;
  let open = 0;
  let contested = 0;
  for (const cell of thing.fiber) {
    const v = cell.value;
    if (!isDetermined(v)) {
      open += 1; // ⊥ — still off the fixed point on the "no evidence" side
      continue;
    }
    determined += 1;
    if (isTop(v)) contested += 1; // ⊤ — determined, but a contradiction holds it off the point
  }

  const distance = open + contested;
  const total = determined + distance;
  const out = {
    determined,
    open,
    contested,
    distance,
    // CLOSED: every cell determined and non-⊤ (distance 0), and the fiber is non-empty.
    closed: distance === 0 && thing.fiber.length > 0,
    // closure FRACTION: how settled the whole fiber is, in [0,1]. An empty fiber is 0.
    fraction: total === 0 ? 0 : determined / total,
  };

  // POTENTIAL-CELL surfacing: only when the fiber actually carries `articulating` rows do we count the
  // OPENED-but-still-⊥ cells. With no articulations (every existing fixture) the output shape is
  // byte-identical to before — `potential` is simply absent, so callers reading the old fields are
  // untouched. An opened cell whose target predicate is still ⊥ is ⊥-as-OPENED (an aperiodic seed);
  // it is a subset of `open`.
  const opened = openings(thing.fiber);
  if (opened.length > 0) {
    let stillOpen = 0;
    for (const spec of opened) {
      const answered = thing.fiber.some(
        (c) => c.predicate === spec.predicate
          && (spec.object === undefined || c.object === spec.object)
          && isDetermined(c.value),
      );
      if (!answered) stillOpen += 1;
    }
    out.potential = stillOpen;
  }

  return out;
}

export async function closureOf(root, subject, opts = {}) {
  return closure(await settle(root, subject, opts.settle ?? {}));
}

// isClosed — closure DISTANCE as the QUIESCENCE PREDICATE the WORKING iterate-to-quiescence operator
// (being/doing/working/iterate.mjs) tests a fiber against: a fiber is at its fixed point when its
// closure distance is 0 (every cell determined and non-⊤). This is the bridge that makes closure.mjs's
// "distance" and working's "iterate to quiescence" ONE thing: the operator stops when isClosed holds.
// Takes a settled thing (or anything closure() accepts). (A ⊤ cell keeps a fiber OFF the fixed point as
// a contested distance — distinct from the closure ENGINE, which CLOSES AGAINST ⊤ while firing rules.)
export const isClosed = (thing) => closure(thing).closed;

if (import.meta.url === `file://${process.argv[1]}`) {
  const [world, subject] = process.argv.slice(2);
  if (!world || !subject) {
    console.error("usage: node closure.mjs <world> <subject>");
    process.exit(2);
  }
  const c = await closureOf(world, subject);
  console.log(JSON.stringify(c));
}
