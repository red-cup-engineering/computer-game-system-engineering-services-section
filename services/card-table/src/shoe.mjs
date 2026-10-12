/**
 * `shoe` — a multi-deck dealing shoe with a cut card and penetration tracking, for blackjack-
 * and baccarat-shaped games that deal off a running multi-deck stack rather than a single 52-card
 * deck consumed to exhaustion (solitaire's own use case, covered by `./deck.mjs`).
 *
 * Modeled as an immutable cursor over a shuffled deck, matching this package's existing
 * "no mutation" style (`./deck.mjs#shuffle`/`draw`/`deal` all return new values): `drawFromShoe`
 * returns `{ card, shoe: nextShoe }` rather than mutating `shoe` in place. A table loop threads
 * the returned `shoe` through successive draws, e.g. `({ card, shoe } = drawFromShoe(shoe))`.
 *
 * The **cut card** is the house's physical shuffle signal: real casinos slide a blank card into
 * the shoe at a fixed depth before play starts, and when that card would be the next one dealt,
 * the *current round finishes* on the cards already dealt but the shoe is reshuffled before the
 * next round begins (never mid-round — a hand in progress is never starved of cards). `cutIndex`
 * is that fixed position; `needsShuffle` reports whether the cursor has reached it.
 * `penetration` is the fraction of the shoe dealt before the cut card (0.75 is a common
 * commercial default: 6 decks, cut with about 1.5 decks left undealt).
 */
import { seededStream } from '@red-cup-engineering/computer-data-engineering-services-section/randomization/stream';
import { makeDeck, shuffle } from './deck.mjs';

function assertShoe(shoe) {
  if (!shoe || !Array.isArray(shoe.cards) || typeof shoe.cursor !== 'number') {
    throw new TypeError('shoe: expected a shoe created by createShoe/reshuffleShoe');
  }
}

/**
 * Build a fresh shoe: `decks` standard 52-card decks (4 suits always — a blackjack/baccarat shoe
 * is never suit-restricted the way a Spider deal is), shuffled from `seed` (a string, hashed and
 * fed through the same deterministic mulberry32 stream as `./deck.mjs#shuffledDeck`), with the
 * cut card placed at `penetration` (fraction in `(0, 1)`) of the way through.
 */
export function createShoe({ decks = 6, seed, penetration = 0.75 } = {}) {
  if (!Number.isInteger(decks) || decks < 1) {
    throw new RangeError(`shoe: decks must be a positive integer (got ${decks})`);
  }
  if (typeof seed !== 'string' || seed.length === 0) {
    throw new TypeError('shoe: seed must be a non-empty string');
  }
  if (!(penetration > 0 && penetration < 1)) {
    throw new RangeError(`shoe: penetration must be in (0, 1) (got ${penetration})`);
  }
  const cards = shuffle(makeDeck(decks, 4), seededStream(seed));
  return {
    cards,
    cursor: 0,
    cutIndex: Math.floor(cards.length * penetration),
    decks,
    penetration,
  };
}

/** Cards remaining to be dealt before the shoe runs out entirely. */
export function cardsRemaining(shoe) {
  assertShoe(shoe);
  return shoe.cards.length - shoe.cursor;
}

/** True once the cursor has reached (or passed) the cut card — the current round should finish
 *  on cards already dealt, and the shoe should be reshuffled (`reshuffleShoe`) before the next
 *  round starts. */
export function needsShuffle(shoe) {
  assertShoe(shoe);
  return shoe.cursor >= shoe.cutIndex;
}

/**
 * Draw the next card off the top of the shoe. Returns `{ card, shoe: nextShoe }`; does not
 * mutate `shoe`. Throws if the physical shoe is fully exhausted (a real table reshuffles well
 * before this — see `needsShuffle` — so this is a backstop, not the normal reshuffle trigger).
 */
export function drawFromShoe(shoe) {
  assertShoe(shoe);
  if (shoe.cursor >= shoe.cards.length) {
    throw new RangeError('shoe: exhausted — reshuffle (see needsShuffle) before drawing again');
  }
  return {
    card: shoe.cards[shoe.cursor],
    shoe: { ...shoe, cursor: shoe.cursor + 1 },
  };
}

/** Draw `n` cards off the top in one call — the common case (an opening deal). Returns
 *  `{ cards, shoe: nextShoe }`; does not mutate `shoe`. */
export function drawManyFromShoe(shoe, n) {
  assertShoe(shoe);
  if (!Number.isInteger(n) || n < 1) {
    throw new RangeError(`shoe: n must be a positive integer (got ${n})`);
  }
  let current = shoe;
  const cards = [];
  for (let i = 0; i < n; i++) {
    const result = drawFromShoe(current);
    cards.push(result.card);
    current = result.shoe;
  }
  return { cards, shoe: current };
}

/** Build a fresh shoe with the same `decks`/`penetration` as `shoe` but a new `seed` — the
 *  between-rounds reshuffle a table performs once `needsShuffle(shoe)` is true. */
export function reshuffleShoe(shoe, seed) {
  assertShoe(shoe);
  return createShoe({ decks: shoe.decks, seed, penetration: shoe.penetration });
}
