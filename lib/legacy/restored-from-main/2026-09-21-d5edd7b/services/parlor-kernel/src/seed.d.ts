// Type declarations for @red-cup-engineering/parlor-kernel/seed.

/** A deterministic stream of reals in [0, 1) and the integer/choice/shuffle helpers built on
 *  it. The exact house `Rng` shape (see gambling-trainer-service's `seed.mts`). */
export interface Rng {
  /** Next real in [0, 1). */
  next(): number;
  /** Next integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** A real in [min, max). */
  range(min: number, max: number): number;
  /** Pick one element (returns undefined for an empty list). */
  pick<T>(items: readonly T[]): T | undefined;
  /** True with probability p. */
  chance(p: number): boolean;
  /** A new array containing the same elements in a deterministic Fisher-Yates shuffle
   *  order, consuming from this stream. The input array is never mutated. */
  shuffle<T>(items: readonly T[]): T[];
}

export function hashSeed(text: string): number;
export function makeRng(seed: string): Rng;
export function dailySeed(gameId: string, date: Date | string, configId?: string): string;
