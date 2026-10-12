import { test } from "node:test";
import assert from "node:assert/strict";
import { makeRng } from "./prng.mts";

test("makeRng: same seed produces byte-identical sequences", () => {
  const a = makeRng("delver-abc");
  const b = makeRng("delver-abc");
  const seqA = Array.from({ length: 20 }, () => a.next());
  const seqB = Array.from({ length: 20 }, () => b.next());
  assert.deepEqual(seqA, seqB);
});

test("makeRng: different seeds diverge", () => {
  const a = makeRng("seed-one");
  const b = makeRng("seed-two");
  const seqA = Array.from({ length: 10 }, () => a.next());
  const seqB = Array.from({ length: 10 }, () => b.next());
  assert.notDeepEqual(seqA, seqB);
});

test("next(): always in [0, 1)", () => {
  const rng = makeRng("range-check");
  for (let i = 0; i < 500; i++) {
    const n = rng.next();
    assert.ok(n >= 0 && n < 1, `next() out of range: ${n}`);
  }
});

test("int(): inclusive bounds, never outside them", () => {
  const rng = makeRng("int-check");
  for (let i = 0; i < 500; i++) {
    const n = rng.int(3, 7);
    assert.ok(Number.isInteger(n) && n >= 3 && n <= 7, `int() out of range: ${n}`);
  }
});

test("pick(): only returns elements from the input, throws on empty", () => {
  const rng = makeRng("pick-check");
  const items = ["a", "b", "c"];
  for (let i = 0; i < 50; i++) assert.ok(items.includes(rng.pick(items)));
  assert.throws(() => rng.pick([]), RangeError);
});
