// why — the WITNESS / derivation seam: promote being's opt-in `witness` view into a PUBLIC
// `why(root, subject, predicate, object)` that answers "why does this cell hold the value it holds?"
// `why/` is part of working's ontology because the answer is a REPLAYABLE DERIVATION: the cell's
// bilattice value, the witness rows that justify each face (pos / neg), and — when the cell was
// produced by the WORKING engine — which closure RULES fired to derive it. Nothing here is new
// evidence; it READS the lossless witness carrier being already projects (being.mjs `opts.witness`)
// and the closure firing trace (closing.mjs `fired`). The derivation is the apparatus made legible.
//
// THREE LAYERS OF AN ANSWER:
//   VALUE   — the cell's four-corner bilattice value (⊥/t/f/⊤) and glyph, off the settled fiber.
//   WITNESS — { pos:[rowId...], neg:[rowId...] }: the `row:`-prefixed content-ids of the rows that
//             supplied each face. This is being's opt-in witness view, now surfaced publicly. A ⊤ cell
//             shows BOTH lists non-empty — the contradiction's two sides, each traceable to its row.
//   RULES   — when the value was DERIVED by a closure (not asserted directly), which closure rules
//             fired to land it: the firing trace, so the derivation REPLAYS (close again → same firing).
//
// REPLAYABILITY. `why` is pure-read and deterministic: given the same trace and rule-system, it returns
// the same witness and firing every time. The firing trace is obtained by RE-CLOSING the subject's
// fiber under its rule-system (closeFiber is pure) and matching the queried cell against the `fired`
// list — so the derivation is not stored, it is RE-DERIVED on demand, which is the strongest sense of
// replayable (the answer IS the replay). A directly-asserted cell has an empty rule list (no derivation
// — it was simply told); its witness rows are the whole story.
//
//   why({root, subject, predicate, object, observer?}) -> {
//     value:{pos,neg,glyph}, witness:{pos,neg}, rules:[{rule,then}], derived:boolean, present:boolean }
//   whyFiber(thing, rows, predicate, object) -> same shape   PURE: over an already-settled thing + rows
//
// Pure read where it can be: `whyFiber` touches no disk; `why` reads the subject's trace once.

import being from "#being";
import { glyph } from "#value";
import { settle, rowsFor, supersede, frontier } from "#substrate";
import { closeFiber, readRules } from "#working";

// matchCell — find the queried cell in a fiber. `object` undefined matches the predicate's first cell;
// otherwise the (predicate, object) cell exactly. Returns the cell or null.
function matchCell(fiber, predicate, object) {
  return fiber.find((c) => c.predicate === predicate && (object === undefined || c.object === object)) ?? null;
}

// the sub-stamp the closure engine writes its fired consequents under (closing.mjs: `${t}/close:NNNN`).
// A row whose `t` carries this is a DERIVED row, not a base assertion; the derivation replay closes over
// the BASE rows only (stripping these), so re-firing produces the same consequents instead of seeing them
// already held (which would report nothing fired).
const CLOSE_STAMP = /(^|\/)close:/;

// whyFiber — the PURE derivation read. Given a thing settled WITH witness (being(subject, rows,
// {witness:true})) and the backing rows, answer why (predicate, object) holds its value:
//   - value/witness: read straight off the witnessed cell.
//   - rules: re-close the BASE fiber (rows minus already-derived /close: rows) under its OWN rule-system
//     and report which firings produced THIS cell (a firing whose `then` matches the query). Empty ⇒ the
//     cell was asserted, not derived. `derived` is true iff at least one firing produced it.
// Deterministic: closeFiber is pure and the firing order is fixed, so the rule list replays identically.
export function whyFiber(thing, rows, predicate, object) {
  if (!thing || !Array.isArray(thing.fiber)) throw new TypeError("whyFiber: thing must be a witnessed being");
  const cell = matchCell(thing.fiber, predicate, object);
  const present = !!cell;
  const v = cell ? cell.value : { pos: 0, neg: 0, glyph: glyph({ pos: 0, neg: 0 }) };
  const witness = cell && cell.witness ? { pos: [...cell.witness.pos], neg: [...cell.witness.neg] } : { pos: [], neg: [] };

  // which closure rules, fired off this subject's rule-system, PRODUCED this cell? Re-close (pure) over
  // the BASE rows (strip already-derived /close: consequents so the firing replays) and match the firing
  // trace against the query. This is the replayable derivation.
  const rules = readRules(thing.fiber);
  const fired = [];
  if (rules.length) {
    const baseRows = rows.filter((r) => !(typeof r.t === "string" && CLOSE_STAMP.test(r.t)));
    const closed = closeFiber(thing.entity, baseRows, rules);
    for (const f of closed.fired) {
      if (f.predicate === predicate && (object === undefined || f.object === object)) {
        fired.push({ rule: f.rule, then: { predicate: f.predicate, object: f.object } });
      }
    }
  }

  return {
    value: { pos: v.pos, neg: v.neg, glyph: v.glyph ?? glyph(v) },
    witness,
    rules: fired,
    derived: fired.length > 0,
    present,
  };
}

// why — the PUBLIC, effectful seam. Read the subject's trace (optionally through an observer's
// frontier), settle it WITH witness, and answer the derivation query. The disk read is the only effect;
// the answer is otherwise pure. `observer` localizes the witness to that observer's sensory cut (so
// `why` respects the same apparatus the renderer uses). Returns value + witness + the closure rules that
// fired to derive the cell (replayable).
export default async function why({ root, subject, predicate, object, observer } = {}) {
  if (!root || subject == null || predicate == null) {
    throw new TypeError("why: root, subject, predicate are required");
  }
  let rows = await rowsFor(root, subject);
  if (observer) rows = frontier(rows, observer);
  rows = supersede(rows);
  const thing = being(subject, rows, { witness: true });
  return whyFiber(thing, rows, predicate, object);
}
