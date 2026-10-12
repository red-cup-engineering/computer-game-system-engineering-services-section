// being — the generator of `thing`. An entity's settled state IS its being; being is enacted by
// doing (which is why `doing/` nests inside `being/`). being folds a CONFORMANT EAVT/SPOT trace —
// a multiset of {e,a,v,t} rows — into the settled thing.
//
// The FOLD itself is no longer hand-rolled here: @561-group/computer/posix-holography/eavt-substrate's `fold` is the
// canonical read->fold->settle spine — it folds the trace into a fiber of cells, one per distinct
// (predicate, object), each carrying a four-bilattice charge over a LOSSLESS evidence carrier
// (math's joinKnowledge): the content-ids of the rows that witness each face. So a cell told both
// its predicate AND its converse settles to ⊤ (a HELD value, not an error). Negative evidence is
// the CONVERSE predication ((p has-converse q) rows or opts.converse), never a polarity field;
// retraction tombstones ({e:subject,a,v:null,t}) honestly undo, append-only.
//
// What STAYS in tab is the reified-ATTRIBUTION presentation layer substrate.fold deliberately does
// not carry: WHO enacted each cut (the reified `enacted-by` rows → cell.observers), the `glyph` of
// the value, and the opt-in `witness` view of each face's justifying rows. being projects
// substrate.fold's `value.evidence` (the lossless carrier) into tab's `row:`-prefixed witness/
// observer presentation, so its public output shape is byte-identical to before.
//
// being(subject, rows, opts?) -> { entity, fiber: [{ predicate, object, value, observers }] }
// opts.witness === true also emits, per cell, witness: { pos:[rowId...], neg:[rowId...] }.

import { fold, isReified, REIFIED_PREFIX } from "@561-group/computer/posix-holography/eavt-substrate";
import { rowId } from "#eavt-row";
import { glyph } from "#value";

// The reified key a fold-evidence content-id maps back to: tab's `row:`+16-hex presentation. A
// reified attribution row carries this in its `e` (e = reify(base)); fold's evidence carries the
// full content-id of the same base row, so `row:` + its first 16 hex is the bridge between them.
const reifiedKeyOf = (contentId) => `${REIFIED_PREFIX}${contentId.slice(0, 16)}`;

export default function being(subject, rows, opts = {}) {
  if (typeof subject !== "string" || !subject) throw new TypeError("being: subject must be a non-empty string");
  if (!Array.isArray(rows)) throw new TypeError("being: rows must be an EAVT/SPOT array");

  // The canonical fold: cells with charges over a lossless evidence carrier. converse + retraction
  // are substrate.fold's (it reads (p has-converse q) from the trace and merges opts.converse).
  const folded = fold(subject, rows, { converse: opts.converse });

  // Reified attributions: reify(base)-id -> set of observers who enacted that cut. This is tab's
  // own layer — substrate.fold drops reified rows from the state fold and hands us the evidence to
  // re-attach them by.
  const observerOf = new Map();
  for (const r of rows) {
    if (r.a === "enacted-by" && isReified(r.e)) {
      if (!observerOf.has(r.e)) observerOf.set(r.e, new Set());
      observerOf.get(r.e).add(r.v);
    }
  }

  const fiber = folded.fiber.map((c) => {
    const v = { pos: c.value.pos, neg: c.value.neg };
    // witness ids in tab's `row:`-prefixed presentation, projected off fold's lossless carrier.
    const witPos = c.value.evidence[0].map(reifiedKeyOf);
    const witNeg = c.value.evidence[1].map(reifiedKeyOf);
    // observers of this cell: who enacted any of its witnessing rows.
    const observers = new Set();
    for (const id of [...witPos, ...witNeg]) for (const o of observerOf.get(id) ?? []) observers.add(o);
    const out = {
      predicate: c.predicate,
      object: c.object,
      value: { pos: v.pos, neg: v.neg, glyph: glyph(v) },
      observers: [...observers].sort(),
    };
    if (opts.witness) out.witness = { pos: [...witPos].sort(), neg: [...witNeg].sort() };
    return out;
  });

  return deepFreeze({ entity: subject, fiber });
}

function deepFreeze(v) {
  if (v && typeof v === "object" && !Object.isFrozen(v)) {
    for (const c of Object.values(v)) deepFreeze(c);
    Object.freeze(v);
  }
  return v;
}
