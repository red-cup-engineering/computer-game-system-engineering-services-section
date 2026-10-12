// Type declarations for @red-cup-engineering/card-table/evaluate.

import type { Card } from './deck.d.ts';

export const HAND_CATEGORY: {
  readonly HIGH_CARD: 0;
  readonly PAIR: 1;
  readonly TWO_PAIR: 2;
  readonly TRIPS: 3;
  readonly STRAIGHT: 4;
  readonly FLUSH: 5;
  readonly FULL_HOUSE: 6;
  readonly QUADS: 7;
  readonly STRAIGHT_FLUSH: 8;
};

export type HandCategory = (typeof HAND_CATEGORY)[keyof typeof HAND_CATEGORY];

export function categoryName(category: HandCategory): string;

export interface HandRank {
  readonly category: HandCategory;
  readonly tiebreak: readonly number[];
  readonly score: number;
}

export function evaluate5(cards: readonly Card[]): HandRank;
export function isRoyalFlush(handRank: HandRank): boolean;
export function compareHands(a: HandRank, b: HandRank): number;
export function bestHand(cards: readonly Card[]): HandRank;
