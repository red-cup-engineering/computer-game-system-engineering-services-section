// Type declarations for @red-cup-engineering/card-table/blackjack.

import type { Rank } from './deck.d.ts';

export function blackjackValue(rank: Rank): number;

export interface HandTotal {
  readonly hard: number;
  readonly best: number;
  readonly isSoft: boolean;
  readonly isBust: boolean;
}
export function handTotal(ranks: readonly Rank[]): HandTotal;
export function isBlackjack(ranks: readonly Rank[]): boolean;

export interface CanSplitOptions {
  sameRankOnly?: boolean;
}
export function canSplit(ranks: readonly Rank[], options?: CanSplitOptions): boolean;

export interface DealerOptions {
  hitSoft17?: boolean;
}
export function dealerShouldHit(total: Pick<HandTotal, 'best' | 'isSoft'>, options?: DealerOptions): boolean;

export interface PlayedDealerHand {
  readonly ranks: Rank[];
  readonly total: HandTotal;
}
export function playDealerHand(
  startingRanks: readonly Rank[],
  drawRank: () => Rank,
  options?: DealerOptions,
): PlayedDealerHand;

/** A 10-element value-bucket vector: index 0 = count of value-1 (ace) cards remaining,
 *  ... index 8 = count of value-9, index 9 = combined count of 10/J/Q/K. */
export type Composition = number[];

export function createShoeComposition(decks?: number): Composition;
export function compositionTotal(composition: Composition): number;
export function removeRanksFromComposition(composition: Composition, ranks: readonly Rank[]): Composition;

export interface DrawProbability {
  readonly value: number;
  readonly probability: number;
}
export function drawProbabilities(composition: Composition): DrawProbability[];

export interface DealerOutcomeDistribution {
  readonly 17: number;
  readonly 18: number;
  readonly 19: number;
  readonly 20: number;
  readonly 21: number;
  readonly bust: number;
}
export function dealerOutcomeDistribution(
  upcardRank: Rank,
  composition: Composition,
  options?: DealerOptions,
): DealerOutcomeDistribution;

export function standEV(
  playerBest: number,
  upcardRank: Rank,
  composition: Composition,
  options?: DealerOptions,
): number;

export interface HandEVResult {
  readonly stand: number;
  readonly hit: number;
  readonly double: number | null;
  readonly split: number | null;
}
export function handEV(
  playerRanks: readonly Rank[],
  upcardRank: Rank,
  composition: Composition,
  options?: DealerOptions & CanSplitOptions,
): HandEVResult;
