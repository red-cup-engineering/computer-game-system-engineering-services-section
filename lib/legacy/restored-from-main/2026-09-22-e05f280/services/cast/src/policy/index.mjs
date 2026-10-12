/**
 * policy/index.mjs — the full `./policy` surface re-exported from one module, matching
 * `@red-cup-engineering/card-table`'s own barrel convention. A game wiring its own table logic
 * is still expected to import the narrower subpaths (`./policy/blackjack`, `./policy/bankroll`,
 * `./policy/slots`) directly.
 *
 * ## The policy contract every new game implements
 *
 * A policy is nothing more than a pure function of this shape:
 *
 *     (gameState, persona, rng) => decision
 *
 * `gameState` is whatever plain data the game needs to decide (this package never assumes a
 * common shape across games — blackjack's and slots' state shapes share nothing but being
 * plain JSON); `persona` is a `../persona.d.ts` `Persona`; `rng` is a `../rng.d.ts` `Rng`
 * stream the caller already seeded (see `../runner.mjs` for the seeding convention). The
 * function must be PURE — no I/O, no ambient randomness, no mutation of its arguments — so a
 * new game's policy is trivially unit-testable in isolation and trivially replay-verifiable
 * once wired into `../runner.mjs`. `./blackjack.mjs` and `./slots.mjs` both additionally
 * export a `toIntent(decision)` pure function turning a decision into a wire intent; a new
 * game's policy module is expected to do the same so `../runner.mjs` can use it as the default
 * `toIntent` when none is supplied.
 *
 * `./blackjack.mjs` and `./slots.mjs` each export their own `toIntent`, so this barrel
 * re-exports them under game-prefixed names (`blackjackToIntent`, `slotsToIntent`) to avoid a
 * name collision — importing `./policy/blackjack` or `./policy/slots` directly gets the plain
 * `toIntent` name back.
 */
export {
  blackjackPolicy, toIntent as blackjackToIntent, deviationProbability, trailingLossStreak,
} from './blackjack.mjs';
export * from './bankroll.mjs';
export {
  slotsPolicy, toIntent as slotsToIntent, chooseBet, classifySpinOutcome,
} from './slots.mjs';
export * from './wander.mjs';
