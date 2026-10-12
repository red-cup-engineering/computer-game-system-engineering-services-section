import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HAND_CATEGORY, categoryName, evaluate5, isRoyalFlush, compareHands, bestHand } from './evaluate.mjs';
import { makeDeck } from './deck.mjs';

function c(suit, rank) {
  return { suit, rank, faceUp: true };
}

// ── Category spot-checks, one hand per category, by hand ──────────────────────────────────────

test('evaluate5: royal flush (ace-high straight flush)', () => {
  const hand = evaluate5([c('S', 1), c('S', 13), c('S', 12), c('S', 11), c('S', 10)]);
  assert.equal(hand.category, HAND_CATEGORY.STRAIGHT_FLUSH);
  assert.equal(isRoyalFlush(hand), true);
});

test('evaluate5: the wheel straight flush (A-2-3-4-5) is a straight flush, high card 5, not royal', () => {
  const hand = evaluate5([c('S', 1), c('S', 2), c('S', 3), c('S', 4), c('S', 5)]);
  assert.equal(hand.category, HAND_CATEGORY.STRAIGHT_FLUSH);
  assert.equal(hand.tiebreak[0], 5);
  assert.equal(isRoyalFlush(hand), false);
});

test('evaluate5: four of a kind', () => {
  const hand = evaluate5([c('S', 7), c('D', 7), c('H', 7), c('C', 7), c('S', 2)]);
  assert.equal(hand.category, HAND_CATEGORY.QUADS);
  assert.deepEqual(hand.tiebreak, [7, 2]);
});

test('evaluate5: full house', () => {
  const hand = evaluate5([c('S', 7), c('D', 7), c('H', 7), c('C', 2), c('S', 2)]);
  assert.equal(hand.category, HAND_CATEGORY.FULL_HOUSE);
  assert.deepEqual(hand.tiebreak, [7, 2]);
});

test('evaluate5: flush', () => {
  const hand = evaluate5([c('S', 2), c('S', 5), c('S', 9), c('S', 11), c('S', 13)]);
  assert.equal(hand.category, HAND_CATEGORY.FLUSH);
  assert.deepEqual(hand.tiebreak, [13, 11, 9, 5, 2]);
});

test('evaluate5: straight (ace-high, "Broadway")', () => {
  const hand = evaluate5([c('S', 1), c('D', 13), c('H', 12), c('C', 11), c('S', 10)]);
  assert.equal(hand.category, HAND_CATEGORY.STRAIGHT);
  assert.equal(hand.tiebreak[0], 14);
});

test('evaluate5: the wheel straight (A-2-3-4-5), mixed suits, plays as 5-high', () => {
  const hand = evaluate5([c('S', 1), c('D', 2), c('H', 3), c('C', 4), c('S', 5)]);
  assert.equal(hand.category, HAND_CATEGORY.STRAIGHT);
  assert.equal(hand.tiebreak[0], 5);
});

test('evaluate5: three of a kind', () => {
  const hand = evaluate5([c('S', 9), c('D', 9), c('H', 9), c('C', 4), c('S', 2)]);
  assert.equal(hand.category, HAND_CATEGORY.TRIPS);
  assert.deepEqual(hand.tiebreak, [9, 4, 2]);
});

test('evaluate5: two pair', () => {
  const hand = evaluate5([c('S', 9), c('D', 9), c('H', 4), c('C', 4), c('S', 2)]);
  assert.equal(hand.category, HAND_CATEGORY.TWO_PAIR);
  assert.deepEqual(hand.tiebreak, [9, 4, 2]);
});

test('evaluate5: one pair', () => {
  const hand = evaluate5([c('S', 9), c('D', 9), c('H', 6), c('C', 4), c('S', 2)]);
  assert.equal(hand.category, HAND_CATEGORY.PAIR);
  assert.deepEqual(hand.tiebreak, [9, 6, 4, 2]);
});

