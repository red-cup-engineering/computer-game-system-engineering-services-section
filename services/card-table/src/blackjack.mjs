/**
 * `blackjack` — hand-total math (soft/hard, bust, blackjack detection), the dealer's fixed
 * hit/stand policy (H17/S17 as config), and exact per-decision EV (stand/hit/double/split)
 * computed by recursive enumeration over a shoe composition, in the same "compute it, don't
 * assert it" spirit as `parlor-kernel/odds.mjs`'s exhaustive dice/reel enumerations — this is
 * new work closing the estate's confirmed casino-math gap for blackjack, not an extraction.
 *
 * Standard public rules throughout (hand totals, dealer stands on all 17s unless configured
 * otherwise, blackjack pays the configured multiple) — cited as such rather than as a house
 * source, matching `tally.mjs`'s own citation discipline for standard game rules.
 *
 * ## Composition, not cards
 *
 * The EV functions below don't take `Card[]` or a `./shoe.mjs` `Shoe` — they take a
 * **composition**: a 10-element array `[count(1), count(2), ..., count(9), count(10-or-face)]`,
 * where index 9 holds the combined count of 10/J/Q/K (blackjack treats them identically). Only
 * card *value*, never suit or exact rank, affects a blackjack decision, so collapsing to this
 * 10-wide vector is both correct and what makes exact recursion tractable: two different
 * draw orders that remove the same multiset of values reach the identical composition (and
 * hand hard-total/ace-count), so memoizing on `composition.join(',')` collapses what would
 * otherwise be a combinatorial explosion of equivalent recursive paths into one — the "no
 * perfect-hash heroics" the task called for turns out to fall out of the domain for free.
 * `createShoeComposition`/`removeRanksFromComposition` bridge from an actual `./deck.mjs`
 * `Rank` (1-13) or a real `./shoe.mjs` `Shoe` to this value-space vector.
 *
 * ## Split EV's one documented approximation
 *
 * `handEV`'s `split` figure evaluates each of the two post-split hands independently against
 * the *same* composition (the shoe immediately after the split, before either hand's own
 * hits) rather than jointly threading hand A's realized hits into hand B's exact composition
 * before hand B is dealt its own new card. The one new card *each* hand receives at the split
 * is still drawn from an exact, enumerated distribution (a real 10-way branch, not an
 * expectation-only approximation) — what's approximated is only the second-order correlation
 * from hand A's *subsequent* hits changing hand B's composition, which is a small effect at
 * any shoe size this module is meant for (4+ decks; a single-deck, late-in-the-shoe split is
 * the one case where this approximation is least accurate). A fully joint treatment would need
 * to carry hand A's entire realized-outcome distribution (total, composition) forward into
 * hand B's evaluation rather than a scalar EV, which is a materially larger undertaking; this
 * is the pragmatic line drawn for this pass, documented rather than left implicit.
 */

// ── Hand-total math ─────────────────────────────────────────────────────────────────────────

/** Blackjack's card-value collapse: 2-9 count as themselves, 10/J/Q/K all count as 10, and an
 *  ace's *natural* value is reported as 11 (its high value) — `handTotal` is what actually
 *  resolves the low/high ambiguity across a whole hand. */
export function blackjackValue(rank) {
  if (rank === 1) return 11;
  return rank >= 10 ? 10 : rank;
}

function lowValue(rank) {
  return rank === 1 ? 1 : rank >= 10 ? 10 : rank;
}

/**
 * Fold a hand of `ranks` (1-13, `./deck.mjs`'s `Rank` domain) into its blackjack total:
 * `hard` treats every ace as 1; `best` upgrades exactly one ace to 11 if doing so doesn't bust
 * (the only upgrade that can ever help — a second ace-as-11 would always bust, since the
 * cheapest possible other card is a 2); `isSoft` reports whether that upgrade was used;
 * `isBust` is `best > 21`.
 */
export function handTotal(ranks) {
  if (!Array.isArray(ranks) || ranks.length === 0) {
    throw new TypeError('handTotal: ranks must be a non-empty array');
  }
  let hard = 0;
  let aceCount = 0;
  for (const rank of ranks) {
    hard += lowValue(rank);
    if (rank === 1) aceCount += 1;
  }
  const isSoft = aceCount > 0 && hard + 10 <= 21;
  const best = isSoft ? hard + 10 : hard;
  return { hard, best, isSoft, isBust: best > 21 };
}

/** A natural blackjack: exactly two cards totaling 21 (ace + any 10-value card). */
export function isBlackjack(ranks) {
  return Array.isArray(ranks) && ranks.length === 2 && handTotal(ranks).best === 21;
}

