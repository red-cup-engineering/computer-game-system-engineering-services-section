/**
 * `deck` — the card model: suits, ranks, deterministic seeded shuffling, deck construction,
 * draw/deal helpers. Draws come from computer-data randomization's `seededStream`, the house's
 * one PRNG home; `deck.test.mts`'s golden shuffles pin the exact output. `makeDeck`
 * generalizes solitaire's `decks: 1 | 2` to any positive integer count (a blackjack/baccarat
 * shoe wants 4-8) keeping the suit-cycling byte-for-byte for `decks in {1, 2}`. Every export is
 * a pure function over its arguments; `shuffle`/`draw`/`deal` never mutate their input arrays.
 */
import { seededStream } from '@red-cup-engineering/computer-data-engineering-services-section/randomization/stream';

/** The four suits, in a fixed canonical order used for internal indexing (solver, tests). */
export const SUITS = ['C', 'D', 'H', 'S'];

/** Red suits are hearts/diamonds; the rest are black. Used by every alternating-color build rule. */
export function cardColor(card) {
  return card.suit === 'D' || card.suit === 'H' ? 'red' : 'black';
}

const RANK_LABELS = {
  1: 'A', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'J', 12: 'Q', 13: 'K',
};

/** Human-readable label like "AS" (ace of spades) — for debugging/README examples, not gameplay. */
export function cardLabel(card) {
  return `${RANK_LABELS[card.rank] ?? card.rank}${card.suit}`;
}

function assertPositiveInt(name, value) {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`deck: ${name} must be a positive integer (got ${value})`);
  }
}

/**
 * Build an unshuffled deck: `decks` standard 52-card decks' worth of cards (`decks * 52` total),
 * grouped into `decks * 4` "suit slots" of 13 consecutive ranks each, with each slot's suit drawn
 * from `SUITS` cycling through only the first `suitsInPlay` of them (`suitsInPlay` in `[1, 4]`).
 * `suitsInPlay === 4` with `decks === 1` is a plain standard deck (Klondike, FreeCell, blackjack,
 * poker). Solitaire's Spider deals `decks === 2` and varies `suitsInPlay` — 1 gives eight
 * 13-card runs of spades, 2 alternates spades/hearts four times each, 4 is two full standard
 * decks. A multi-deck shoe game (blackjack, baccarat) wants `decks` up to 6-8 with
 * `suitsInPlay === 4` (see `./shoe.mjs`).
 */
export function makeDeck(decks = 1, suitsInPlay = 4) {
  assertPositiveInt('decks', decks);
  if (![1, 2, 3, 4].includes(suitsInPlay)) {
    throw new RangeError(`deck: suitsInPlay must be one of 1, 2, 3, 4 (got ${suitsInPlay})`);
  }
  const totalCards = decks * 52;
  const groups = totalCards / 13;
  const deck = [];
  for (let g = 0; g < groups; g++) {
    const suit = SUITS[g % suitsInPlay];
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ suit, rank, faceUp: false });
    }
  }
  return deck;
}

/** Fisher-Yates over `cards` driven by `rng` — pure: returns a new array, never mutates the input. */
export function shuffle(cards, rng) {
  const out = cards.map((c) => ({ ...c }));
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/** `seed` (any string) + deck composition -> a deterministic shuffled deck. Combines `hashSeed`
 *  + `seededStream` + `makeDeck` + `shuffle`, exactly as solitaire's `dealTable` does. */
export function shuffledDeck(seed, decks = 1, suitsInPlay = 4) {
  const rng = seededStream(seed);
  return shuffle(makeDeck(decks, suitsInPlay), rng);
}

/**
 * Draw `n` cards off the top of `deck` (index 0 is "the top" by this module's convention — the
 * next card to come off the deck). Pure: returns `{ drawn, remaining }`, never mutates `deck`.
 * Throws if `deck` doesn't have `n` cards left.
 */
export function draw(deck, n = 1) {
  assertPositiveInt('n', n);
  if (n > deck.length) {
    throw new RangeError(`deck: cannot draw ${n} card(s) from a deck of ${deck.length}`);
  }
  return { drawn: deck.slice(0, n), remaining: deck.slice(n) };
}

/**
 * Deal `cardsPerHand` cards to each of `handCount` hands, one card at a time in round-robin
 * order off the top of `deck` (the way a real dealer deals) rather than in `handCount`
 * contiguous blocks. Pure: returns `{ hands, remaining }`, never mutates `deck`. Throws if
 * `deck` doesn't have `handCount * cardsPerHand` cards left.
 */
export function deal(deck, handCount, cardsPerHand) {
  assertPositiveInt('handCount', handCount);
  assertPositiveInt('cardsPerHand', cardsPerHand);
  const needed = handCount * cardsPerHand;
  if (needed > deck.length) {
    throw new RangeError(`deck: cannot deal ${handCount} x ${cardsPerHand} from a deck of ${deck.length}`);
  }
  const hands = Array.from({ length: handCount }, () => []);
  let cursor = 0;
  for (let round = 0; round < cardsPerHand; round++) {
    for (let h = 0; h < handCount; h++) {
      hands[h].push(deck[cursor]);
      cursor += 1;
    }
  }
  return { hands, remaining: deck.slice(cursor) };
}

/** `card` with `faceUp` set (a new object; `card` itself is never mutated). */
export function withFaceUp(card, faceUp = true) {
  return { ...card, faceUp };
}
