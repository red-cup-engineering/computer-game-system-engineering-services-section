/**
 * `rng` — the cast's own seeded-randomness stream, built on `@red-cup-engineering/seeded-
 * random`'s `hashSeed` (FNV-1a) and `mulberry32` — the house's one PRNG home. `subSeed(seed,
 * ...parts)` derives independent sub-streams from one root seed so concerns never perturb
 * each other. Nothing here touches JS's own ambient random or clock sources.
 */
import { hashSeed, mulberry32 } from '@red-cup-engineering/computer-data-engineering-services-section/randomization';

export { hashSeed };

function rngFromState(seed) {
  const next = mulberry32(seed);
  const int = (min, max) => {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new RangeError(`Rng.int: invalid range [${min}, ${max}]`);
    }
    return min + Math.floor(next() * (max - min + 1));
  };
  const range = (min, max) => min + next() * (max - min);
  const chance = (p) => next() < p;
  const pick = (items) => {
    if (!Array.isArray(items) || items.length === 0) {
      throw new RangeError('Rng.pick: items must be a non-empty array');
    }
    return items[int(0, items.length - 1)];
  };
  const shuffle = (items) => {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(0, i);
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  };
  return { next, int, range, chance, pick, shuffle };
}

/** Build a deterministic RNG stream from a seed string. The same seed always produces the same
 *  infinite stream of results. */
export function makeRng(seed) {
  if (typeof seed !== 'string' || seed.length === 0) {
    throw new TypeError('makeRng: seed must be a non-empty string');
  }
  return rngFromState(hashSeed(seed));
}

/** Derive a namespaced sub-seed string from a root `seed` and any number of parts — the one
 *  convention every module in this package uses to keep independent concerns' randomness from
 *  interfering with one another while staying fully reproducible from a single root seed. */
export function subSeed(seed, ...parts) {
  if (typeof seed !== 'string' || seed.length === 0) {
    throw new TypeError('subSeed: seed must be a non-empty string');
  }
  return [seed, ...parts.map(String)].join(':');
}

/** Convenience: build an RNG directly from a root seed plus namespacing parts. */
export function makeSubRng(seed, ...parts) {
  return makeRng(subSeed(seed, ...parts));
}
