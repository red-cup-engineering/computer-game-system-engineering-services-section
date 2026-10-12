import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashSeed, makeRng, subSeed, makeSubRng } from './rng.mjs';

test('hashSeed: deterministic, stable across calls', () => {
  assert.equal(hashSeed('hello'), hashSeed('hello'));
  assert.notEqual(hashSeed('hello'), hashSeed('world'));
});

test('hashSeed: rejects a non-string', () => {
  assert.throws(() => hashSeed(42), TypeError);
});

test('makeRng: same seed produces the same stream', () => {
  const a = makeRng('pearl-winkle:1');
  const b = makeRng('pearl-winkle:1');
  const seqA = Array.from({ length: 10 }, () => a.next());
  const seqB = Array.from({ length: 10 }, () => b.next());
  assert.deepEqual(seqA, seqB);
});

test('makeRng: different seeds diverge', () => {
  const a = makeRng('seed-a');
  const b = makeRng('seed-b');
  assert.notEqual(a.next(), b.next());
});

test('makeRng: rejects an empty seed', () => {
  assert.throws(() => makeRng(''), TypeError);
});

test('Rng.int: inclusive range', () => {
  const rng = makeRng('int-range');
  for (let i = 0; i < 200; i++) {
    const v = rng.int(3, 7);
    assert.ok(v >= 3 && v <= 7 && Number.isInteger(v));
  }
});

test('Rng.pick: throws on empty, otherwise returns a member', () => {
  const rng = makeRng('pick');
  assert.throws(() => rng.pick([]), RangeError);
  const items = ['a', 'b', 'c'];
  assert.ok(items.includes(rng.pick(items)));
});

test('Rng.shuffle: pure (does not mutate input), same multiset', () => {
  const rng = makeRng('shuffle');
  const items = [1, 2, 3, 4, 5];
  const shuffled = rng.shuffle(items);
  assert.deepEqual(items, [1, 2, 3, 4, 5]);
  assert.deepEqual([...shuffled].sort(), [1, 2, 3, 4, 5]);
});

test('subSeed: joins root seed and parts with ":"', () => {
  assert.equal(subSeed('root', 'a', 'b'), 'root:a:b');
  assert.equal(subSeed('root', 1, 2), 'root:1:2');
});

test('makeSubRng: same (seed, parts) always yields the same stream', () => {
  const a = makeSubRng('root', 'persona', 'temperament');
  const b = makeSubRng('root', 'persona', 'temperament');
  assert.equal(a.next(), b.next());
});

test('makeSubRng: distinct sub-seeds are independent streams', () => {
  const a = makeSubRng('root', 'dialogue');
  const b = makeSubRng('root', 'policy');
  assert.notEqual(a.next(), b.next());
});
