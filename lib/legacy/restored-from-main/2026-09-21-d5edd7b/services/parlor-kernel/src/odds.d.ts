// Type declarations for @red-cup-engineering/parlor-kernel/odds.

import type { YachtCategory } from './tally.d.ts';
import type { Reel } from './reels.d.ts';

export function pigBustProbability(sides?: number): number;
export function farkleBustProbability(diceCount?: number): number;
export function yachtCategoryExpectations(): Map<YachtCategory, number>;

export interface SlotRTPResult {
  readonly rtp: number;
  readonly expectedPayout: number;
  readonly combinations: number;
}
export function computeSlotRTP(
  reels: readonly Reel[],
  payoutFor: (symbols: readonly string[]) => number,
  bet?: number,
): SlotRTPResult;
