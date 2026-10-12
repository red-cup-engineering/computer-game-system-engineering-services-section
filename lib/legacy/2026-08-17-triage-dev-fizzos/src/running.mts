/**
 * The FizzOS operational computer — the running face of the world.
 *
 * Where `./world.mjs` carries the world's *structuring* (the settled charge
 * valuation and its linear, fiber-restricted algebra), this module *runs* it: it
 * observes a perceived fiber into a polarized CGS arena (`look`, the SPOTCOMP read)
 * and settles concurrent proposals into exactly one next world (`tick`, the sole
 * writer). A MUD is what "games are computers are games" looks like wearing a face
 * you can walk inside: a turn reads the actor's perceivable fiber, observes it into a
 * polarized arena (`@emsenn/computing`), and the resulting moves fold back as facts.
 *
 * The tick is DETERMINISTIC and TOTAL: it is the sole writer and always produces
 * exactly one next world. Independent actions commute. A *contended* functional cell
 * (two actors reaching for the same sword) is a **Beck-Chevalley defect** — two
 * reindexings over one base square that fail to commute; the bigraded `H^1`
 * (`./concurrency.mjs`) truth-row class is that defect, the classically-resolvable
 * part of the disagreement. The canonical resolution is the **KZ (lax-idempotent)
 * algebra** over that square: property-like, unique, given by a universal arrow. That
 * adjudicating algebra is NOT yet built (the predication hyperdoctrine + KZ doctrine
 * — queued); the current behaviour is the honest floor: the tick yields one world and
 * *holds* the contest (`stable`) rather than picking a winner by input order. What is
 * already honest is that the `H^1` is the genuine BC-defect detector.
 */
import { observeLabels, type Observation } from "@emsenn/computing/operating";
import { LOCATED_IN, type World, type Perception, perceive, tell } from "./world.mjs";
import { type FizzosProposal, type TickConfluence, tickConfluenceOf } from "./concurrency.mjs";

/**
 * Look: the SPOTCOMP read. Perceive the actor's fiber, then OBSERVE those settled
 * facts into a polarized CGS arena (`@emsenn/computing`) — the arena of what is the
 * case (and, by charge-IS-polarity, who it commits). Perception → arena, the first
 * leg of the pipeline, on real carriers.
 */
export function look(w: World, actor: string, predicate: string = LOCATED_IN): { readonly perception: Perception; readonly observation: Observation } {
  const perception = perceive(w, actor, predicate);
  return {
    perception,
    observation: observeLabels(perception.facts.map((f) => ({
      id: f.e,
      predicate: f.a,
      charge: f.charge,
      object: f.v,
    }))),
  };
}

/** The result of a tick: exactly one next world, plus the contention diagnostic. */
export interface TickResult {
  readonly kind: "fizzos.engine.tick";
  /** The single next world — the sole writer always produces exactly one. */
  readonly next: World;
  /** Which cells ended up contested this tick (the H^1 detector), for the UI/log. */
  readonly contention: TickConfluence;
}

/**
 * Settle a tick of concurrent proposals into exactly ONE next world. The tick is the
 * sole writer and folds every proposal into the settling: a functional move vacates
 * the mover's old place; when actors contend for the same functional cell the
 * settling holds it (contested) rather than forking. The adjudication of a contest IS
 * the settling — there is no bespoke winner-picker; an unbroken contest stays held
 * and resolves through further play. One world, never a multiverse.
 */
export function tick(w: World, proposals: readonly FizzosProposal[], functional: ReadonlySet<string> = new Set([LOCATED_IN])): TickResult {
  const contention = tickConfluenceOf(proposals, functional);
  let next = w;
  // Fold every proposal's assertions into the one settling. Functional location is
  // superseded by the assertion-world itself (the latest-stamped value wins — the
  // honest floor); the bigraded H^1 in `contention` is the genuine collision witness.
  for (const proposal of proposals) {
    for (const x of proposal.assertions) next = tell(next, [{ e: x.e, a: x.a, v: x.v }]);
  }
  return Object.freeze({ kind: "fizzos.engine.tick" as const, next, contention });
}
