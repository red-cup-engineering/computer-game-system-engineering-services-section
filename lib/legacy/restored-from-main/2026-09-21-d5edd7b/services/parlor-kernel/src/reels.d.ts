// Type declarations for @red-cup-engineering/parlor-kernel/reels.

import type { Rng } from './seed.d.ts';

export type Reel = readonly string[];

export function createReel(symbols: readonly string[]): Reel;
export function createReels(strips: readonly (readonly string[])[]): Reel[];
export function spinReel(rng: Rng, reel: Reel): string;
export function spinReels(rng: Rng, reels: readonly Reel[]): string[];
export function symbolHitOdds(reel: Reel): Map<string, number>;