test('evaluate5: high card', () => {
  const hand = evaluate5([c('S', 2), c('D', 5), c('H', 9), c('C', 11), c('S', 13)]);
  assert.equal(hand.category, HAND_CATEGORY.HIGH_CARD);
  assert.deepEqual(hand.tiebreak, [13, 11, 9, 5, 2]);
});

test('evaluate5: four consecutive ranks plus a non-consecutive 5th is not a straight', () => {
  const hand = evaluate5([c('S', 2), c('D', 3), c('H', 4), c('C', 5), c('S', 7)]);
  assert.notEqual(hand.category, HAND_CATEGORY.STRAIGHT);
});

test('evaluate5: A-2-3-4-6 is not a straight (the wheel needs exactly 5, not 6)', () => {
  const hand = evaluate5([c('S', 1), c('D', 2), c('H', 3), c('C', 4), c('S', 6)]);
  assert.notEqual(hand.category, HAND_CATEGORY.STRAIGHT);
  assert.notEqual(hand.category, HAND_CATEGORY.STRAIGHT_FLUSH);
});

test('evaluate5 rejects a hand that is not exactly 5 cards', () => {
  assert.throws(() => evaluate5([c('S', 1), c('S', 2)]), TypeError);
  assert.throws(() => evaluate5([c('S', 1), c('S', 2), c('S', 3), c('S', 4), c('S', 5), c('S', 6)]), TypeError);
});

// ── categoryName ────────────────────────────────────────────────────────────────────────────

test('categoryName covers every HAND_CATEGORY value and rejects unknowns', () => {
  for (const value of Object.values(HAND_CATEGORY)) {
    assert.equal(typeof categoryName(value), 'string');
  }
  assert.throws(() => categoryName(99), RangeError);
});

// ── compareHands: total ordering across categories ─────────────────────────────────────────────

test('compareHands: category always dominates tiebreak, regardless of how favorable the tiebreak looks', () => {
  const quads2s = evaluate5([c('S', 2), c('D', 2), c('H', 2), c('C', 2), c('S', 3)]); // worst possible quads
  const aceHighFlush = evaluate5([c('S', 1), c('S', 5), c('S', 9), c('S', 11), c('S', 13)]); // best possible... still just a flush
  assert.ok(compareHands(quads2s, aceHighFlush) > 0);
});

test('compareHands: within a category, higher tiebreak wins; equal tiebreak ties at zero', () => {
  const pairOfAces = evaluate5([c('S', 1), c('D', 1), c('H', 4), c('C', 6), c('S', 9)]);
  const pairOfKings = evaluate5([c('S', 13), c('D', 13), c('H', 4), c('C', 6), c('S', 9)]);
  assert.ok(compareHands(pairOfAces, pairOfKings) > 0);
  const pairOfAcesAgain = evaluate5([c('H', 1), c('C', 1), c('S', 4), c('D', 6), c('H', 9)]);
  assert.equal(compareHands(pairOfAces, pairOfAcesAgain), 0);
});

// ── bestHand: best-5-of-N for hold'em-shaped games ─────────────────────────────────────────────

test('bestHand of exactly 5 cards matches evaluate5 directly', () => {
  const cards = [c('S', 9), c('D', 9), c('H', 6), c('C', 4), c('S', 2)];
  assert.deepEqual(bestHand(cards), evaluate5(cards));
});

test('bestHand (7 cards, hold\'em-shaped) finds the flush hiding among 7 cards, not the pair the first 5 might suggest', () => {
  // Hole cards: 9c 9d (a pair). Board: 2s 5s 9s Js Ks — five spades on board plus two off-suit
  // hole cards; the best 5-card hand is the board's own flush, not trip nines (9c/9d + 9s).
  const cards = [c('C', 9), c('D', 9), c('S', 2), c('S', 5), c('S', 9), c('S', 11), c('S', 13)];
  const result = bestHand(cards);
  assert.equal(result.category, HAND_CATEGORY.FLUSH);
});

