// Per-stone visual variance for "stones with real presence" (task item 1,
// BOARD BEAUTY): a real stone bowl has no two stones sitting perfectly
// identically -- slight position jitter, slight size variation, a sheen
// highlight that catches the light from a slightly different angle each
// time. board.mjs wants exactly that, but deterministically: the same
// board position must render to the same bytes every time (rendering
// purity), so this is seeded from the stone's own (col, row) and the
// board size, never from Math.random or any other run-to-run entropy.
//
// Pure, DOM-free, zero-dep -- directly unit-testable (see
// test/stone-variance.test.mts) without a browser or jsdom.

import { hash2, hashSigned } from "./deterministic-hash.mjs";

/**
 * @param {number} col 0-indexed column
 * @param {number} row 0-indexed row
 * @param {number} size board side length (folded into the seed so a 9x9
 *   and a 19x19 board don't happen to jitter (0,0) identically)
 * @returns {{dx:number, dy:number, scale:number, sheenAngle:number, sheenReach:number}}
 *   dx/dy: placement jitter as a *fraction of the stone radius* (small,
 *     |value| < ~0.16r) -- board.mjs multiplies by its own radius so the
 *     jitter scales with board size/cell rather than being a fixed pixel
 *     offset.
 *   scale: 0.975-1.025, a subtle per-stone size variation.
 *   sheenAngle: 0-360 degrees, the rotation of the glossy highlight
 *     ellipse -- simulates each stone catching light from a slightly
 *     different angle, like real slate/shell.
 *   sheenReach: 0.82-1.0, a subtle per-stone highlight-size multiplier.
 */
export function stoneVariance(col, row, size) {
  const seedBase = size * 131 + 17;
  const h1 = hashSigned(col, row, seedBase);
  const h2 = hashSigned(row, col, seedBase + 1);
  const h3 = hash2(col + row, col - row + size, seedBase + 2);
  const h4 = hash2(col * 3 + 1, row * 5 + 2, seedBase + 3);
  const h5 = hash2(col, row, seedBase + 4);
  return {
    dx: h1 * 0.16,
    dy: h2 * 0.16,
    scale: 0.975 + h3 * 0.05,
    sheenAngle: h4 * 360,
    sheenReach: 0.82 + h5 * 0.18,
  };
}
