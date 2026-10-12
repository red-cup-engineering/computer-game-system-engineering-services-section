// changing — a move on a FUNCTIONAL predication: state transition / spacetimemattering.
//
// `changing` is `doing` whose predicate is single-valued over time — an item is in ONE place,
// a clock has ONE tick, the tide has ONE phase. The trace stays append-only; the substrate's
// supersession reads the latest-t row, so a change SUPERSEDES its predecessor without mutating
// history. This is the arrow of time made of disk: settling goes one way, the latest row wins,
// the past is still all there to replay. Mirrors the swarm tick and qtmud's tick-universe.
//
// changing(args) -> { row, id }   (args identical to doing; the difference is the predicate's
// membership in the FUNCTIONAL set, which observing/settle honour.)

import doing from "#doing";
import { FUNCTIONAL } from "#substrate";

export { FUNCTIONAL };

export default async function changing(args) {
  return doing(args);
}
