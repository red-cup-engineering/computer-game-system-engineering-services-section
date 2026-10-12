import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, applyIntent, serialize, deserialize, stonePileCartridge } from './toy-engine.mjs';
import { validateManifest } from '../manifest.mjs';
import type { CartridgeManifest } from '../manifest.d.ts';
import { encodeIntentLog, decodeIntentLog, appendEntry } from '../intent-log.mjs';
import type { IntentLog } from '../intent-log.d.ts';
import type { StonePileIntent } from './toy-engine.d.ts';

test('createEngine: pure function of (seed, configId) — same inputs, byte-identical output', () => {
  const a = createEngine('same-seed', 'cfg-1');
  const b = createEngine('same-seed', 'cfg-1');
  assert.deepEqual(a, b);
});

test('createEngine: different seeds produce different starting stone counts (not a constant)', () => {
  const counts = new Set<number>();
  for (let i = 0; i < 25; i++) {
    counts.add(createEngine(`seed-${i}`).stones);
  }
  assert.ok(counts.size > 1, 'expected createEngine to vary with seed, got a constant');
});

test('createEngine: stones always land in the documented 10..50 range', () => {
  for (let i = 0; i < 50; i++) {
    const { stones } = createEngine(`range-check-${i}`);
    assert.ok(stones >= 10 && stones <= 50, `stones ${stones} out of range for seed range-check-${i}`);
  }
});

test('createEngine: configId changes the seed (and so, generally, the state) even with the same seed string', () => {
  const a = createEngine('shared-seed', 'cfg-a');
  const b = createEngine('shared-seed', 'cfg-b');
  assert.notDeepEqual(a, b);
});

test('applyIntent: pure — never mutates the input state', () => {
  const state = createEngine('mutation-check');
  const before = JSON.stringify(state);
  applyIntent(state, { kind: 'add', amount: 3 });
  assert.equal(JSON.stringify(state), before);
});

test('applyIntent: rejects removing more stones than the pile has', () => {
  const state = createEngine('reject-check');
  assert.throws(() => applyIntent(state, { kind: 'remove', amount: state.stones + 1 }), RangeError);
});

test('applyIntent: rejects non-positive amounts', () => {
  const state = createEngine('nonpositive-check');
  assert.throws(() => applyIntent(state, { kind: 'add', amount: 0 }), RangeError);
  assert.throws(() => applyIntent(state, { kind: 'add', amount: -1 }), RangeError);
});

test('applyIntent: emitting pile-emptied only when the pile hits exactly zero', () => {
  const state = createEngine('empty-check');
  const result = applyIntent(state, { kind: 'remove', amount: state.stones });
  assert.equal(result.state.stones, 0);
  assert.ok(result.events.some((e) => e.kind === 'pile-emptied'));
});

test('serialize/deserialize: round-trips deep-equal', () => {
  const state = createEngine('serialize-check', 'cfg');
  const restored = deserialize(serialize(state));
  assert.deepEqual(restored, state);
});

test('deserialize: rejects malformed data', () => {
  assert.throws(() => deserialize({ name: 'x' }), TypeError);
  assert.throws(() => deserialize(null), TypeError);
});

test('end-to-end: manifest validates, intent log round-trips, and replay/verify agree — the whole contract, once', () => {
  const manifest: CartridgeManifest = {
    id: 'stone-pile',
    displayName: 'Stone Pile',
    description: 'Reference toy cartridge proving the whole contract round-trips.',
    subdomain: 'stone-pile',
    entryPoints: { headless: '@561-group/cartridge/fixtures/toy-engine' },
    seedPolicy: { kind: 'client-supplied' },
    intentLog: { schemaVersion: 'stone-pile-v1' },
    replayVerifier: '@561-group/cartridge/fixtures/toy-engine#replay',
    keywords: ['toy', 'reference', 'end-to-end'],
  };
  const manifestResult = validateManifest(manifest);
  assert.equal(manifestResult.valid, true, manifestResult.errors.join('; '));

  const seed = 'end-to-end-seed';
  let log: IntentLog<StonePileIntent> = [];
  log = appendEntry(log, { kind: 'add', amount: 6 });
  log = appendEntry(log, { kind: 'remove', amount: 4 });
  log = appendEntry(log, { kind: 'rename', name: 'proven-pile' });

  const wireText = encodeIntentLog(log);
  const decodedLog = decodeIntentLog<StonePileIntent>(wireText);
  assert.deepEqual(decodedLog, log);

  const bareIntents = decodedLog.map((entry) => entry.intent);
  const replayed = stonePileCartridge.replay(seed, bareIntents);
  assert.equal(replayed.valid, true);
  assert.equal(replayed.finalState.name, 'proven-pile');

  const replayedAgain = stonePileCartridge.replay(seed, bareIntents);
  assert.equal(replayed.stateHash, replayedAgain.stateHash, 'replay must be deterministic end-to-end');
});
