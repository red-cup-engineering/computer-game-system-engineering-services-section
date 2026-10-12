// violence — SYMBOLIC VIOLENCE as a VIEW, never a deletion. `governing/library/violence/` is the
// observer-apparatus side of ⊤-processing governance: a body in a field holds a contested position (a
// ⊤ — recognized AND excluded), and the field's dominant apparatus SUPPRESSES one face of the
// contradiction so the position reads as settled (t, or f) to those who look through that apparatus.
// This is Bourdieu's symbolic violence: the misrecognition of an arbitrary order as natural — enacted
// here as the observer's `perceives` selecting WHICH WITNESS it keeps. THE HISTORY STAYS INTACT.
//
// LAW (FORK RESOLUTION): suppression is a VIEW. We do NOT append falsifying counter-evidence to
// "repair" a ⊤; we do NOT mutate or delete the suppressed face's rows. The contradiction remains in
// the trace, fully witnessed. Symbolic violence is what an OBSERVER's apparatus does on READ: it drops
// one face's witness rows from the cut it presents, so the cell folds (for that observer) to the
// surviving face. A different observer — or the same one without the apparatus — folds the ⊤ back. The
// violence is in the LOOKING, not in the record.
//
// HOW IT WORKS. An apparatus is `{ observer, suppress:[{predicate, face}...] }`: for each contested
// cell it names, it suppresses the `pos` face (making the cell read f/excluded — the dominated lose
// recognition) or the `neg` face (making it read t/recognized — the dominant's claim naturalized). The
// apparatus is applied as a WITNESS FILTER over the rows before the fold: drop the rows that witness
// the suppressed face. `apparatusView(rows, apparatus)` returns the filtered rows; folding them yields
// the misrecognized (settled-looking) fiber, while folding the UNFILTERED rows yields the true ⊤.
//
//   apparatusView(rows, apparatus, witnessOf) -> rows'   the rows the apparatus lets through (suppressed face dropped)
//   suppresses(apparatus, predicate) -> "pos"|"neg"|null  which face this apparatus suppresses on a cell
//   misrecognized(trueFiber, viewFiber) -> [{predicate,object,was,now}]  the cells the view settled that were ⊤
//
// Pure: a read-side filter over rows + the two folds. No disk, no mutation. The trace is never touched.

import { isTop } from "#value";

// the apparatus's suppression directive for a cell: returns "pos" | "neg" | null. A `pos` suppression
// drops positive-face witnesses (the cell reads f — recognition withheld); a `neg` suppression drops
// negative-face witnesses (the cell reads t — exclusion erased, the claim naturalized).
export function suppresses(apparatus, predicate, object) {
  if (!apparatus || !Array.isArray(apparatus.suppress)) return null;
  for (const s of apparatus.suppress) {
    if (s.predicate !== predicate) continue;
    if (s.object !== undefined && s.object !== object) continue;
    if (s.face === "pos" || s.face === "neg") return s.face;
  }
  return null;
}

// apparatusView — the SUPPRESSING READ. Given the full trace `rows`, a body's witnessed fiber (to know
// which rows witness which face of which cell), and an apparatus, return the rows the apparatus lets
// THROUGH: every row, EXCEPT the rows that witness the suppressed face of a suppressed cell. The caller
// folds these to get the misrecognized (settled-looking) fiber. The dropped rows are NOT deleted — they
// are simply absent from THIS observer's cut. `witnessedFiber` is being(subject, rows, {witness:true}).
//
// witness ids are `row:`-prefixed (being's presentation); a base row's id is matched by rowIdOf so we
// can tell whether a given trace row is the one a witness list points at.
export function apparatusView(rows, witnessedFiber, apparatus, rowIdOf) {
  if (!Array.isArray(rows)) throw new TypeError("apparatusView: rows must be an array");
  if (!apparatus) return rows.slice();
  // collect the witness-row-ids to suppress: for each contested cell the apparatus names, the ids of
  // the suppressed face's witnesses.
  const suppressedIds = new Set();
  for (const cell of witnessedFiber.fiber ?? []) {
    if (!cell.witness) continue;
    const face = suppresses(apparatus, cell.predicate, cell.object);
    if (!face) continue;
    for (const id of cell.witness[face] ?? []) suppressedIds.add(id);
  }
  if (suppressedIds.size === 0) return rows.slice();
  // drop the rows whose `row:`-id is a suppressed witness. A non-base row (a converse decl, a reified
  // attribution) is kept unless it is itself the suppressed witness.
  return rows.filter((r) => {
    const id = rowIdOf(r);
    return !suppressedIds.has(id);
  });
}

// misrecognized — the cells where the apparatus DID symbolic violence: cells that were ⊤ in the true
// fiber but read settled (t or f) in the apparatus's view. Each entry shows the suppression: what the
// cell WAS (⊤) and what the view made it read NOW. The truth is still in `trueFiber` — this just names
// the misrecognitions the apparatus produced. A reader/auditor uses it to surface the violence (the
// history is intact, so the suppression is always recoverable and namable).
export function misrecognized(trueFiber, viewFiber) {
  const out = [];
  for (const tc of trueFiber.fiber ?? trueFiber) {
    if (!isTop(tc.value)) continue;
    const vc = (viewFiber.fiber ?? viewFiber).find((c) => c.predicate === tc.predicate && c.object === tc.object);
    if (vc && !isTop(vc.value)) {
      out.push({ predicate: tc.predicate, object: tc.object, was: "⊤", now: vc.value.glyph });
    }
  }
  return out;
}
