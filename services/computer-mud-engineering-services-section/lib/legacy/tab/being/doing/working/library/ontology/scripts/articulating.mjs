// articulating — the POTENTIAL-CELL: a ROW-KIND that OPENS a cell without determining it. The
// four-regime descent's APERIODIC seed: before a cell settles to a face, the articulation that opened
// it is already there — a possible-someone, a question held open. `articulating/` is part of working's
// ontology library because an opened cell is the thing the closure engine works ON: a potential
// articulation that a rule (or an intra-action) may later determine.
//
// THE DISTINCTION. `being`'s fold settles each (predicate, object) it has rows for into a four-corner
// bilattice value. A cell with NO positive and NO negative evidence reads ⊥ — but there are TWO ⊥s the
// flat fold cannot tell apart:
//   ⊥-as-ABSENT  — no one ever raised this articulation; the (predicate, object) is simply not in play.
//   ⊥-as-OPENED  — someone OPENED this articulation (asked the question, named the possible-someone)
//                  but no evidence has yet settled it either way. A held-open question, an aperiodic seed.
// A POTENTIAL-CELL is the second. It is NOT a fifth bilattice value — the four corners math/bilattice
// provides are untouched. It is a ROW-KIND: a predication `(subject, "articulating", {predicate, object})`
// that DECLARES the cell open. The bilattice value of the articulated cell stays ⊥ until evidence lands;
// the articulation row is just a SECOND fact about that cell — that it was opened.
//
// HOW IT READS. `openings(fiber)` returns the (predicate, object) pairs the fiber holds an `articulating`
// row for. `potential(thing)` partitions a settled fiber: which articulated cells are still ⊥ (genuinely
// potential — opened, undetermined), which have since been determined (the question got answered), and
// which determined cells were never articulated (settled without ever being held open). This lets
// `closure` distinguish ⊥-as-opened from ⊥-as-absent and surface the aperiodic seed as data.
//
// APPEND-ONLY. Opening a cell is one appended `articulating` row; it is never retracted to "un-open"
// (the question was asked; that is history). Determination is the ordinary evidence that lands on the
// cell's own predicate later — the articulation and the answer are distinct rows, both kept.

import { isDetermined } from "#value";

// the predicate a potential-cell is opened under. A row (subject, "articulating", {predicate, object})
// declares "the cell (predicate, object) is OPEN on this subject" — held open, not yet settled.
export const ARTICULATING = "articulating";

// openSpec — normalize an `articulating` cell's object into its opened (predicate, object) target, or
// null if malformed. The object is `{ predicate, object? }`: the cell this articulation holds open. An
// unpinned `object` (absent) opens the predicate generally (any object on it counts as the answer).
export function openSpec(object) {
  if (!object || typeof object !== "object") return null;
  if (typeof object.predicate !== "string" || object.predicate.length === 0) return null;
  return { predicate: object.predicate, object: object.object };
}

// openings — the set of cells a settled fiber holds OPEN: every HOLDING `articulating` cell, normalized
// to its (predicate, object) target. Deterministic order (fiber order). A reader uses this to know which
// ⊥s are opened-questions rather than mere absences.
export function openings(fiber) {
  const out = [];
  for (const c of fiber) {
    if (c.predicate !== ARTICULATING) continue;
    if (!c.value || c.value.pos !== 1) continue; // only a HOLDING articulation opens a cell
    const spec = openSpec(c.object);
    if (spec) out.push(spec);
  }
  return out;
}

// cellMatches — does a fiber cell answer an opened (predicate, object)? The predicate must match; if the
// opening pinned an object, that must match too (an unpinned opening is answered by any object on the
// predicate). Used to decide whether an opened question has since been determined.
function cellMatches(cell, spec) {
  if (cell.predicate !== spec.predicate) return false;
  return spec.object === undefined || cell.object === spec.object;
}

// potential — partition a settled being's fiber by the articulation distinction. Returns:
//   opened     — articulated cells STILL ⊥ on their target predicate: genuine potential-cells (the
//                question is open, nothing has settled it). These are the aperiodic seeds.
//   determined — articulated cells whose target predicate now carries a determined value (t/f/⊤): the
//                question got answered. The articulation became an actual cell.
//   spontaneous— determined cells that were NEVER articulated: settled without ever being held open.
// Each entry is { predicate, object }. `opened` is what `closure` adds to distance as ⊥-as-opened.
export function potential(thing) {
  if (!thing || !Array.isArray(thing.fiber)) {
    throw new TypeError("potential: thing must be a settled being { entity, fiber }");
  }
  const fiber = thing.fiber;
  const specs = openings(fiber);

  const opened = [];
  const determined = [];
  for (const spec of specs) {
    // is there ANY determined cell answering this opening?
    const answered = fiber.some((c) => c.predicate !== ARTICULATING && cellMatches(c, spec) && isDetermined(c.value));
    (answered ? determined : opened).push({ predicate: spec.predicate, object: spec.object });
  }

  // spontaneous: a determined cell with no opening that targets it.
  const spontaneous = [];
  for (const c of fiber) {
    if (c.predicate === ARTICULATING) continue;
    if (!isDetermined(c.value)) continue;
    const wasOpened = specs.some((spec) => cellMatches(c, spec));
    if (!wasOpened) spontaneous.push({ predicate: c.predicate, object: c.object });
  }

  return { opened, determined, spontaneous };
}

// articulatingRow — the row that OPENS a cell on `subject`: (subject, "articulating", {predicate,
// object?}). An authoring/closure helper so a rule's `then` or a DSL field can emit a potential-cell
// the same way it emits any other. Append-only; never retracted.
export const articulatingRow = (subject, predicate, object, t) => ({
  e: subject,
  a: ARTICULATING,
  v: object === undefined ? { predicate } : { predicate, object },
  t,
});
