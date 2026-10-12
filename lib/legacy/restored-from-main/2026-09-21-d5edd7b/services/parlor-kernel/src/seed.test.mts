import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashSeed, makeRng, dailySeed } from './seed.mjs';

test('dailySeed: namespaces every parlor game under "parlor:" before delegating to cartridge', () => {
  const date = new Date(Date.UTC(2026, 7, 19));
  assert.equal(dailySeed('yacht-dice', date), 'parlor:yacht-dice-daily:2026-08-19');
});

test('dailySeed: pure function of (gameId, date, configId) — same inputs, same output', () => {
  const date = new Date(Date.UTC(2026, 7, 19));
  const s1 = dailySeed('slot-parlor', date, 'classic');
  const s2 = dailySeed('slot-parlor', date, 'classic');
  assert.equal(s1, s2);
});

test('dailySeed: a Date and its equivalent YYYY-MM-DD string resolve to the same seed', () => {
  const date = new Date(Date.UTC(2026, 7, 19));
  assert.equal(dailySeed('pig-dice', date), dailySeed('pig-dice', '2026-08-19'));
});

test('dailySeed: rejects an empty gameId', () => {
  assert.throws(() => dailySeed('', '2026-08-19'), TypeError);
});

test('dailySeed: two different parlor games never collide, same day', () => {
  const date = '2026-08-19';
  assert.notEqual(dailySeed('pig-dice', date), dailySeed('farkle-dice', date));
});

test('hashSeed: deterministic 32-bit unsigned fold of a string', () => {
  const h1 = hashSeed('parlor:pig-daily:2026-08-19');
  const h2 = hashSeed('parlor:pig-daily:2026-08-19');
  assert.equal(h1, h2);
  assert.ok(Number.isInteger(h1) && h1 >= 0 && h1 <= 0xffffffff);
});

test('hashSeed: different strings hash differently (no accidental collision on these probes)', () => {
  assert.notEqual(hashSeed('a'), hashSeed('b'));
  assert.notEqual(hashSeed('seed:1'), hashSeed('seed:2'));
});

test('makeRng: same seed string -> identical, infinite stream of next() values, forever', () => {
  const a = makeRng('daily-2026-08-19');
  const b = makeRng('daily-2026-08-19');
  const seqA = Array.from({ length: 500 }, () => a.next());
  const seqB = Array.from({ length: 500 }, () => b.next());
  assert.deepEqual(seqA, seqB);
});

test('makeRng: different seed strings diverge', () => {
  const a = makeRng('seed-a');
  const b = makeRng('seed-b');
  const seqA = Array.from({ length: 20 }, () => a.next());
  const seqB = Array.from({ length: 20 }, () => b.next());
  assert.notDeepEqual(seqA, seqB);
});

test('makeRng: next() always in [0, 1)', () => {
  const rng = makeRng('range-probe');
  for (let i = 0; i < 2000; i++) {
    const v = rng.next();
    assert.ok(v >= 0 && v < 1, `next() out of range: ${v}`);
  }
});

test('makeRng: int(min, max) always within the inclusive range', () => {
  const rng = makeRng('int-probe');
  for (let i = 0; i < 1000; i++) {
    const v = rng.int(1, 6);
    assert.ok(Number.isInteger(v) && v >= 1 && v <= 6, `int out of range: ${v}`);
  }
});

test('makeRng: int(min, max) covers every value in a small range given enough draws', () => {
  const rng = makeRng('coverage-probe');
  const seen = new Set<number>();
  for (let i = 0; i < 500; i++) seen.add(rng.int(1, 6));
  assert.equal(seen.size, 6);
});

test('makeRng: chance(p) respects p = 0 and p = 1 exactly', () => {
  const rng = makeRng('chance-probe');
  for (let i = 0; i < 50; i++) {
    assert.equal(rng.chance(0), false);
  }
  for (let i = 0; i < 50; i++) {
    assert.equal(rng.chance(1), true);
  }
});

test('makeRng: pick() returns undefined for an empty list, else an element of the list', () => {
  const rng = makeRng('pick-probe');
  assert.equal(rng.pick([]), undefined);
  const items = ['a', 'b', 'c'];
  for (let i = 0; i < 20; i++) {
    assert.ok(items.includes(rng.pick(items) as string));
  }
});

test('makeRng: shuffle() is a permutation and never mutates its input', () => {
  const rng = makeRng('shuffle-probe');
  const items = [1, 2, 3, 4, 5];
  const copy = [...items];
  const shuffled = rng.shuffle(items);
  assert.deepEqual(items, copy, 'input array must not be mutated');
  assert.deepEqual([...shuffled].sort((a, b) => a - b), copy);
});

test('makeRng: rejects an empty seed', () => {
  assert.throws(() => makeRng(''), TypeError);
});

test('property — same seed, same rolls, forever: 100 independently constructed Rngs from the same seed agree on 1000 draws each', () => {
  for (let trial = 0; trial < 100; trial++) {
    const rng = makeRng(`trial-${trial}`);
    const rngAgain = makeRng(`trial-${trial}`);
    const seq1 = Array.from({ length: 1000 }, () => rng.next());
    const seq2 = Array.from({ length: 1000 }, () => rngAgain.next());
    assert.deepEqual(seq1, seq2, `trial ${trial} diverged`);
  }
});
