// Type declarations for @red-cup-engineering/cast/rng.

export interface Rng {
  /** Next real in [0, 1). */
  next(): number;
  /** Next integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Next real in [min, max). */
  range(min: number, max: number): number;
  /** true with probability p. */
  chance(p: number): boolean;
  /** Uniformly pick one element (throws on an empty/non-array list). */
  pick<T>(items: readonly T[]): T;
  /** A Fisher-Yates shuffle; pure, returns a new array. */
  shuffle<T>(items: readonly T[]): T[];
}

export function hashSeed(text: string): number;
export function makeRng(seed: string): Rng;
export function subSeed(seed: string, ...parts: readonly unknown[]): string;
export function makeSubRng(seed: string, ...parts: readonly unknown[]): Rng;
