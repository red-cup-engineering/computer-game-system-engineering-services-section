/**
 * `@emsenn/fizzos/engine` — the turn loop, derived honestly from the theory stack.
 *
 * The engine is the barrel over the two faces it unfolds into:
 *   - `./world.mjs`   — the world's *structuring*: the settled charge valuation, the
 *                       linear conserving item movement, the per-fiber perception;
 *   - `./running.mjs` — the operational computer: `look` (perception → CGS arena via
 *                       `@emsenn/computing`) and the sole-writer multiplayer `tick`.
 *
 * It exists so downstream code (e.g. Farstone) keeps one stable import surface,
 * `@emsenn/fizzos/engine`, while the engine modularizes categorically beneath it.
 */
export {
  LOCATED_IN,
  type Fact,
  type World,
  type Perception,
  type PerceivedFact,
  world,
  tell,
  chargeOf,
  holds,
  contested,
  placeOf,
  contentsOf,
  moveFact,
  take,
  drop,
  give,
  go,
  perceive,
  settledFacts,
  valueOf,
  numberOf,
  isWorld,
} from "./world.mjs";

export { type TickResult, look, tick } from "./running.mjs";
