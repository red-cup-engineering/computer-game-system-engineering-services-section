/**
 * `prng` — deterministic seeded randomness for this package's own tests. Not part of the
 * published subpath map (see package.json's "exports"): it exists purely so the
 * invariants/transfer property tests can hammer the ledger with reproducible-but-varied
 * entry sequences, per the house rule that domain logic (and its tests) never call
 * `Math.random()`. Built on computer-data randomization — the house's one PRNG home.
 */
import { hashSeed, mulberry32 } from "@red-cup-engineering/computer-data-engineering-services-section/randomization";

/** Build a deterministic RNG stream (mulberry32) from a seed string. */
export function makeRng(seed) {
  const next = mulberry32(hashSeed(seed));
  const int = (min, max) => min + Math.floor(next() * (max - min + 1));
  const pick = (items) => {
    if (items.length === 0) throw new RangeError("pick: empty list");
    return items[int(0, items.length - 1)];
  };
  return { next, int, pick };
}
