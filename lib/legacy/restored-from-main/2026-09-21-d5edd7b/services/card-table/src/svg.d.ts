// Type declarations for @red-cup-engineering/card-table/svg.

import type { Card, Suit } from './deck.d.ts';

export function rankLabel(rank: number): string;
export function suitColorClass(suit: Suit): 'suit-red' | 'suit-black';
export function cardFaceMarkup(card: Card): string;

export const BACK_VARIANTS: readonly string[];

export function cardBackMarkup(variant?: string): string;
export function cardBackFor(card: Card, variant?: string): string;
export function emptyPileMarkup(label?: string): string;
export function cardMarkup(card: Card, backVariant?: string): string;

export function chipMarkup(value: number | string | null | undefined): string;

export interface ChipStackOptions {
  maxRendered?: number;
}
export function chipStackMarkup(
  value: number | string | null | undefined,
  count: number,
  options?: ChipStackOptions,
): string;
