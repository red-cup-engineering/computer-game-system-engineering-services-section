# card-table

`@red-cup-engineering/card-table` — the house's shared playing-card engine: the card model,
deterministic seeded shuffling, deck/shoe construction, procedural SVG card art, an exact poker
hand evaluator, and blackjack hand-total/dealer-policy/EV math. One package for every 561 Group
game built around a standard deck, the way `parlor-kernel` is one package for the dice/board/slot
shelf and `energy-bank` is one package for identity + the double-entry ledger.

Zero runtime dependencies.

## Provenance

`./deck` and `./svg` are **extracted, not new work**: `./deck` is
`solitaire-service/src/cards.mts`'s card model, FNV-1a + mulberry32 seeded shuffle, and deck
builder, generalized from solitaire's `decks: 1 | 2` to an arbitrary positive deck count (a
blackjack shoe wants 4-8); `./svg` is `solitaire-service/web/js/cards-svg.mjs`'s procedural,
zero-DOM inline-SVG card faces/backs verbatim, plus three additions solitaire never needed
(named back-pattern variants, a face-down-by-value helper, and a chip/stack SVG in the same
idiom). The **FNV-1a and mulberry32 algorithms in `./deck` are copied bit-for-bit** — a seed
string must keep producing the exact card order it always has, so `deck.test.mts` pins that
guarantee with golden shuffles captured by running solitaire's own `cards.mts` once, rather than
trusting a re-derivation to match by construction.

This mirrors `@red-cup-engineering/footing`'s own extraction discipline (its header: "Extracted
verbatim from apps/ruinfold's own server/ modules ... after apps/durante independently,
disclosedly ported the same modules"), applied here at a different point in the same shape of
history: `footing` resolved duplication that had already happened across two apps; `card-table`
extracts `solitaire-service`'s card/SVG modules ahead of a second card game existing to duplicate
them, on the same underlying premise (shared substrate belongs in one package, not copied per
game) applied pre-emptively rather than after the fact. **`solitaire-service` itself is
deliberately left unmodified by this pass** — it still owns and runs its own `src/cards.mts` and
`web/js/cards-svg.mjs` verbatim; repointing it to import `card-table` instead (the actual
duplication-resolution step, matching what `footing`'s own history records happening once
`footing` existed) is out of scope here and left for a later pass.

`./evaluate` and `./blackjack` are **new work, not an extraction**: no 561 Group package has ever
implemented poker hand ranking or blackjack math, and no hold'em/blackjack-shaped game has existed
yet to have needed one. They close a confirmed gap in the estate's casino-math coverage, in the
same "compute it by exhaustive enumeration, never assert it as a hand-typed constant" style
`parlor-kernel/odds.mjs` established for dice bust probabilities and slot RTP — see that module's
own header for the precedent this package continues rather than reinvents.

## Install

```sh
npm install @red-cup-engineering/card-table --registry http://127.0.0.1:4873/
```

## Modules

### `./deck` — card model, deck building, seeded shuffle, draw/deal

```ts
type Suit = 'C' | 'D' | 'H' | 'S';
type Rank = number; // 1 = Ace ... 13 = King
interface Card { suit: Suit; rank: Rank; faceUp: boolean }

cardColor(card: Card): 'red' | 'black'
cardLabel(card: Card): string                    // "AS", "10H", "KD"

hashSeed(text: string): number                    // FNV-1a, verbatim port
rngFrom(seed: number): Rng                        // mulberry32, verbatim port
interface Rng { next(): number; int(min: number, max: number): number }

makeDeck(decks?: number, suitsInPlay?: 1 | 2 | 3 | 4): Card[]
shuffle(cards: readonly Card[], rng: Rng): Card[]           // pure, never mutates
shuffledDeck(seed: string, decks?: number, suitsInPlay?: 1 | 2 | 3 | 4): Card[]

draw(deck: readonly Card[], n?: number): { drawn: Card[]; remaining: Card[] }
deal(deck: readonly Card[], handCount: number, cardsPerHand: number):
  { hands: Card[][]; remaining: Card[] }            // round-robin, one card at a time
withFaceUp(card: Card, faceUp?: boolean): Card
```

`makeDeck(1, 4)` is a standard 52-card deck (poker, blackjack); `makeDeck(6, 4)` is a 6-deck
blackjack-shaped shoe's worth of cards (312, unshuffled — see `./shoe` for the actual dealing
shoe abstraction); `makeDeck(2, 1|2|4)` reproduces solitaire's Spider variants exactly.

```js
import { shuffledDeck, draw, deal } from '@red-cup-engineering/card-table/deck';

const deck = shuffledDeck('2026-08-29:holdem-daily', 1, 4);
const { hands, remaining } = deal(deck, 4, 2); // 4 hold'em hole-card hands, 2 cards each
const { drawn: flop, remaining: afterFlop } = draw(remaining, 3);
```

### `./shoe` — multi-deck dealing shoe, cut-card penetration

