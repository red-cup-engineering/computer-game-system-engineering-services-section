/**
 * replay.mjs — the `Cartridge<State, TIntent>` contract, a reference `defaultReplay`
 * implementation any game may call instead of hand-rolling replay, and a stable-hash
 * verifier builder matching the spec's §1.4 `manifest.replayVerifier` export shape.
 *
 * Per spec §1.2: cartridge does not define `State` or `Intent` shapes, only the function
 * signatures around them. The one required domain method is `applyIntent`; everything else
 * — `replay`, and by extension `verify` — is derivable from `createEngine` + `applyIntent`
 * alone, which is exactly what `defaultReplay`/`createVerifier` do.
 *
 * Plain JavaScript, no TypeScript syntax — see manifest.mjs's header comment for why. Types
 * are declared in the co-located replay.d.ts.
 */

import { canonicalJson } from '@red-cup-engineering/json-services-section/canonical-json';
import { sha256Bytes } from '@red-cup-engineering/cryptographic-computer-data-engineering-services-section/portable-sha256';

/** SHA-256 hex digest of `canonicalJson(value)`. Exposed standalone because callers
 *  sometimes want to hash a state (or any JSON-safe value) outside of a full replay — e.g.
 *  comparing a live in-progress state against a previously recorded checkpoint.
 *
 *  Uses the house's portable pure-JS SHA-256 (the cryptographic section's
 *  `portable-sha256`) rather than `node:crypto` so this module — and every
 *  browser page that imports it (games serve the cartridge module graph straight to the
 *  browser, unbundled) — loads without a Node builtin in scope. That module's test suite
 *  proves its output is byte-identical to `node:crypto`'s across NIST vectors and a large
 *  random corpus, so every digest this function ever produced (Node or browser) is
 *  unchanged: no stored replay hash breaks. */
export function hashState(value) {
  return sha256Bytes(new TextEncoder().encode(canonicalJson(value)));
}

/** Reference replay: given only `createEngine` and `applyIntent`, rebuilds final state from
 *  (seed, intents, configId). Any implementer of `Cartridge.replay` may delegate to this
 *  verbatim instead of hand-rolling the loop.
 *
 *  On the first intent that fails (throws) under `applyIntent`, replay stops immediately:
 *  `valid` becomes `false`, `finalState` is the last state successfully reached, and
 *  `events` holds everything emitted up to that point. A log that fails partway through is
 *  never a valid record of a legal playthrough — silently skipping the bad intent and
 *  continuing would hide exactly the illegal-move case a settlement backend needs to catch. */
export function defaultReplay(cartridge, seed, intents, configId) {
  let state = cartridge.createEngine(seed, configId);
  const events = [];
  let valid = true;
  for (const intent of intents) {
    try {
      const result = cartridge.applyIntent(state, intent);
      state = result.state;
      events.push(...result.events);
    } catch {
      valid = false;
      break;
    }
  }
  return { finalState: state, valid, events, stateHash: hashState(state) };
}

/** Builds a `verify` function from just `createEngine` + `applyIntent`, for a game to
 *  re-export at the module path named by its manifest's `replayVerifier`. Note the
 *  signature difference from `Cartridge.replay`/`defaultReplay`: `verify` takes a full
 *  `IntentLog` (the `seq`/`ts` envelope from intent-log.mjs), matching what a replay
 *  verifier actually receives and stores, and unwraps each entry's `.intent` before
 *  delegating to `defaultReplay`. */
export function createVerifier(cartridge) {
  return (seed, configId, intents) => {
    const bareIntents = intents.map((entry) => entry.intent);
    const result = defaultReplay(cartridge, seed, bareIntents, configId);
    return {
      valid: result.valid,
      finalState: result.finalState,
      events: result.events,
      stateHash: result.stateHash,
    };
  };
}
