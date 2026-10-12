// A pure, deterministic 2D/3D integer hash mapped to [0, 1) -- no
// Math.random anywhere. Every visual or audio "variance" this app draws
// on a board position (stone-placement jitter, gradient-sheen angle,
// click-pitch wobble) is *seeded from that position* through this
// function, not sampled randomly, so the same board state always
// produces the same bytes: this is the load-bearing primitive behind the
// "same position -> same SVG/frame bytes" rendering-purity requirement
// (see test/stone-variance.test.mts).
//
// Implementation: a standard integer avalanche mix (the widely-used
// "triple xorshift-multiply" finalizer, the same family as murmur3's
// fmix32/splitmix), applied to a linear combination of the inputs. Not
// cryptographic, not published-RNG-quality -- just fast, well-mixed, and
// 100% reproducible across runs/engines since it is pure 32-bit integer
// arithmetic (Math.imul), no floating-point accumulation and no external
// entropy source.

/** Deterministic hash of up to three integers into [0, 1). Same inputs
 * always produce the same output -- there is no seeding step to forget,
 * because the "seed" IS the input. */
export function hash2(a, b, c = 0) {
  let h = (a * 0x1f1f1f1f) ^ (b * 0x2545f491) ^ (c * 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

/** Same hash, remapped to [-1, 1) -- convenient for jitter/offset use. */
export function hashSigned(a, b, c = 0) {
  return hash2(a, b, c) * 2 - 1;
}
