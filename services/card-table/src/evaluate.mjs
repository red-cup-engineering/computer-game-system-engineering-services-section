/**
 * `evaluate` — the poker hand evaluator. This is new work, not an extraction: no 561 Group
 * package (`parlor-kernel`, `cartridge`, `energy-bank`, `footing`, this package's own `deck`/
 * `svg`) has ever implemented 5-card hand ranking, and no hold'em/stud-shaped card game exists
 * yet in the estate to have needed one — the gap `card-table` closes for whichever poker-shaped
 * game lands next (in `casino-service` or elsewhere).
 *
 * Standard 10-category ranking, high-card through straight-flush; a royal flush is not a
 * distinct category (per standard poker convention) — it is simply the highest possible
 * straight-flush (ace-high, not the wheel), see `isRoyalFlush`. `evaluate5` (exactly five cards)
 * and `bestHand` (five *or more* cards — 6 or 7 for hold'em/stud, choosing the best 5-card
 * sub-hand by exhaustive combination) both return a `HandRank`: `{ category, tiebreak, score }`.
 * `score` is a single integer that totally orders every possible 5-card hand — `compareHands`
 * (and every use of `bestHand`) is just `score` comparison, never a multi-field tiebreak chain at
 * call sites.
 *
 * `evaluate.test.mts` enumerates all C(52,5) = 2,598,960 five-card hands and checks the category
 * counts against the well-known published frequencies (this is the exact-enumeration house style
 * `parlor-kernel/odds.mjs` established: never assert a probability/count as a hand-typed
 * constant when it can instead be *computed* and checked against the literature's own numbers).
 */

export const HAND_CATEGORY = Object.freeze({
  HIGH_CARD: 0,
  PAIR: 1,
  TWO_PAIR: 2,
  TRIPS: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  QUADS: 7,
  STRAIGHT_FLUSH: 8,
});

const CATEGORY_NAME = Object.freeze({
  0: 'high-card',
  1: 'pair',
  2: 'two-pair',
  3: 'trips',
  4: 'straight',
  5: 'flush',
  6: 'full-house',
  7: 'quads',
  8: 'straight-flush',
});

/** Human-readable category name, e.g. `categoryName(HAND_CATEGORY.FULL_HOUSE) === 'full-house'`. */
export function categoryName(category) {
  const name = CATEGORY_NAME[category];
  if (name === undefined) throw new RangeError(`evaluate: unknown category ${category}`);
  return name;
}

// Ace is high (14) everywhere except the wheel straight (A-2-3-4-5), handled explicitly below.
function acesHighValue(rank) {
  return rank === 1 ? 14 : rank;
}

const TIEBREAK_SLOTS = 5;
const TIEBREAK_BASE = 15; // ranks range 2..14; base 15 gives each digit its own slot with room to spare

/** Pack `[category, ...tiebreak]` (tiebreak padded/truncated to `TIEBREAK_SLOTS`, most
 *  significant first) into one integer that totally orders hands: same category compares by
 *  tiebreak, different categories never collide regardless of tiebreak values. */
function packScore(category, tiebreak) {
  let score = category;
  for (let i = 0; i < TIEBREAK_SLOTS; i++) {
    score = score * TIEBREAK_BASE + (tiebreak[i] ?? 0);
  }
  return score;
}

/**
 * Evaluate exactly five cards. Returns `{ category, tiebreak, score }`:
 * - `category` is one of `HAND_CATEGORY`'s values.
 * - `tiebreak` is a category-specific array of rank values (ace = 14, except a wheel straight's
 *   high card is reported as 5), most-significant comparison first, always meaningful only
 *   within the same category — comparing `tiebreak` arrays across different categories is not
 *   guaranteed sound; compare `score` instead (see `compareHands`).
 * - `score` totally orders every possible 5-card hand: `a.score > b.score` iff hand `a` beats
 *   hand `b`, regardless of category.
 */