/** Whether a starting two-card hand can be split: same blackjack value by default (so a King
 *  and a Queen split as "two tens", the common commercial-casino rule); pass
 *  `{ sameRankOnly: true }` for the stricter "identical rank only" house rule. */
export function canSplit(ranks, { sameRankOnly = false } = {}) {
  if (!Array.isArray(ranks) || ranks.length !== 2) return false;
  return sameRankOnly ? ranks[0] === ranks[1] : blackjackValue(ranks[0]) === blackjackValue(ranks[1]);
}

// ── Dealer policy ───────────────────────────────────────────────────────────────────────────

/** The dealer's fixed policy: hit on any total below 17; on a *hard* 17 or above, always
 *  stand; on a *soft* 17, stand unless `hitSoft17` (H17) is configured, the one rule variant
 *  this module parametrizes (S17 — the default — vs. H17). */
export function dealerShouldHit(total, { hitSoft17 = false } = {}) {
  if (total.best > 21) return false;
  if (total.best < 17) return true;
  if (total.best === 17 && total.isSoft && hitSoft17) return true;
  return false;
}

/**
 * Play a dealer hand to completion against a real card source: `startingRanks` (the dealer's
 * up-card plus hole card), `drawRank()` a caller-supplied function returning the next rank
 * (pull from an actual `./shoe.mjs` shoe, or anything else) called once per hit. Returns
 * `{ ranks, total }` for the finished hand. This is the "real gameplay" counterpart to
 * `dealerOutcomeDistribution`'s exact probabilistic version below — same policy
 * (`dealerShouldHit`), one draws real cards, the other enumerates every possible one.
 */
export function playDealerHand(startingRanks, drawRank, options = {}) {
  if (typeof drawRank !== 'function') {
    throw new TypeError('playDealerHand: drawRank must be a function returning the next rank');
  }
  let ranks = [...startingRanks];
  while (dealerShouldHit(handTotal(ranks), options)) {
    ranks = [...ranks, drawRank()];
  }
  return { ranks, total: handTotal(ranks) };
}

// ── Shoe composition ────────────────────────────────────────────────────────────────────────

/** A full, unstarted shoe's composition: `decks` decks, values 1-9 at `4 * decks` each, value
 *  "10" (10/J/Q/K combined) at `16 * decks`. */
export function createShoeComposition(decks = 6) {
  if (!Number.isInteger(decks) || decks < 1) {
    throw new RangeError(`createShoeComposition: decks must be a positive integer (got ${decks})`);
  }
  const composition = new Array(10).fill(4 * decks);
  composition[9] = 16 * decks;
  return composition;
}

/** Total cards remaining in a composition. */
export function compositionTotal(composition) {
  return composition.reduce((a, b) => a + b, 0);
}

/** `composition` with one card of each rank in `ranks` removed (a `./deck.mjs` `Rank`, 1-13 —
 *  converted to its blackjack value bucket internally). Pure: returns a new array. Throws if
 *  a removal would take a bucket negative (the composition didn't actually have that card left
 *  — a sign the caller's bookkeeping of already-dealt cards is wrong). */
export function removeRanksFromComposition(composition, ranks) {
  const next = composition.slice();
  for (const rank of ranks) {
    const bucket = lowValue(rank); // ace -> 1, 10/J/Q/K -> 10, else the rank itself
    const index = bucket - 1;
    if (next[index] <= 0) {
      throw new RangeError(`removeRanksFromComposition: no cards of value ${bucket} left to remove`);
    }
    next[index] -= 1;
  }
  return next;
}

/** `[{ value, probability }]` for every value still present in `composition` (values 1-10; a
 *  value with zero cards left is omitted). Probabilities sum to 1 over a non-empty composition. */
export function drawProbabilities(composition) {
  const total = compositionTotal(composition);
  if (total === 0) return [];
  const out = [];
  for (let value = 1; value <= 10; value++) {
    const count = composition[value - 1];
    if (count > 0) out.push({ value, probability: count / total });
  }
  return out;
}

function compositionKey(composition) {
  return composition.join(',');
}

// ── Dealer outcome distribution (exact) ────────────────────────────────────────────────────

const TERMINAL_TOTALS = [17, 18, 19, 20, 21, 'bust'];

function mergeInto(target, source, weight) {
  for (const [key, p] of source) {
    target.set(key, (target.get(key) ?? 0) + weight * p);
  }
}