```ts
interface Shoe { cards: readonly Card[]; cursor: number; cutIndex: number; decks: number; penetration: number }

createShoe(options: { decks?: number; seed: string; penetration?: number }): Shoe
cardsRemaining(shoe: Shoe): number
needsShuffle(shoe: Shoe): boolean                 // cursor has reached the cut card
drawFromShoe(shoe: Shoe): { card: Card; shoe: Shoe }         // pure — thread the returned shoe
drawManyFromShoe(shoe: Shoe, n: number): { cards: Card[]; shoe: Shoe }
reshuffleShoe(shoe: Shoe, seed: string): Shoe
```

Immutable cursor over a shuffled multi-deck stack, for blackjack/baccarat-shaped games: deal off
a running shoe rather than a single 52-card deck consumed to exhaustion. `needsShuffle` is
advisory (a round in progress keeps drawing past the cut card; the table reshuffles *between*
rounds, never mid-hand).

```js
import { createShoe, drawManyFromShoe, needsShuffle, reshuffleShoe } from '@red-cup-engineering/card-table/shoe';

let shoe = createShoe({ decks: 6, seed: 'table-42-round-1', penetration: 0.75 });
let hand;
({ cards: hand, shoe } = drawManyFromShoe(shoe, 2));
if (needsShuffle(shoe)) shoe = reshuffleShoe(shoe, 'table-42-round-2');
```

### `./svg` — procedural card art, zero DOM

```ts
rankLabel(rank: number): string
suitColorClass(suit: Suit): 'suit-red' | 'suit-black'
cardFaceMarkup(card: Card): string

BACK_VARIANTS: readonly string[]                  // 'lattice' (solitaire's original), 'diamonds', 'plain'
cardBackMarkup(variant?: string): string
cardBackFor(card: Card, variant?: string): string // back markup tagged data-card="H7", never revealing the face
emptyPileMarkup(label?: string): string
cardMarkup(card: Card, backVariant?: string): string  // dispatches on card.faceUp

chipMarkup(value: number | string | null | undefined): string
chipStackMarkup(value, count: number, options?: { maxRendered?: number }): string
```

Pure string-building — no `document` access, so it loads and runs identically under Node (tests)
and in a browser. Every card, in every theme, is the same vector paths recolored through
`--suit-red`/`--suit-black`/`--card-face`/`--card-back-*`/`--chip-*` CSS custom properties; a
re-theme is a stylesheet change, never a re-export.

### `./evaluate` — poker hand evaluator (the confirmed gap, closed)

```ts
HAND_CATEGORY: { HIGH_CARD, PAIR, TWO_PAIR, TRIPS, STRAIGHT, FLUSH, FULL_HOUSE, QUADS, STRAIGHT_FLUSH }
categoryName(category): string

interface HandRank { category: HandCategory; tiebreak: readonly number[]; score: number }
evaluate5(cards: readonly Card[]): HandRank        // exactly 5 cards
isRoyalFlush(handRank: HandRank): boolean          // a fact about a straight flush, not its own category
compareHands(a: HandRank, b: HandRank): number     // a.score - b.score; sort-comparator-ready
bestHand(cards: readonly Card[]): HandRank         // 5-7 cards; best-5-of-N by exhaustive C(n,5)
```

`score` totally orders every 5-card hand in one integer comparison — no call site needs a
multi-field tiebreak chain. `evaluate.test.mts` enumerates all C(52,5) = 2,598,960 hands and
checks every category's count against the published frequencies (see Test results below).

```js
import { bestHand, compareHands, isRoyalFlush } from '@red-cup-engineering/card-table/evaluate';

// Hold'em: 2 hole cards + 5 board cards, best 5-of-7.
const heroBest = bestHand([...heroHole, ...board]);
const villainBest = bestHand([...villainHole, ...board]);
const heroWins = compareHands(heroBest, villainBest) > 0;
if (isRoyalFlush(heroBest)) announceRoyal();
```

### `./blackjack` — hand totals, dealer policy, exact recursive EV

```ts
blackjackValue(rank): number                       // ace -> 11, 10/J/Q/K -> 10, else itself
interface HandTotal { hard: number; best: number; isSoft: boolean; isBust: boolean }
handTotal(ranks: readonly Rank[]): HandTotal
isBlackjack(ranks): boolean                         // exactly 2 cards, best === 21
canSplit(ranks, options?: { sameRankOnly?: boolean }): boolean

dealerShouldHit(total, options?: { hitSoft17?: boolean }): boolean   // S17 default, H17 opt-in
playDealerHand(startingRanks, drawRank: () => Rank, options?): { ranks: Rank[]; total: HandTotal }

type Composition = number[];                        // 10-wide value-bucket vector; see below
createShoeComposition(decks?: number): Composition
compositionTotal(composition): number
removeRanksFromComposition(composition, ranks: readonly Rank[]): Composition
drawProbabilities(composition): { value: number; probability: number }[]

dealerOutcomeDistribution(upcardRank, composition, options?):
  { 17: number; 18: number; 19: number; 20: number; 21: number; bust: number }  // sums to 1
standEV(playerBest, upcardRank, composition, options?): number

interface HandEVResult { stand: number; hit: number; double: number | null; split: number | null }
handEV(playerRanks, upcardRank, composition, options?): HandEVResult
```

