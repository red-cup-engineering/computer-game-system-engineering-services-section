/**
 * fixtures/toy-engine.mjs — a minimal in-memory `Cartridge` implementation ("stone-pile"),
 * used by this package's own test suite to prove the whole contract round-trips: manifest
 * validation, intent-log encode/decode, and replay/verify all exercised against one real
 * (if trivial) game.
 *
 * The game: a pile of stones with a seed-derived starting count. Intents add stones, remove
 * stones (never below zero — an illegal move, exactly the kind a replay verifier must
 * reject), or rename the pile. This is deliberately small enough to read in one sitting
 * while still exercising state mutation, illegal-move rejection, and multi-event emission.
 *
 * `createEngine`'s only randomness is a seeded PRNG derived entirely from the `seed`
 * string — no `Math.random()`, no ambient clock, matching house convention. The PRNG is
 * local to this fixture; per the cartridge spec, cartridge itself never mandates how a seed
 * becomes an RNG.
 *
 * Plain JavaScript, no TypeScript syntax — see ../manifest.mjs's header comment for why.
 * Types are declared in the co-located toy-engine.d.ts.
 */

import { defaultReplay } from '../replay.mjs';

/** FNV-1a over the seed string, folded into a 32-bit unsigned integer — a small,
 *  dependency-free way to turn an arbitrary seed string into a numeric PRNG state. */
function seedToUint32(seed) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: a small, fast, deterministic PRNG. Given the same numeric state it always
 *  produces the same sequence — the only property this fixture (or any cartridge engine)
 *  needs from its RNG. */
function mulberry32(state) {
  let a = state;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createEngine(seed, configId) {
  const rng = mulberry32(seedToUint32(`${seed}:${configId ?? ''}`));
  const stones = 10 + Math.floor(rng() * 41); // 10..50, deterministic given seed+configId
  return { name: configId ?? 'default', stones, turn: 0 };
}

export function applyIntent(state, intent) {
  switch (intent.kind) {
    case 'add': {
      if (!Number.isInteger(intent.amount) || intent.amount <= 0) {
        throw new RangeError(`add: amount must be a positive integer, got ${intent.amount}`);
      }
      const next = { ...state, stones: state.stones + intent.amount, turn: state.turn + 1 };
      const event = { kind: 'stones-added', amount: intent.amount, total: next.stones };
      return { state: next, events: [event] };
    }
    case 'remove': {
      if (!Number.isInteger(intent.amount) || intent.amount <= 0) {
        throw new RangeError(`remove: amount must be a positive integer, got ${intent.amount}`);
      }
      if (intent.amount > state.stones) {
        throw new RangeError(`remove: cannot remove ${intent.amount} stones from a pile of ${state.stones}`);
      }
      const next = { ...state, stones: state.stones - intent.amount, turn: state.turn + 1 };
      const events = [{ kind: 'stones-removed', amount: intent.amount, total: next.stones }];
      if (next.stones === 0) {
        events.push({ kind: 'pile-emptied' });
      }
      return { state: next, events };
    }
    case 'rename': {
      if (typeof intent.name !== 'string' || intent.name.length === 0) {
        throw new TypeError('rename: name must be a non-empty string');
      }
      const next = { ...state, name: intent.name, turn: state.turn + 1 };
      const event = { kind: 'renamed', name: intent.name };
      return { state: next, events: [event] };
    }
    default:
      throw new TypeError(`applyIntent: unknown intent kind ${intent.kind}`);
  }
}

export function replay(seed, intents, configId) {
  return defaultReplay({ createEngine, applyIntent }, seed, intents, configId);
}

export function serialize(state) {
  return { name: state.name, stones: state.stones, turn: state.turn };
}

export function deserialize(data) {
  if (
    typeof data !== 'object' ||
    data === null ||
    typeof data.name !== 'string' ||
    typeof data.stones !== 'number' ||
    typeof data.turn !== 'number'
  ) {
    throw new TypeError('deserialize: malformed StonePileState data');
  }
  return { name: data.name, stones: data.stones, turn: data.turn };
}

export const stonePileCartridge = {
  createEngine,
  applyIntent,
  replay,
  serialize,
  deserialize,
};