function dealerDistributionFrom(hard, aceCount, composition, options, memo) {
  const isSoft = aceCount > 0 && hard + 10 <= 21;
  const best = isSoft ? hard + 10 : hard;
  if (best > 21) return new Map([['bust', 1]]);
  if (!dealerShouldHit({ best, isSoft }, options)) return new Map([[best, 1]]);

  const key = `${compositionKey(composition)}|${hard}|${aceCount}`;
  const cached = memo.get(key);
  if (cached) return cached;

  const total = compositionTotal(composition);
  if (total === 0) {
    // Shoe exhausted mid-hand: not reachable in real play (a table reshuffles well before the
    // physical shoe empties, see `./shoe.mjs`'s cut card), but resolved as a stand rather than
    // dividing by zero.
    const result = new Map([[best, 1]]);
    memo.set(key, result);
    return result;
  }

  const result = new Map();
  for (let value = 1; value <= 10; value++) {
    const count = composition[value - 1];
    if (count === 0) continue;
    const p = count / total;
    const nextComposition = composition.slice();
    nextComposition[value - 1] -= 1;
    const nextHard = hard + (value === 1 ? 1 : value);
    const nextAceCount = aceCount + (value === 1 ? 1 : 0);
    const sub = dealerDistributionFrom(nextHard, nextAceCount, nextComposition, options, memo);
    mergeInto(result, sub, p);
  }
  memo.set(key, result);
  return result;
}

/**
 * The dealer's exact final-total distribution given a revealed `upcardRank` and a `composition`
 * that already excludes every known dealt card (the up-card itself, the hole card is *not*
 * known — that's exactly what this enumerates over — and the player's own hand). Returns a
 * plain object with all six keys always present: `{ 17, 18, 19, 20, 21, bust }`, probabilities
 * summing to 1.
 */
export function dealerOutcomeDistribution(upcardRank, composition, options = {}) {
  const total = compositionTotal(composition);
  if (total === 0) {
    throw new RangeError('dealerOutcomeDistribution: composition has no cards left to draw a hole card from');
  }
  const memo = new Map();
  const result = new Map();
  const upValue = lowValue(upcardRank);
  const upIsAce = upcardRank === 1;
  for (let hole = 1; hole <= 10; hole++) {
    const count = composition[hole - 1];
    if (count === 0) continue;
    const p = count / total;
    const nextComposition = composition.slice();
    nextComposition[hole - 1] -= 1;
    const hard = upValue + (hole === 1 ? 1 : hole);
    const aceCount = (upIsAce ? 1 : 0) + (hole === 1 ? 1 : 0);
    const sub = dealerDistributionFrom(hard, aceCount, nextComposition, options, memo);
    mergeInto(result, sub, p);
  }
  const out = {};
  for (const key of TERMINAL_TOTALS) out[key] = result.get(key) ?? 0;
  return out;
}

// ── Player EV (exact, recursive) ────────────────────────────────────────────────────────────

/** EV of standing right now on a fixed total `playerBest` (already resolved — never a bust)
 *  against the dealer's distribution from `upcardRank`/`composition`: dealer bust or a lower
 *  total each pay `+1`, a tie pays `0`, a higher dealer total pays `-1`. */
export function standEV(playerBest, upcardRank, composition, options = {}) {
  const dist = dealerOutcomeDistribution(upcardRank, composition, options);
  let ev = 0;
  for (const key of TERMINAL_TOTALS) {
    const p = dist[key];
    if (p === 0) continue;
    if (key === 'bust' || key < playerBest) ev += p;
    else if (key === playerBest) ev += 0;
    else ev -= p;
  }
  return ev;
}

function optimalEV(hard, aceCount, upcardRank, composition, options, memo) {
  const isSoft = aceCount > 0 && hard + 10 <= 21;
  const best = isSoft ? hard + 10 : hard;
  if (best > 21) return -1;

  const key = `${compositionKey(composition)}|${hard}|${aceCount}|${upcardRank}`;
  const cached = memo.get(key);
  if (cached !== undefined) return cached;

  const stand = standEV(best, upcardRank, composition, options);
  let value = stand;

  if (best < 21) {
    const total = compositionTotal(composition);
    if (total > 0) {
      let hitAcc = 0;
      for (let v = 1; v <= 10; v++) {
        const count = composition[v - 1];
        if (count === 0) continue;
        const p = count / total;
        const nextComposition = composition.slice();
        nextComposition[v - 1] -= 1;
        const nextHard = hard + (v === 1 ? 1 : v);
        const nextAceCount = aceCount + (v === 1 ? 1 : 0);
        const outcome = optimalEV(nextHard, nextAceCount, upcardRank, nextComposition, options, memo);
        hitAcc += p * outcome;
      }
      value = Math.max(stand, hitAcc);
    }
  }

  memo.set(key, value);
  return value;
}

/** EV of hitting once now and thereafter playing the hard/soft `(hard, aceCount)` state
 *  optimally (hit-or-stand at every subsequent total) — the "if my next action is definitely a
 *  hit" figure `handEV.hit` reports. */