test('bestHand (7 cards) finds a straight that spans hole cards and board', () => {
  // Hole: 9h 8h. Board: 7c 6d 5s 2c 2d. Best 5: 9-8-7-6-5 straight (using both hole cards).
  const cards = [c('H', 9), c('H', 8), c('C', 7), c('D', 6), c('S', 5), c('C', 2), c('D', 2)];
  const result = bestHand(cards);
  assert.equal(result.category, HAND_CATEGORY.STRAIGHT);
  assert.equal(result.tiebreak[0], 9);
});

test('bestHand rejects fewer than 5 cards', () => {
  assert.throws(() => bestHand([c('S', 1), c('S', 2)]), TypeError);
});

// ── Exhaustive enumeration: all C(52,5) = 2,598,960 hands, checked against published frequencies
//
// Independent combination enumerator, written fresh here rather than importing any internal
// helper from evaluate.mjs, so a bug shared between this loop and the module's own logic can't
// hide the same bug twice (matching parlor-kernel/odds.test.mts's "independent brute-force"
// discipline).

function* fiveCardCombinations(items) {
  const n = items.length;
  const idx = [0, 1, 2, 3, 4];
  while (true) {
    yield [items[idx[0]], items[idx[1]], items[idx[2]], items[idx[3]], items[idx[4]]];
    let i = 4;
    while (i >= 0 && idx[i] === i + n - 5) i -= 1;
    if (i < 0) return;
    idx[i] += 1;
    for (let j = i + 1; j < 5; j++) idx[j] = idx[j - 1] + 1;
  }
}

test('exhaustive: every one of the 2,598,960 five-card hands, counted by category, matches published frequencies', { timeout: 120_000 }, () => {
  const deck = makeDeck(1, 4);
  assert.equal(deck.length, 52);

  const counts = {
    royalFlush: 0,
    straightFlush: 0, // excluding royal
    quads: 0,
    fullHouse: 0,
    flush: 0, // excluding straight flushes
    straight: 0, // excluding straight flushes
    trips: 0,
    twoPair: 0,
    pair: 0,
    highCard: 0,
  };
  let total = 0;

  for (const hand of fiveCardCombinations(deck)) {
    total += 1;
    const rank = evaluate5(hand);
    switch (rank.category) {
      case HAND_CATEGORY.STRAIGHT_FLUSH:
        if (isRoyalFlush(rank)) counts.royalFlush += 1;
        else counts.straightFlush += 1;
        break;
      case HAND_CATEGORY.QUADS: counts.quads += 1; break;
      case HAND_CATEGORY.FULL_HOUSE: counts.fullHouse += 1; break;
      case HAND_CATEGORY.FLUSH: counts.flush += 1; break;
      case HAND_CATEGORY.STRAIGHT: counts.straight += 1; break;
      case HAND_CATEGORY.TRIPS: counts.trips += 1; break;
      case HAND_CATEGORY.TWO_PAIR: counts.twoPair += 1; break;
      case HAND_CATEGORY.PAIR: counts.pair += 1; break;
      case HAND_CATEGORY.HIGH_CARD: counts.highCard += 1; break;
      default: throw new Error(`unreachable category ${rank.category}`);
    }
  }

  assert.equal(total, 2_598_960);

  // Published exact frequencies for 5-card poker hands (e.g. Wikipedia "List of poker hands").
  assert.equal(counts.royalFlush, 4, 'royal flush');
  assert.equal(counts.straightFlush, 36, 'straight flush (excl. royal)');
  assert.equal(counts.quads, 624, 'four of a kind');
  assert.equal(counts.fullHouse, 3744, 'full house');
  assert.equal(counts.flush, 5108, 'flush (excl. straight flush)');
  assert.equal(counts.straight, 10200, 'straight (excl. straight flush)');
  assert.equal(counts.trips, 54912, 'three of a kind');
  assert.equal(counts.twoPair, 123552, 'two pair');
  assert.equal(counts.pair, 1098240, 'one pair');
  assert.equal(counts.highCard, 1302540, 'high card');

  const sum = Object.values(counts).reduce((a, b) => a + b, 0);
  assert.equal(sum, 2_598_960);
});
