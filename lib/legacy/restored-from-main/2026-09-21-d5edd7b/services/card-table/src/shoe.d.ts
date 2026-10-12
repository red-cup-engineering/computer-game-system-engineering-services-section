// Type declarations for @red-cup-engineering/card-table/shoe.

import type { Card } from './deck.d.ts';

export interface Shoe {
  readonly cards: readonly Card[];
  readonly cursor: number;
  readonly cutIndex: number;
  readonly decks: number;
  readonly penetration: number;
}

export interface CreateShoeOptions {
  decks?: number;
  seed: string;
  penetration?: number;
}

export function createShoe(options: CreateShoeOptions): Shoe;
export function cardsRemaining(shoe: Shoe): number;
export function needsShuffle(shoe: Shoe): boolean;

export interface DrawFromShoeResult {
  readonly card: Card;
  readonly shoe: Shoe;
}
export function drawFromShoe(shoe: Shoe): DrawFromShoeResult;

export interface DrawManyFromShoeResult {
  readonly cards: Card[];
  readonly shoe: Shoe;
}
export function drawManyFromShoe(shoe: Shoe, n: number): DrawManyFromShoeResult;

export function reshuffleShoe(shoe: Shoe, seed: string): Shoe;
