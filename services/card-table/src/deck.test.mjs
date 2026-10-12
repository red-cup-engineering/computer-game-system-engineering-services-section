/**
 * `deck.test` — card model, deck composition, draw/deal, and the golden-shuffle regression
 * fixtures.
 *
 * The `GOLDEN_*` constants below were captured by running the *original*
 * `solitaire-service/src/cards.mts` (`hashSeed`, `randomStream`, `shuffledDeck`) directly, once, as a
 * one-time snapshot — not derived from this package's own code. This file asserts this package's
 * `hashSeed`/`randomStream`/`shuffledDeck` reproduce those exact values, so a future edit here that
 * accidentally changes the FNV-1a or mulberry32 constants (or the shuffle loop) breaks a test
 * instead of silently reshuffling every solitaire daily deal that already happened. Deliberately
 * not a relative cross-package import of solitaire-service's own file (the two services are
 * independent packages behind Verdaccio, per the house dependency doctrine) — the golden values
 * are the portable, dependency-free way to pin the same guarantee.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashSeed } from '@red-cup-engineering/computer-data-engineering-services-section/randomization/hash-seed';
import { randomStream } from '@red-cup-engineering/computer-data-engineering-services-section/randomization/stream';
import { SUITS, makeDeck, shuffle, shuffledDeck, draw, deal, withFaceUp, cardColor, cardLabel } from './deck.mjs';

// ── Golden fixtures, captured from solitaire-service/src/cards.mts ────────────────────────────

const GOLDEN_HASH_SEED = {
  'golden-seed-1': 1021063248,
  'daily-2026-08-29': 4053185432,
  'freecell-42': 1958937908,
  'spider-two-suit': 3076845803,
  '': 2166136261,
};

const GOLDEN_RNG_FROM_42 = [
  0.6011037519201636, 0.44829055899754167, 0.8524657934904099, 0.6697340414393693,
  0.17481389874592423, 0.5265925421845168, 0.2732279943302274, 0.6247446539346129,
  0.8654746483080089, 0.4723170551005751,
];

const GOLDEN_SHUFFLED_DECK = {
  'golden-seed-1:1:4': ['H10','C7','H13','C8','C3','H5','H7','D8','D7','S8','S7','S5','S4','S6','D13','C13','D9','S9','D12','C2','S1','S12','D2','H6','H3','C4','C9','C1','H4','D4','C5','C12','D3','H11','H8','H12','S3','S11','S13','D1','D10','C10','C11','S10','S2','H9','D5','D6','H1','C6','H2','D11'],
  'daily-2026-08-29:1:4': ['S2','S13','C10','S3','C4','H4','D13','S11','D3','H1','H9','H10','D1','D7','S12','S7','C3','D2','S8','D11','C2','C5','S9','D9','C13','S6','S5','H8','H6','H5','S4','H11','H3','C6','D10','H2','D5','H12','H7','C12','D4','C8','S1','D8','D6','S10','D12','C11','C9','C7','C1','H13'],
  'spider-two-suit:2:2': ['D3','D12','C4','D5','D8','D13','D3','C9','D5','C4','D1','D4','C5','D11','C9','D2','D5','D7','C2','D10','D5','C6','D11','C11','C6','D4','C10','D6','D7','C8','C4','C11','C2','C1','C6','D11','C11','D2','C3','C5','D12','D9','D6','C13','C1','C10','D10','D11','D8','C8','D4','C9','C2','C1','C7','D12','C5','C12','C4','C8','D10','D13','D6','D8','D6','D1','D9','D3','C6','C13','C10','C3','D8','D1','C9','C7','C13','C12','C13','C5','C7','C7','D10','D13','C3','C1','D9','D7','C12','D7','C12','C3','D2','D12','D3','D13','C10','C8','D9','D1','D4','C2','C11','D2'],
  'spider-one-suit:2:1': ['C11','C3','C8','C6','C9','C3','C11','C3','C9','C10','C3','C11','C4','C13','C13','C5','C11','C4','C2','C1','C1','C10','C5','C12','C9','C12','C10','C9','C10','C10','C8','C6','C3','C12','C11','C2','C6','C12','C1','C13','C8','C2','C7','C2','C11','C1','C13','C8','C5','C1','C4','C10','C6','C13','C8','C5','C1','C4','C5','C7','C8','C7','C2','C3','C9','C5','C7','C2','C12','C2','C7','C11','C11','C9','C4','C2','C5','C9','C6','C13','C3','C3','C12','C4','C10','C6','C5','C4','C4','C1','C9','C8','C7','C1','C6','C8','C7','C13','C6','C10','C12','C7','C13','C12'],
  'spider-four-suit:2:4': ['C1','C7','D7','C8','H11','D10','S2','H6','S10','D6','C4','H7','S10','C8','C5','S2','S3','D8','H2','H6','C11','H3','S8','H3','C10','S5','D11','H4','H5','S3','C6','C1','C9','H1','S11','S4','S9','S1','H13','H5','D7','H13','D2','D3','H10','S12','C2','D4','D1','C11','S13','C12','H9','D10','C9','S6','D3','D5','C3','S11','H8','S7','D9','D13','H12','H8','S8','H9','S1','C12','C13','D2','C3','H11','D9','S7','C5','D4','S5','S4','D12','H1','H7','C2','D11','H10','D12','S6','H2','C13','D1','D13','D5','D8','H4','S13','D6','S12','S9','C4','C7','H12','C10','C6'],
};

test('hashSeed matches the original solitaire-service golden values', () => {
  for (const [seed, expected] of Object.entries(GOLDEN_HASH_SEED)) {
    assert.equal(hashSeed(seed), expected, `hashSeed(${JSON.stringify(seed)})`);
  }
});

test('randomStream(42) matches the original solitaire-service golden mulberry32 stream', () => {
  const rng = randomStream(42);
  const seq = Array.from({ length: GOLDEN_RNG_FROM_42.length }, () => rng.next());
  assert.deepEqual(seq, GOLDEN_RNG_FROM_42);
});

test('shuffledDeck reproduces the exact card order solitaire-service produced for known seeds', () => {
  for (const [key, expected] of Object.entries(GOLDEN_SHUFFLED_DECK)) {
    const [seed, decksStr, suitsStr] = key.split(':');
    const decks = Number(decksStr);
    const suitsInPlay = Number(suitsStr);
    const got = shuffledDeck(seed, decks, suitsInPlay).map((c) => `${c.suit}${c.rank}`);
    assert.deepEqual(got, expected, key);
  }
});

// ── Card model ──────────────────────────────────────────────────────────────────────────────

test('cardColor: hearts/diamonds are red, clubs/spades are black', () => {
  assert.equal(cardColor({ suit: 'H', rank: 1, faceUp: false }), 'red');
  assert.equal(cardColor({ suit: 'D', rank: 1, faceUp: false }), 'red');
  assert.equal(cardColor({ suit: 'C', rank: 1, faceUp: false }), 'black');
  assert.equal(cardColor({ suit: 'S', rank: 1, faceUp: false }), 'black');
});

test('cardLabel: ace/face cards use letters, numbers use digits', () => {
  assert.equal(cardLabel({ suit: 'S', rank: 1, faceUp: false }), 'AS');
  assert.equal(cardLabel({ suit: 'H', rank: 10, faceUp: false }), '10H');
  assert.equal(cardLabel({ suit: 'D', rank: 13, faceUp: false }), 'KD');
});

test('withFaceUp returns a new object and does not mutate the input', () => {
  const card = { suit: 'S', rank: 1, faceUp: false };
  const flipped = withFaceUp(card);
  assert.equal(flipped.faceUp, true);
  assert.equal(card.faceUp, false);
  assert.notEqual(flipped, card);
});

// ── Deck composition ────────────────────────────────────────────────────────────────────────

test('makeDeck(1, 4) is a standard 52-card deck: every suit x rank exactly once', () => {
  const deck = makeDeck(1, 4);
  assert.equal(deck.length, 52);
  const seen = new Set(deck.map((c) => `${c.suit}${c.rank}`));
  assert.equal(seen.size, 52);
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) assert.ok(seen.has(`${suit}${rank}`));
  }
  assert.ok(deck.every((c) => c.faceUp === false));
});

test('makeDeck defaults to a standard single 52-card deck', () => {
  assert.deepEqual(makeDeck(), makeDeck(1, 4));
});

test('makeDeck(2, 1) is 104 cards, all one suit, 8 of each rank', () => {
  const deck = makeDeck(2, 1);
  assert.equal(deck.length, 104);
  assert.ok(deck.every((c) => c.suit === 'C'));
});

test('makeDeck(6, 4) builds a 6-deck blackjack-shaped shoe: 24 of each rank, 4 suits', () => {
  const deck = makeDeck(6, 4);
  assert.equal(deck.length, 312);
  const counts = new Map();
  for (const c of deck) {
    const k = `${c.suit}${c.rank}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) assert.equal(counts.get(`${suit}${rank}`), 6, `${suit}${rank}`);
  }
});

test('makeDeck rejects a non-positive deck count or an out-of-range suitsInPlay', () => {
  assert.throws(() => makeDeck(0, 4), RangeError);
  assert.throws(() => makeDeck(1.5, 4), RangeError);
  assert.throws(() => makeDeck(1, 5), RangeError);
});

test('shuffle does not mutate its input and preserves the multiset of cards', () => {
  const deck = makeDeck(1, 4);
  const snapshot = deck.map((c) => ({ ...c }));
  const shuffled = shuffle(deck, randomStream(7));
  assert.deepEqual(deck, snapshot);
  const before = deck.map((c) => `${c.suit}${c.rank}`).sort();
  const after = shuffled.map((c) => `${c.suit}${c.rank}`).sort();
  assert.deepEqual(before, after);
});

test('shuffledDeck is byte-identical across repeated calls and differs across seeds', () => {
  assert.deepEqual(shuffledDeck('same-seed', 1, 4), shuffledDeck('same-seed', 1, 4));
  assert.notDeepEqual(shuffledDeck('seed-a', 1, 4), shuffledDeck('seed-b', 1, 4));
});

// ── Draw / deal ─────────────────────────────────────────────────────────────────────────────

test('draw takes cards off the top and returns the rest, without mutating the input', () => {
  const deck = makeDeck(1, 4);
  const snapshot = deck.map((c) => ({ ...c }));
  const { drawn, remaining } = draw(deck, 5);
  assert.equal(drawn.length, 5);
  assert.equal(remaining.length, 47);
  assert.deepEqual(drawn, deck.slice(0, 5));
  assert.deepEqual(deck, snapshot);
});

test('draw defaults to one card', () => {
  const deck = makeDeck(1, 4);
  const { drawn, remaining } = draw(deck);
  assert.equal(drawn.length, 1);
  assert.equal(remaining.length, 51);
});

test('draw rejects drawing more cards than remain', () => {
  const deck = makeDeck(1, 4);
  assert.throws(() => draw(deck, 53), RangeError);
});

test('deal distributes round-robin, one card at a time, not in contiguous blocks', () => {
  const deck = makeDeck(1, 4);
  const { hands, remaining } = deal(deck, 4, 2);
  assert.equal(hands.length, 4);
  for (const hand of hands) assert.equal(hand.length, 2);
  // Round-robin: hand 0's first card is deck[0], hand 1's first card is deck[1], etc, and
  // hand 0's second card is deck[4] (after one full round of 4 hands), not deck[1].
  assert.deepEqual(hands[0][0], deck[0]);
  assert.deepEqual(hands[1][0], deck[1]);
  assert.deepEqual(hands[3][0], deck[3]);
  assert.deepEqual(hands[0][1], deck[4]);
  assert.equal(remaining.length, 52 - 8);
  assert.deepEqual(remaining, deck.slice(8));
});

test('deal rejects dealing more cards than the deck holds', () => {
  const deck = makeDeck(1, 4);
  assert.throws(() => deal(deck, 10, 6), RangeError);
});
