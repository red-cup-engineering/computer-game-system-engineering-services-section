/**
 * replay.mjs — intent-log/replay glue compatible with `@red-cup-engineering/cartridge`.
 *
 * `@red-cup-engineering/cartridge` already owns the whole intent-log/replay contract
 * (`@red-cup-engineering/cartridge/intent-log`'s canonical JSON + `appendEntry`,
 * `@red-cup-engineering/cartridge/replay`'s `Cartridge<State, Intent>` interface, `defaultReplay`,
 * `hashState`, `createVerifier`) — this module does not reimplement any of that, it re-exports
 * the pieces a parlor game needs and adds exactly one thing cartridge deliberately doesn't
 * provide: a factory that turns a game's own `{ createEngine, applyIntent }` pair (built on
 * top of `./turns.mjs#createTurnReducer`, most of the time) into a complete `Cartridge` object
 * — `replay` derived via `defaultReplay`, `serialize`/`deserialize` defaulted to identity for
 * the common case where a game's `State` is already plain JSON — matching the thin-wrap
 * pattern `onestone-service/src/cartridge.mts` and `gambling-trainer-service/src/cartridge.mts`
 * both hand-roll today. A parlor game only needs `createEngine` + `applyIntent`; this module
 * is the rest of `Cartridge` for free.
 */
import { defaultReplay, hashState, createVerifier } from '@red-cup-engineering/cartridge/replay';
import { appendEntry, encodeIntentLog, decodeIntentLog, validateIntentLog } from '@red-cup-engineering/cartridge/intent-log';
import { canonicalJson } from '@red-cup-engineering/json-services-section/canonical-json';

export { defaultReplay, hashState, createVerifier, appendEntry, canonicalJson, encodeIntentLog, decodeIntentLog, validateIntentLog };

/**
 * Build a complete `Cartridge<State, Intent>` from just `createEngine` + `applyIntent`:
 * - `replay(seed, intents, configId)` delegates to `@red-cup-engineering/cartridge/replay`'s
 *   `defaultReplay` — no hand-rolled loop.
 * - `serialize`/`deserialize` default to the identity function, correct for any `State` that
 *   is already plain JSON (true of every parlor-kernel-built state: `turns.mjs#TurnState`,
 *   `board.mjs` node ids, dice/reel arrays are all plain data). A game whose state needs real
 *   round-tripping (e.g. a `Map` or `Set` inside `data`) supplies its own `serialize`/
 *   `deserialize` in `options` and this factory uses those instead.
 */
export function buildCartridge(createEngine, applyIntent, options = {}) {
  if (typeof createEngine !== 'function') {
    throw new TypeError('buildCartridge: createEngine must be a function');
  }
  if (typeof applyIntent !== 'function') {
    throw new TypeError('buildCartridge: applyIntent must be a function');
  }
  const serialize = options.serialize ?? ((state) => state);
  const deserialize = options.deserialize ?? ((data) => data);
  return {
    createEngine,
    applyIntent,
    replay: (seed, intents, configId) => defaultReplay({ createEngine, applyIntent }, seed, intents, configId),
    serialize,
    deserialize,
  };
}