The EV functions take a **composition** — a 10-element `[count(1), ..., count(9), count(10/J/Q/K)]`
vector — not `Card[]` or a `./shoe` `Shoe`, because only card *value* ever affects a blackjack
decision, and collapsing to that vector is what makes exact recursion tractable: any two draw
orders that remove the same multiset of values land on the identical composition + hand state, so
memoizing on the composition collapses what would otherwise be a combinatorial explosion of
equivalent paths into one polynomial-sized table. `createShoeComposition`/
`removeRanksFromComposition` bridge from real `Rank`s (a dealt hand, a `./shoe` `Shoe`) to this
vector.

```js
import { createShoeComposition, removeRanksFromComposition, handEV } from '@red-cup-engineering/card-table/blackjack';

const composition = removeRanksFromComposition(createShoeComposition(6), [10, 6, 10]); // player's 10,6 + dealer's 10 upcard
const { stand, hit, double, split } = handEV([10, 6], 10, composition, { hitSoft17: false });
// stand < 0, hit < 0, hit >= stand -- the textbook 16-vs-10 borderline decision, computed, not looked up.
```

**Split EV's one documented approximation**: each of the two post-split hands is priced against
the *same* composition (the shoe immediately after the split), rather than jointly threading one
hand's realized hits into the other's exact composition before it's dealt its own new card. The
new card each hand receives is still an exact, enumerated 10-way branch — what's approximated is
only the second-order correlation from one split hand's *subsequent* hits changing the sibling
hand's composition, a small effect except in a single-deck, late-in-the-shoe split. See the
module header for the full reasoning.

## Test results

```
node --test src/*.test.mts
ℹ tests 106
ℹ pass 106
ℹ fail 0
```

The headline result — `evaluate.test.mts`'s exhaustive category count over all 2,598,960 5-card
hands, matched against the published frequencies exactly, not within a tolerance:

| Category | Count | Published |
|---|---:|---:|
| Royal flush | 4 | 4 |
| Straight flush (excl. royal) | 36 | 36 |
| Four of a kind | 624 | 624 |
| Full house | 3,744 | 3,744 |
| Flush (excl. straight flush) | 5,108 | 5,108 |
| Straight (excl. straight flush) | 10,200 | 10,200 |
| Three of a kind | 54,912 | 54,912 |
| Two pair | 123,552 | 123,552 |
| One pair | 1,098,240 | 1,098,240 |
| High card | 1,302,540 | 1,302,540 |
| **Total** | **2,598,960** | **2,598,960** |

`blackjack.test.mts` checks internal consistency and cross-checks the exact recursive EV engine
against an *independently written* Monte Carlo simulation (real shuffled decks via `./deck`,
real dealt hands, tens of thousands of trials) rather than memorized literature EV figures, per
the task's own "verify against enumeration not folklore": hard 20 always prefers standing to
hitting (every upcard, both S17/H17); hard 16 vs. dealer 10 has both stand and hit EV negative
with hit weakly better than stand (the textbook borderline case); splitting aces beats playing
them as a pair; splitting tens is worse than standing on the made 20. `deck.test.mts` regression-
tests five golden shuffles captured from solitaire-service's original `cards.mts` so this
extraction cannot silently reshuffle an already-played daily deal.

## What a poker/blackjack casino game consumes

- **Table setup**: `./shoe#createShoe` (blackjack/baccarat) or `./deck#shuffledDeck` (poker,
  single-deck-per-hand games) for a deterministic, seeded, reproducible deal.
- **Dealing**: `./shoe#drawManyFromShoe` / `./deck#deal` for hole cards and the board; `./shoe`'s
  `needsShuffle` to drive the between-rounds reshuffle prompt.
- **Rendering**: `./svg#cardMarkup`/`cardBackFor`/`chipStackMarkup` for the table felt — every
  card and chip stack as themed inline SVG, no image assets to ship or re-theme.
- **Poker resolution**: `./evaluate#bestHand` on each player's hole + board cards,
  `compareHands` to rank them, `isRoyalFlush` for the marquee-outcome check.
- **Blackjack resolution**: `./blackjack#handTotal`/`isBlackjack` to resolve a finished hand;
  `./blackjack#playDealerHand` to run the dealer's turn against the real dealt shoe.
- **Blackjack disclosure** (the "published odds" house signature applied to blackjack, alongside
  `parlor-kernel/odds.mjs`'s RTP/bust-probability figures for dice and slots): `./blackjack#handEV`
  computed live against the table's actual remaining shoe composition, for a basic-strategy hint
  overlay or a house-honesty disclosure panel — exact, not a static strategy-card lookup.

## Development

```sh
npm test        # node --test over every *.test.mts file
npm run check   # node --check over every source .mjs file
npm run check && npm test  # both
```