function hitEV(hard, aceCount, upcardRank, composition, options, memo) {
  const total = compositionTotal(composition);
  if (total === 0) return Number.NaN;
  let acc = 0;
  for (let v = 1; v <= 10; v++) {
    const count = composition[v - 1];
    if (count === 0) continue;
    const p = count / total;
    const nextComposition = composition.slice();
    nextComposition[v - 1] -= 1;
    const nextHard = hard + (v === 1 ? 1 : v);
    const nextAceCount = aceCount + (v === 1 ? 1 : 0);
    const nextIsSoft = nextAceCount > 0 && nextHard + 10 <= 21;
    const nextBest = nextIsSoft ? nextHard + 10 : nextHard;
    const outcome = nextBest > 21 ? -1 : optimalEV(nextHard, nextAceCount, upcardRank, nextComposition, options, memo);
    acc += p * outcome;
  }
  return acc;
}

/** EV of doubling down: exactly one forced card, then must stand, at double the original stake
 *  (so the return is in `[-2, 2]`, not `[-1, 1]`). */
function doubleEV(hard, aceCount, upcardRank, composition, options) {
  const total = compositionTotal(composition);
  if (total === 0) return Number.NaN;
  let acc = 0;
  for (let v = 1; v <= 10; v++) {
    const count = composition[v - 1];
    if (count === 0) continue;
    const p = count / total;
    const nextComposition = composition.slice();
    nextComposition[v - 1] -= 1;
    const nextHard = hard + (v === 1 ? 1 : v);
    const nextAceCount = aceCount + (v === 1 ? 1 : 0);
    const nextIsSoft = nextAceCount > 0 && nextHard + 10 <= 21;
    const nextBest = nextIsSoft ? nextHard + 10 : nextHard;
    const outcome = nextBest > 21 ? -1 : standEV(nextBest, upcardRank, nextComposition, options);
    acc += p * outcome;
  }
  return 2 * acc;
}

/** EV of splitting a pair: each of the two resulting hands is dealt one new card (an exact,
 *  enumerated 10-way branch each) and then played hit/stand-optimally; the two hands' EVs are
 *  summed (each in `[-1, 1]`, so the total is in `[-2, 2]`, matching two bets at stake) — see
 *  the module header ("Split EV's one documented approximation") for the one joint-composition
 *  simplification this makes. */
function splitEV(splitRank, upcardRank, composition, options) {
  const total = compositionTotal(composition);
  if (total === 0) return Number.NaN;
  const memo = new Map();
  const startHard = lowValue(splitRank);
  const startAceCount = splitRank === 1 ? 1 : 0;
  let acc = 0;
  for (let v = 1; v <= 10; v++) {
    const count = composition[v - 1];
    if (count === 0) continue;
    const p = count / total;
    const nextComposition = composition.slice();
    nextComposition[v - 1] -= 1;
    const hard = startHard + (v === 1 ? 1 : v);
    const aceCount = startAceCount + (v === 1 ? 1 : 0);
    const oneHandEV = optimalEV(hard, aceCount, upcardRank, nextComposition, options, memo);
    acc += p * oneHandEV;
  }
  return 2 * acc;
}

/**
 * Exact per-decision EV for `playerRanks` (a 2+-card hand; `stand`/`hit` are meaningful at any
 * size, `double`/`split` only apply to an original 2-card hand) against `upcardRank`, given a
 * `composition` that already excludes every card known dealt (the player's own hand and the
 * dealer's up-card). All EVs are per unit of the *original* bet.
 *
 * Returns `{ stand, hit, double, split }`; `double` is `null` unless `playerRanks.length === 2`,
 * `split` is `null` unless `canSplit(playerRanks, options)`.
 */
export function handEV(playerRanks, upcardRank, composition, options = {}) {
  if (!Array.isArray(playerRanks) || playerRanks.length < 2) {
    throw new TypeError('handEV: playerRanks must have at least 2 cards');
  }
  const total = handTotal(playerRanks);
  if (total.isBust) {
    throw new RangeError('handEV: playerRanks is already bust — there is no decision to price');
  }

  const memo = new Map();
  let hard = 0;
  let aceCount = 0;
  for (const rank of playerRanks) {
    hard += lowValue(rank);
    if (rank === 1) aceCount += 1;
  }

  const stand = standEV(total.best, upcardRank, composition, options);
  const hit = total.best >= 21 ? -Infinity : hitEV(hard, aceCount, upcardRank, composition, options, memo);
  const double = playerRanks.length === 2 ? doubleEV(hard, aceCount, upcardRank, composition, options) : null;
  const split = playerRanks.length === 2 && canSplit(playerRanks, options)
    ? splitEV(playerRanks[0], upcardRank, composition, options)
    : null;

  return { stand, hit, double, split };
}
