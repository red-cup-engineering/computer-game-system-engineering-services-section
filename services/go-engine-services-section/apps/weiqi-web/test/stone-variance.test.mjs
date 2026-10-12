// Rendering-purity coverage for the deterministic stone-placement variance
// (task item 1: "subtle per-stone placement variance seeded from
// position -- deterministic, no Math.random"). This is the DOM-free part
// of that requirement: board.mjs itself renders SVG and needs a browser,
// but the variance values it draws on are pure functions of (col, row,
// size), and that purity is exactly what "same position -> same
// SVG/frame bytes" depends on -- so it is what this test checks directly.
//
// Run with: node --test 'test/*.test.mts'

import { test } from "node:test";
import assert from "node:assert/strict";
import { hash2, hashSigned } from "../public/js/deterministic-hash.mjs";
import { stoneVariance } from "../public/js/stone-variance.mjs";

test("hash2 is a pure function: identical inputs always produce identical output", () => {
  for (const [a, b, c] of [
    [0, 0, 0],
    [3, 18, 19],
    [-4, 7, 2],
    [18, 18, 19],
  ]) {
    const first = hash2(a, b, c);
    for (let i = 0; i < 5; i++) {
      assert.equal(hash2(a, b, c), first, `hash2(${a},${b},${c}) was not stable across repeated calls`);
    }
  }
});

test("hash2 output stays within [0, 1) across a full 19x19 board's worth of points", () => {
  for (let row = 0; row < 19; row++) {
    for (let col = 0; col < 19; col++) {
      const v = hash2(col, row, 19);
      assert.ok(v >= 0 && v < 1, `hash2(${col},${row},19) = ${v} out of [0,1)`);
    }
  }
});

test("hashSigned output stays within [-1, 1)", () => {
  for (let i = 0; i < 200; i++) {
    const v = hashSigned(i, i * 3 - 7, 41);
    assert.ok(v >= -1 && v < 1, `hashSigned out of range: ${v}`);
  }
});

test("hash2 is not a constant function (real variance exists to render)", () => {
  const seen = new Set();
  for (let row = 0; row < 19; row++) {
    for (let col = 0; col < 19; col++) {
      seen.add(hash2(col, row, 19));
    }
  }
  // 361 points; a real hash should produce well over half that many
  // distinct values, not collapse to a handful of repeats.
  assert.ok(seen.size > 300, `expected broad spread of hash values, got only ${seen.size} distinct values`);
});

test("stoneVariance is deterministic: the same (col,row,size) renders identically every time", () => {
  const positions = [
    [0, 0, 19],
    [9, 9, 19],
    [18, 18, 19],
    [3, 4, 9],
    [6, 6, 7],
  ];
  for (const [col, row, size] of positions) {
    const first = stoneVariance(col, row, size);
    for (let i = 0; i < 8; i++) {
      const again = stoneVariance(col, row, size);
      assert.deepEqual(again, first, `stoneVariance(${col},${row},${size}) drifted across repeated calls`);
    }
  }
});

test("stoneVariance: replaying the exact same board position twice produces byte-identical variance for every stone (the rendering-purity guarantee board.mjs relies on)", () => {
  const size = 19;
  const renderAll = () => {
    const out = [];
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        out.push(stoneVariance(col, row, size));
      }
    }
    return JSON.stringify(out);
  };
  assert.equal(renderAll(), renderAll(), "two full-board renders of the same position diverged");
});

test("stoneVariance keeps every field within its documented bounds across a full 19x19 board", () => {
  const size = 19;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const v = stoneVariance(col, row, size);
      assert.ok(Math.abs(v.dx) < 0.16 + 1e-9, `dx out of bounds at (${col},${row}): ${v.dx}`);
      assert.ok(Math.abs(v.dy) < 0.16 + 1e-9, `dy out of bounds at (${col},${row}): ${v.dy}`);
      assert.ok(v.scale >= 0.975 && v.scale <= 1.025, `scale out of bounds at (${col},${row}): ${v.scale}`);
      assert.ok(v.sheenAngle >= 0 && v.sheenAngle < 360, `sheenAngle out of bounds at (${col},${row}): ${v.sheenAngle}`);
      assert.ok(v.sheenReach >= 0.82 && v.sheenReach <= 1.0, `sheenReach out of bounds at (${col},${row}): ${v.sheenReach}`);
    }
  }
});

test("stoneVariance distinguishes board sizes: the same (col,row) on different sizes need not jitter identically", () => {
  // Not a hard requirement of the design, but confirms `size` actually
  // participates in the seed rather than being silently ignored -- a
  // regression here would mean every board size renders identical jitter
  // at (0,0), which is the kind of accidental collision this test guards.
  const a = stoneVariance(0, 0, 9);
  const b = stoneVariance(0, 0, 19);
  assert.notDeepEqual(a, b, "stoneVariance(0,0,9) and stoneVariance(0,0,19) should not coincide");
});

test("stoneVariance produces real spread across a full board, not a near-constant value", () => {
  const size = 19;
  const dxs = new Set();
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      dxs.add(stoneVariance(col, row, size).dx.toFixed(4));
    }
  }
  assert.ok(dxs.size > 300, `expected broad dx spread, got only ${dxs.size} distinct rounded values`);
});
