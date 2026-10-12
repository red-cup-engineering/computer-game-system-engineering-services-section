// Type declarations for @red-cup-engineering/card-table/deck.

export const SUITS: readonly ['C', 'D', 'H', 'S'];
export type Suit = (typeof SUITS)[number];

/** 1 = Ace ... 13 = King. */
export type Rank = number;

export interface Card {
  readonly suit: Suit;
  readonly rank: Rank;
  readonly faceUp: boolean;
}

export function cardColor(card: Card): 'red' | 'black';
export function cardLabel(card: Card): string;

export function hashSeed(text: string): number;

export interface Rng {
  /** Next real in [0, 1). */
  next(): number;
  /** Next integer in [min, max] inclusive. */
  int(min: number, max: number): number;
}

export function rngFrom(seed: number): Rng;

export function makeDeck(decks?: number, suitsInPlay?: 1 | 2 | 3 | 4): Card[];
export function shuffle(cards: readonly Card[], rng: Rng): Card[];
export function shuffledDeck(seed: string, decks?: number, suitsInPlay?: 1 | 2 | 3 | 4): Card[];

export interface DrawResult {
  readonly drawn: Card[];
  readonly remaining: Card[];
}
export function draw(deck: readonly Card[], n?: number): DrawResult;

export interface DealResult {
  readonly hands: Card[][];
  readonly remaining: Card[];
}
export function deal(deck: readonly Card[], handCount: number, cardsPerHand: number): DealResult;

export function withFaceUp(card: Card, faceUp?: boolean): Card;
