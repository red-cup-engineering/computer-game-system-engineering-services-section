// changing — a move on a FUNCTIONAL predication: state transition / spacetimemattering.
//
// `changing` is `doing` whose predicate is single-valued over time (an object is in ONE
// place; a dimension has ONE tick). The trace stays monotone (append-only); `_substrate`
// supersession reads the latest-t row, so a change supersedes its predecessor without
// mutating history. The FUNCTIONAL registry — the predicates read latest-t-wins — lives
// here and is passed to observing/settle. Mirrors swarm `tick`.
//
// changing({root, agent, subject, predicate, object, t}) → { row, id }

import doing from '#doing';

// The predications that are single-valued over time (read latest-t at settle).
export const FUNCTIONAL = new Set(['located-in', 'tick', 'phase']);

export default async function changing(args) {
  return doing(args);
}
