// doing — a MOVE = an intra-action. The lab's `doing/` stratum (active closure).
//
// An agency enacts a predication on a subject, leaving a graded mark. Conformant to the
// EAVT/SPOT standard: it appends the base row {e:subject, a:predicate, v:object, t} and
// REIFIED rows about it — (rowId,'enacted-by',agent) for the agency that made the cut, and
// (rowId,'degree',mark) for the graded strength. Opposing evidence is just `doing` with the
// CONVERSE predicate (no polarity). The world is on disk; doing only appends.
//
// doing({root, agent, subject, predicate, object, degree?, t}) → { row, id }

import { append, RELATIONAL } from '#substrate';
import { rowId } from '#eavt-row/scripts/row-id.mjs';

export default async function doing({ root, agent, subject, predicate, object, degree, t }) {
  if (!root || subject == null || predicate == null || object == null || t == null) {
    throw new TypeError('doing: root, subject, predicate, object, t are required');
  }
  const base = { e: subject, a: predicate, v: object, t };
  await append(root, subject, base);
  // RELATIONAL rows are also filed at the object anchor (a cache), so the object's place can
  // be read locally ("what is located-in here?"). The row itself is unchanged ({e,a,v,t}).
  if (RELATIONAL.has(predicate) && typeof object === 'string') await append(root, object, base);
  const id = rowId(base);
  if (agent !== undefined) await append(root, subject, { e: id, a: 'enacted-by', v: agent, t });
  if (degree !== undefined) await append(root, subject, { e: id, a: 'degree', v: degree, t });
  return { row: base, id };
}

// Declare a converse pair on the subject's trace (p's opposing predication is q), so being
// folds q-rows as negative evidence for the p-cell. Conformant: a has-converse row.
export async function declareConverse(root, subject, p, q, t) {
  await append(root, subject, { e: p, a: 'has-converse', v: q, t });
}