export function evaluate5(cards) {
  if (!Array.isArray(cards) || cards.length !== 5) {
    throw new TypeError(`evaluate5: expected exactly 5 cards (got ${Array.isArray(cards) ? cards.length : typeof cards})`);
  }

  const values = cards.map((c) => acesHighValue(c.rank)).sort((a, b) => b - a);
  const isFlush = cards.every((c) => c.suit === cards[0].suit);

  const distinct = [...new Set(values)].sort((a, b) => b - a);
  let straightHigh = null;
  if (distinct.length === 5) {
    if (distinct[0] - distinct[4] === 4) {
      straightHigh = distinct[0];
    } else if (distinct[0] === 14 && distinct[1] === 5 && distinct[2] === 4 && distinct[3] === 3 && distinct[4] === 2) {
      straightHigh = 5; // the wheel: A-2-3-4-5, plays as a 5-high straight
    }
  }
  const isStraight = straightHigh !== null;

  if (isStraight && isFlush) {
    return { category: HAND_CATEGORY.STRAIGHT_FLUSH, tiebreak: [straightHigh], score: packScore(HAND_CATEGORY.STRAIGHT_FLUSH, [straightHigh]) };
  }

  // Group by rank value, sorted by (count desc, rank desc) — the shared tiebreak ordering every
  // grouped category (pair through quads) reads its tiebreak array off of directly.
  const countByRank = new Map();
  for (const v of values) countByRank.set(v, (countByRank.get(v) ?? 0) + 1);
  const groups = [...countByRank.entries()]
    .map(([rank, count]) => ({ rank, count }))
    .sort((a, b) => (b.count - a.count) || (b.rank - a.rank));
  const pattern = groups.map((g) => g.count).join('');

  if (pattern === '41') {
    const tiebreak = [groups[0].rank, groups[1].rank];
    return { category: HAND_CATEGORY.QUADS, tiebreak, score: packScore(HAND_CATEGORY.QUADS, tiebreak) };
  }
  if (pattern === '32') {
    const tiebreak = [groups[0].rank, groups[1].rank];
    return { category: HAND_CATEGORY.FULL_HOUSE, tiebreak, score: packScore(HAND_CATEGORY.FULL_HOUSE, tiebreak) };
  }
  if (isFlush) {
    return { category: HAND_CATEGORY.FLUSH, tiebreak: values, score: packScore(HAND_CATEGORY.FLUSH, values) };
  }
  if (isStraight) {
    return { category: HAND_CATEGORY.STRAIGHT, tiebreak: [straightHigh], score: packScore(HAND_CATEGORY.STRAIGHT, [straightHigh]) };
  }
  if (pattern === '311') {
    const tiebreak = [groups[0].rank, groups[1].rank, groups[2].rank];
    return { category: HAND_CATEGORY.TRIPS, tiebreak, score: packScore(HAND_CATEGORY.TRIPS, tiebreak) };
  }
  if (pattern === '221') {
    const tiebreak = [groups[0].rank, groups[1].rank, groups[2].rank];
    return { category: HAND_CATEGORY.TWO_PAIR, tiebreak, score: packScore(HAND_CATEGORY.TWO_PAIR, tiebreak) };
  }
  if (pattern === '2111') {
    const tiebreak = [groups[0].rank, groups[1].rank, groups[2].rank, groups[3].rank];
    return { category: HAND_CATEGORY.PAIR, tiebreak, score: packScore(HAND_CATEGORY.PAIR, tiebreak) };
  }
  // pattern === '11111': high card.
  return { category: HAND_CATEGORY.HIGH_CARD, tiebreak: values, score: packScore(HAND_CATEGORY.HIGH_CARD, values) };
}

/** A straight-flush whose high card is the ace (not the wheel) — the traditional "royal flush",
 *  reported as a fact about a `HandRank`, not a separate category (see module header). */
export function isRoyalFlush(handRank) {
  return handRank.category === HAND_CATEGORY.STRAIGHT_FLUSH && handRank.tiebreak[0] === 14;
}

/** `a.score - b.score`: negative if `a` loses to `b`, zero on an exact tie, positive if `a`
 *  beats `b`. Suitable directly as an `Array#sort` comparator (ascending = worst to best). */
export function compareHands(a, b) {
  return a.score - b.score;
}

function* combinations(items, k) {
  const n = items.length;
  if (k > n) return;
  const indices = Array.from({ length: k }, (_, i) => i);
  while (true) {
    yield indices.map((i) => items[i]);
    let i = k - 1;
    while (i >= 0 && indices[i] === i + n - k) i -= 1;
    if (i < 0) return;
    indices[i] += 1;
    for (let j = i + 1; j < k; j++) indices[j] = indices[j - 1] + 1;
  }
}

/**
 * Best possible 5-card `HandRank` out of `cards` (5, 6, or 7 cards — 7 is hold'em's "2 hole + 5
 * board"; 6 covers a stud/hold'em variant missing one street). Exactly `evaluate5` when
 * `cards.length === 5`; otherwise evaluates every C(n, 5) 5-card sub-hand and returns the one
 * with the highest `score`. Exhaustive, not a shortcut heuristic — C(7, 5) = 21 sub-hands is
 * cheap enough that "exact by brute force" beats any risk of a clever short-circuit missing a
 * hand (e.g. a flush hiding behind an apparent full house when a 6th card breaks the trips).
 */
export function bestHand(cards) {
  if (!Array.isArray(cards) || cards.length < 5) {
    throw new TypeError(`bestHand: expected at least 5 cards (got ${Array.isArray(cards) ? cards.length : typeof cards})`);
  }
  if (cards.length === 5) return evaluate5(cards);

  let best = null;
  for (const hand of combinations(cards, 5)) {
    const rank = evaluate5(hand);
    if (best === null || rank.score > best.score) best = rank;
  }
  return best;
}
