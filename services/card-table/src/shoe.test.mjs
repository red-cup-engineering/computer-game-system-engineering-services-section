import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createShoe, cardsRemaining, needsShuffle, drawFromShoe, drawManyFromShoe, reshuffleShoe } from './shoe.mjs';

test('createShoe builds decks * 52 cards and places the cut card at the penetration fraction', () => {
  const shoe = createShoe({ decks: 6, seed: 'table-1', penetration: 0.75 });
  assert.equal(shoe.cards.length, 312);
  assert.equal(shoe.cutIndex, Math.floor(312 * 0.75));
  assert.equal(cardsRemaining(shoe), 312);
});

test('createShoe is deterministic for a given seed and differs across seeds', () => {
  const a = createShoe({ decks: 6, seed: 'same-seed' });
  const b = createShoe({ decks: 6, seed: 'same-seed' });
  assert.deepEqual(a.cards, b.cards);
  const c = createShoe({ decks: 6, seed: 'different-seed' });
  assert.notDeepEqual(a.cards, c.cards);
});

test('createShoe validates its options', () => {
  assert.throws(() => createShoe({ decks: 0, seed: 'x' }), RangeError);
  assert.throws(() => createShoe({ decks: 6, seed: '' }), TypeError);
  assert.throws(() => createShoe({ decks: 6, seed: 'x', penetration: 1 }), RangeError);
  assert.throws(() => createShoe({ decks: 6, seed: 'x', penetration: 0 }), RangeError);
});

test('drawFromShoe returns the top card and a new shoe, without mutating the original', () => {
  const shoe = createShoe({ decks: 1, seed: 'draw-test' });
  const snapshot = { ...shoe };
  const { card, shoe: next } = drawFromShoe(shoe);
  assert.deepEqual(card, shoe.cards[0]);
  assert.equal(next.cursor, 1);
  assert.deepEqual(shoe, snapshot); // original untouched
  assert.equal(cardsRemaining(next), 51);
});

test('drawManyFromShoe draws n cards in order and threads the shoe forward', () => {
  const shoe = createShoe({ decks: 1, seed: 'draw-many' });
  const { cards, shoe: next } = drawManyFromShoe(shoe, 5);
  assert.deepEqual(cards, shoe.cards.slice(0, 5));
  assert.equal(next.cursor, 5);
});

test('needsShuffle flips true once the cursor reaches the cut card, not before', () => {
  // Small shoe (1 deck, high penetration) so the cut card is easy to reach in a test.
  const shoe = createShoe({ decks: 1, seed: 'penetration-test', penetration: 0.1 });
  assert.equal(shoe.cutIndex, Math.floor(52 * 0.1));
  let current = shoe;
  assert.equal(needsShuffle(current), false);
  const { shoe: afterCut } = drawManyFromShoe(current, shoe.cutIndex);
  assert.equal(needsShuffle(afterCut), true);
});

test('a round in progress can keep drawing past the cut card — needsShuffle is advisory, not enforced', () => {
  const shoe = createShoe({ decks: 1, seed: 'mid-round', penetration: 0.1 });
  const { shoe: afterCut } = drawManyFromShoe(shoe, shoe.cutIndex);
  assert.equal(needsShuffle(afterCut), true);
  // The table can still draw more cards to finish the hand in progress.
  const { shoe: afterOneMore } = drawFromShoe(afterCut);
  assert.equal(afterOneMore.cursor, shoe.cutIndex + 1);
});

test('drawFromShoe throws once the physical shoe is fully exhausted', () => {
  let shoe = createShoe({ decks: 1, seed: 'exhaust-test' });
  ({ shoe } = drawManyFromShoe(shoe, 52));
  assert.equal(cardsRemaining(shoe), 0);
  assert.throws(() => drawFromShoe(shoe), RangeError);
});

test('reshuffleShoe rebuilds a fresh shoe with the same decks/penetration but a new seed', () => {
  const shoe = createShoe({ decks: 4, seed: 'before', penetration: 0.6 });
  const reshuffled = reshuffleShoe(shoe, 'after');
  assert.equal(reshuffled.decks, 4);
  assert.equal(reshuffled.penetration, 0.6);
  assert.equal(reshuffled.cursor, 0);
  assert.notDeepEqual(reshuffled.cards, shoe.cards);
});
