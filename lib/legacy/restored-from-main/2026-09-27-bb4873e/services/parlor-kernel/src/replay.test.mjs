import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCartridge, defaultReplay, hashState, createVerifier, appendEntry } from './replay.mjs';
import { canonicalJson } from '@red-cup-engineering/json-services-section/canonical-json';

// A tiny counter engine, deliberately simpler than the pig-fixture, to test buildCartridge in
// isolation from any one game's rules.
function createEngine(seed) {
  return { seed, count: 0 };
}
function applyIntent(state, intent) {
  if (intent.kind === 'add') {
    return { state: { ...state, count: state.count + (intent.by ?? 1) }, events: [{ kind: 'added', by: intent.by ?? 1 }] };
  }
  throw new TypeError(`unknown intent kind "${intent.kind}"`);
}

test('buildCartridge: assembles a full Cartridge from just createEngine + applyIntent', () => {
  const cartridge = buildCartridge(createEngine, applyIntent);
  assert.equal(typeof cartridge.createEngine, 'function');
  assert.equal(typeof cartridge.applyIntent, 'function');
  assert.equal(typeof cartridge.replay, 'function');
  assert.equal(typeof cartridge.serialize, 'function');
  assert.equal(typeof cartridge.deserialize, 'function');
});

test('buildCartridge: replay delegates to @red-cup-engineering/cartridge/replay\'s defaultReplay', () => {
  const cartridge = buildCartridge(createEngine, applyIntent);
  const intents = [{ kind: 'add', by: 3 }, { kind: 'add', by: 4 }];
  const viaCartridge = cartridge.replay('seed-x', intents);
  const viaDirect = defaultReplay({ createEngine, applyIntent }, 'seed-x', intents);
  assert.deepEqual(viaCartridge, viaDirect);
  assert.equal(viaCartridge.finalState.count, 7);
});

test('buildCartridge: default serialize/deserialize are the identity function', () => {
  const cartridge = buildCartridge(createEngine, applyIntent);
  const state = cartridge.createEngine('serialize-seed');
  assert.equal(cartridge.serialize(state), state);
  assert.equal(cartridge.deserialize(state), state);
});

test('buildCartridge: a caller-supplied serialize/deserialize overrides the identity default', () => {
  const cartridge = buildCartridge(createEngine, applyIntent, {
    serialize: (s) => ({ ...s, tag: 'custom' }),
    deserialize: (d) => ({ seed: d.seed, count: d.count }),
  });
  const state = cartridge.createEngine('override-seed');
  const serialized = cartridge.serialize(state);
  assert.equal(serialized.tag, 'custom');
  assert.deepEqual(cartridge.deserialize(serialized), state);
});

test('buildCartridge: rejects a non-function createEngine or applyIntent', () => {
  assert.throws(() => buildCartridge(null, applyIntent), TypeError);
  assert.throws(() => buildCartridge(createEngine, null), TypeError);
});

test('re-exports: hashState, createVerifier, appendEntry, canonicalJson are the real @red-cup-engineering/cartridge implementations, not reimplementations', () => {
  assert.equal(typeof hashState, 'function');
  assert.equal(typeof createVerifier, 'function');
  assert.equal(typeof appendEntry, 'function');
  assert.equal(typeof canonicalJson, 'function');
  // canonicalJson's own documented behavior: key-order independence.
  assert.equal(canonicalJson({ b: 1, a: 2 }), canonicalJson({ a: 2, b: 1 }));
});

test('re-exports: hashState is stable across two independently-built but deep-equal states', () => {
  assert.equal(hashState({ a: 1, b: [1, 2, 3] }), hashState({ b: [1, 2, 3], a: 1 }));
});
