/**
 * `@emsenn/fizzos` — the MUD operating-system kernel, derived honestly from the modern
 * 561 Group stack. A turn is `(world, commands) → (world', perceptions)`.
 *
 * FizzOS is not built *on* the theory stack — it is what the stack looks like with a
 * walkable face. The load-bearing identity (Farstone `DESIGN.md` §1; corpus
 * `concurrent-game-system.md`) is **games are computers are games**. The kernel does
 * not *simulate* a world over a database; it *settles* one — the world is the
 * partially-completed proof, and playing is extending the derivation.
 *
 * The kernel is a thin composition over the contemporary 561 Group packages, never a
 * re-implementation of them: `@emsenn/relating` (the utterance log settling to a
 * bilattice fixpoint), `@emsenn/animating` (assertion-worlds, sections for
 * perception-as-sheaf-restriction, settle), `@emsenn/gaming` (CGS arenas/designs),
 * and `@emsenn/computing` (observe/run/federate, the bigraded `H^1`).
 *
 * It modularizes categorically; each face is a published subpath:
 *   - `@emsenn/fizzos/engine`      — the turn loop (a barrel over world + running);
 *   - `@emsenn/fizzos/world`       — the world's structuring (settled valuation,
 *                                    linear conserving movement, per-fiber perception);
 *   - `@emsenn/fizzos/running`     — the operational computer (`look`, the `tick`);
 *   - `@emsenn/fizzos/concurrency` — the tick fan-in detector (bigraded `H^1`);
 *   - `@emsenn/fizzos/things`      — TAB/qtOps thing composition;
 *   - `@emsenn/fizzos/encoding`    — boundary codecs for the pure-turn package-bins.
 */
export * from "./engine.mjs";

export {
  type FizzosThing,
  type FizzosThingAttributeValue,
  type FizzosThingComposition,
  type FizzosThingGrammar,
  type FizzosThingJudgment,
  type FizzosThingModel,
  type FizzosThingProcess,
  type FizzosThingQuality,
  type FizzosThingRegistry,
  type SettledFizzosThingProcess,
  composeFizzosThing,
  createFizzosThingProcess,
  fizzosThingAssertions,
  mergeFizzosThingModels,
  resolveFizzosThingBases,
  settleFizzosThing,
} from "./things.mjs";

export {
  type FizzosProposal,
  type FizzosProposalAssertion,
  type TickConfluence,
  functionalProposalSites,
  proposalSite,
  tickConfluence,
  tickConfluenceOf,
} from "./concurrency.mjs";

export {
  confluenceDocument,
  decodeFacts,
  decodeProposal,
  decodeProposals,
  decodeWorld,
  lookDocument,
  perceptionDocument,
  readDocument,
  tickDocument,
  worldDocument,
  writeDocument,
} from "./encoding.mjs";
