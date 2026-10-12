import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rankLabel, suitColorClass, cardFaceMarkup, cardBackMarkup, cardBackFor, emptyPileMarkup,
  cardMarkup, chipMarkup, chipStackMarkup, BACK_VARIANTS,
} from './svg.mjs';

test('rankLabel: ace/face cards use letters, numbers use digits', () => {
  assert.equal(rankLabel(1), 'A');
  assert.equal(rankLabel(7), '7');
  assert.equal(rankLabel(10), '10');
  assert.equal(rankLabel(11), 'J');
  assert.equal(rankLabel(12), 'Q');
  assert.equal(rankLabel(13), 'K');
});

test('suitColorClass: hearts/diamonds are red, clubs/spades are black', () => {
  assert.equal(suitColorClass('H'), 'suit-red');
  assert.equal(suitColorClass('D'), 'suit-red');
  assert.equal(suitColorClass('C'), 'suit-black');
  assert.equal(suitColorClass('S'), 'suit-black');
});

test('cardFaceMarkup produces valid-looking, string-built SVG with no document access', () => {
  const markup = cardFaceMarkup({ suit: 'S', rank: 1, faceUp: true });
  assert.ok(markup.startsWith('<svg'));
  assert.ok(markup.endsWith('</svg>'));
  assert.ok(markup.includes('suit-black'));
  assert.ok(markup.includes('A of spades')); // aria-label: rank label + suit name
});

test('cardBackMarkup defaults to the lattice variant (solitaire\'s original, only pattern)', () => {
  const markup = cardBackMarkup();
  assert.ok(markup.includes('card-back-lattice'));
});

test('cardBackMarkup supports every advertised BACK_VARIANTS entry', () => {
  assert.ok(BACK_VARIANTS.includes('lattice'));
  assert.ok(BACK_VARIANTS.length >= 3);
  for (const variant of BACK_VARIANTS) {
    const markup = cardBackMarkup(variant);
    assert.ok(markup.startsWith('<svg'));
    assert.ok(markup.includes(`card-back-${variant}`));
  }
});

test('cardBackMarkup rejects an unknown variant', () => {
  assert.throws(() => cardBackMarkup('nonexistent'), RangeError);
});

test('cardBackFor renders the same back as cardBackMarkup but tags the card without revealing it', () => {
  const card = { suit: 'H', rank: 7, faceUp: false };
  const tagged = cardBackFor(card);
  assert.ok(tagged.includes('data-card="H7"'));
  assert.ok(!tagged.includes('suit-red')); // no face-revealing class leaks into the back markup
  const untagged = cardBackMarkup();
  // Same markup modulo the injected data-card attribute.
  assert.equal(tagged.replace(' data-card="H7"', ''), untagged);
});

test('emptyPileMarkup renders a dashed outline, with or without a label', () => {
  const bare = emptyPileMarkup();
  assert.ok(bare.includes('card-empty-outline'));
  assert.ok(!bare.includes('card-empty-label'));
  const labeled = emptyPileMarkup('Foundation');
  assert.ok(labeled.includes('card-empty-label'));
  assert.ok(labeled.includes('Foundation'));
});

test('cardMarkup dispatches on faceUp', () => {
  const up = cardMarkup({ suit: 'S', rank: 1, faceUp: true });
  const down = cardMarkup({ suit: 'S', rank: 1, faceUp: false });
  assert.ok(up.includes('card-face-svg'));
  assert.ok(down.includes('card-back-svg'));
});

test('chipMarkup renders a labeled chip face', () => {
  const markup = chipMarkup(25);
  assert.ok(markup.startsWith('<svg'));
  assert.ok(markup.includes('chip-body'));
  assert.ok(markup.includes('>25<'));
});

test('chipMarkup with no value omits the value label but still renders a chip', () => {
  const markup = chipMarkup(undefined);
  assert.ok(markup.includes('chip-body'));
  assert.ok(!markup.includes('chip-value-text'));
});

test('chipStackMarkup grows its viewBox height with the chip count, up to maxRendered', () => {
  const one = chipStackMarkup(5, 1);
  const five = chipStackMarkup(5, 5);
  assert.ok(one.includes('viewBox="0 0 60 60"'));
  assert.ok(five.includes('viewBox="0 0 60 100"')); // 60 + 10*(5-1)
});

test('chipStackMarkup caps rendered chip bodies at maxRendered and adds a count label beyond it', () => {
  const big = chipStackMarkup(5, 500);
  assert.ok(big.includes('viewBox="0 0 60 250"')); // 60 + 10*(20-1)
  assert.ok(big.includes('x500'));
  const small = chipStackMarkup(5, 3);
  assert.ok(!small.includes('chip-stack-count-text'));
});

test('chipStackMarkup(_, 0) renders an empty stack without throwing', () => {
  const empty = chipStackMarkup(5, 0);
  assert.ok(empty.startsWith('<svg'));
  assert.ok(empty.includes('stack of 0 chips'));
});

test('chipStackMarkup rejects a negative or non-integer count', () => {
  assert.throws(() => chipStackMarkup(5, -1), RangeError);
  assert.throws(() => chipStackMarkup(5, 1.5), RangeError);
});
