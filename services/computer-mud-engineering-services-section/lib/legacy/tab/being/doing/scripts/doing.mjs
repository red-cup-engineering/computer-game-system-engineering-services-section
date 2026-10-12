// doing — a MOVE = an intra-action. `doing/` nests inside `being/` because doing works on
// being's residue: being folds the trace into settled state, and doing appends the next
// intra-action back onto that trace. An entity's settled state IS its being; being is enacted
// by doing.
//
// Conformant to the EAVT/SPOT standard: doing appends the base row {e:subject, a:predicate,
// v:object, t} and, optionally, a REIFIED row about it — (rowId, 'enacted-by', agent) naming
// the agency that made the cut. Opposing evidence is just `doing` with the CONVERSE predicate
// (no polarity field). The world is on disk; doing only ever appends — never rewrites, never
// deletes. Relational predications are dual-filed by the substrate (subject + object anchor).
//
// doing({ root, agent, subject, predicate, object, t }) -> { row, id }

import { append } from "#substrate";
import { rowId } from "#eavt-row";

export default async function doing({ root, agent, subject, predicate, object, t }) {
  if (!root || subject == null || predicate == null || object === undefined || t == null) {
    throw new TypeError("doing: root, subject, predicate, object, t are required");
  }
  const base = { e: subject, a: predicate, v: object, t };
  await append(root, subject, base); // substrate dual-files relational rows at the object anchor
  const id = rowId(base);
  if (agent !== undefined) await append(root, subject, { e: id, a: "enacted-by", v: agent, t });
  return { row: base, id };
}

// declareConverse — on `subject`'s trace, declare that predication `p` has converse `q`, so
// `being(subject)` folds q-rows as negative evidence for the p-cell. The conformant row is
// {e:p, a:'has-converse', v:q}: being reads it as converse[q] = p (the cell orients at p, the
// positive predicate). Filed on the subject's own log so the declaration travels with it.
export async function declareConverse(root, subject, p, q, t) {
  await append(root, subject, { e: p, a: "has-converse", v: q, t });
}

// retract — undo a predication the honest way: append a NEW countering row with v:null. being
// skips null rows, so the cell loses its positive evidence; history is never mutated.
export async function retract({ root, subject, predicate, t }) {
  if (!root || subject == null || predicate == null || t == null) {
    throw new TypeError("retract: root, subject, predicate, t are required");
  }
  const row = { e: subject, a: predicate, v: null, t };
  await append(root, subject, row);
  return { row };
}
