import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalStringify,
  encodeIntentLog,
  decodeIntentLog,
  validateIntentLog,
  appendEntry,
  isIntent,
  isGameEvent,
} from './intent-log.mjs';
import type { Intent, IntentLog } from './intent-log.d.ts';

test('canonicalStringify: sorts object keys at every level', () => {
  const a = canonicalStringify({ b: 1, a: 2, c: { z: 1, y: 2 } });
  const b = canonicalStringify({ a: 2, c: { y: 2, z: 1 }, b: 1 });
  assert.equal(a, b);
  assert.equal(a, '{"a":2,"b":1,"c":{"y":2,"z":1}}');
});

test('canonicalStringify: property — key-order-insensitive deep-equal values always match', () => {
  // Deterministic pseudo-random shuffle (mulberry32) — no Math.random(), reproducible.
  function mulberry32(seed: number) {
    let a = seed;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(1234);
  const baseKeys = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta'];
  for (let trial = 0; trial < 50; trial++) {
    const obj: Record<string, number> = {};
    for (const k of baseKeys) obj[k] = Math.floor(rng() * 1000);
    // Build a shuffled-key-order copy with the identical key/value pairs.
    const shuffled: Record<string, number> = {};
    const keys = [...baseKeys];
    for (let i = keys.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [keys[i], keys[j]] = [keys[j], keys[i]];
    }
    for (const k of keys) shuffled[k] = obj[k];
    assert.equal(canonicalStringify(obj), canonicalStringify(shuffled), `trial ${trial} failed`);
  }
});

test('canonicalStringify: arrays preserve order (order is meaningful, unlike object keys)', () => {
  assert.notEqual(canonicalStringify([1, 2, 3]), canonicalStringify([3, 2, 1]));
});

test('canonicalStringify: omits undefined-valued object keys, nulls array-undefined entries', () => {
  assert.equal(canonicalStringify({ a: 1, b: undefined }), '{"a":1}');
  assert.equal(canonicalStringify([1, undefined, 3]), '[1,null,3]');
});

test('canonicalStringify: throws on non-JSON-safe values', () => {
  assert.throws(() => canonicalStringify(Number.NaN));
  assert.throws(() => canonicalStringify(Number.POSITIVE_INFINITY));
  assert.throws(() => canonicalStringify(() => {}));
  assert.throws(() => canonicalStringify(Symbol('x')));
  assert.throws(() => canonicalStringify(10n));
});

test('isIntent / isGameEvent: require a non-empty string kind on a plain object', () => {
  assert.equal(isIntent({ kind: 'add', amount: 1 }), true);
  assert.equal(isIntent({ kind: '' }), false);
  assert.equal(isIntent({}), false);
  assert.equal(isIntent(null), false);
  assert.equal(isIntent([]), false);
  assert.equal(isIntent('add'), false);
  assert.equal(isGameEvent({ kind: 'stones-added' }), true);
});

test('appendEntry: auto-assigns seq starting at 0, strictly increasing', () => {
  let log: IntentLog = [];
  log = appendEntry(log, { kind: 'add', amount: 5 });
  log = appendEntry(log, { kind: 'add', amount: 3 });
  assert.equal(log.length, 2);
  assert.equal(log[0].seq, 0);
  assert.equal(log[1].seq, 1);
});

test('appendEntry: does not mutate the input log (pure append)', () => {
  const original: IntentLog = appendEntry([], { kind: 'add', amount: 5 });
  const appended = appendEntry(original, { kind: 'add', amount: 3 });
  assert.equal(original.length, 1);
  assert.equal(appended.length, 2);
  assert.notEqual(original, appended);
});

test('appendEntry: explicit seq must be strictly greater than the log\'s last seq', () => {
  const log = appendEntry([], { kind: 'add', amount: 1 }, { seq: 5 });
  assert.throws(() => appendEntry(log, { kind: 'add', amount: 1 }, { seq: 5 }), RangeError);
  assert.throws(() => appendEntry(log, { kind: 'add', amount: 1 }, { seq: 4 }), RangeError);
  const next = appendEntry(log, { kind: 'add', amount: 1 }, { seq: 6 });
  assert.equal(next[1].seq, 6);
});

test('appendEntry: refuses sequence and timestamp values that would make its output invalid', () => {
  assert.throws(() => appendEntry([], { kind: 'add' }, { seq: 0.5 }), TypeError);
  assert.throws(() => appendEntry([], { kind: 'add' }, { seq: Number.NaN }), TypeError);
  assert.throws(() => appendEntry([], { kind: 'add' }, { ts: Number.POSITIVE_INFINITY }), TypeError);
  assert.throws(() => appendEntry([{ seq: 0.5, intent: { kind: 'add' } }], { kind: 'add' }), TypeError);
});

test('appendEntry: rejects an intent without a valid kind envelope', () => {
  assert.throws(() => appendEntry([], { amount: 1 } as unknown as Intent), TypeError);
});

test('appendEntry: carries ts through untouched when supplied', () => {
  const log = appendEntry([], { kind: 'review', grade: 3 }, { ts: 1700000000000 });
  assert.equal(log[0].ts, 1700000000000);
});

test('encodeIntentLog / decodeIntentLog: round-trip', () => {
  let log: IntentLog = [];
  log = appendEntry(log, { kind: 'add', amount: 5 });
  log = appendEntry(log, { kind: 'remove', amount: 2 }, { ts: 42 });
  const text = encodeIntentLog(log);
  const decoded = decodeIntentLog(text);
  assert.deepEqual(decoded, log);
});

test('encodeIntentLog: two independently-built equal logs encode identically', () => {
  const log1 = appendEntry(appendEntry([], { kind: 'add', amount: 1, tag: 'x' }), { kind: 'add', amount: 2 });
  const log2 = appendEntry(appendEntry([], { kind: 'add', tag: 'x', amount: 1 }), { kind: 'add', amount: 2 });
  assert.equal(encodeIntentLog(log1), encodeIntentLog(log2));
});

test('decodeIntentLog: throws SyntaxError on invalid JSON', () => {
  assert.throws(() => decodeIntentLog('{not json'), SyntaxError);
});

test('decodeIntentLog: throws TypeError on well-formed JSON that is not a valid log', () => {
  assert.throws(() => decodeIntentLog('{"not":"an array"}'), TypeError);
  assert.throws(() => decodeIntentLog('[{"seq":0}]'), TypeError); // missing intent
});

test('validateIntentLog: rejects non-array input', () => {
  const result = validateIntentLog({ seq: 0 });
  assert.equal(result.valid, false);
});

test('validateIntentLog: rejects non-monotonic seq', () => {
  const result = validateIntentLog([
    { seq: 0, intent: { kind: 'add' } },
    { seq: 0, intent: { kind: 'add' } },
  ]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('seq')));
});

test('validateIntentLog: rejects a decreasing seq', () => {
  const result = validateIntentLog([
    { seq: 5, intent: { kind: 'add' } },
    { seq: 3, intent: { kind: 'add' } },
  ]);
  assert.equal(result.valid, false);
});

test('validateIntentLog: rejects malformed intent envelopes and bad ts', () => {
  const result = validateIntentLog([
    { seq: 0, intent: { kind: 'add' }, ts: 'yesterday' },
    { seq: 1, intent: 'not-an-object' },
  ]);
  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 2);
});

test('validateIntentLog: accepts an empty log', () => {
  const result = validateIntentLog([]);
  assert.equal(result.valid, true);
});
