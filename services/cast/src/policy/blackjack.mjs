/**
 * `policy/blackjack` — the cast's blackjack hand-action policy. Baseline is exact per-decision
 * EV via `@red-cup-engineering/card-table/blackjack`'s `handEV` (recursive shoe-composition
 * enumeration, not a memorized basic-strategy card); a persona's temperament is layered on top
 * as a *deviation* from that baseline, never a replacement for it — the EV table this module
 * computes is the same one a house honesty/hint overlay would show a human at the same seat.
 *
 * ## The witnessing guarantee
 *
 * At `persona.temperament === NEUTRAL_TEMPERAMENT` (`riskTolerance: 0.5`, `tiltProneness: 0`),
 * `deviationProbability` below is always exactly 0 — proven in `blackjack.test.mts`, not just
 * asserted — so a neutral persona plays the exact-EV action on every single hand, with no rng
 * draw able to move it off that action. Away from neutral, a deviation is BOUNDED (it can only
 * swap the chosen action for the single next-best *legal* action by EV — never a third-choice
 * or worse) and always COSTED (`deviationCost = bestEV - chosenEV`, always >= 0, always present
 * on the returned decision, whether or not a deviation actually happened this hand). This is
 * the house's "always able to say what the persona gave up" signature applied to the cast: any
 * floor display, chat line, or audit can report the exact EV a persona left on the table by
 * playing in-character rather than optimally.
 *
 * `riskTolerance` above the neutral 0.5 raises the deviation chance (a bolder player takes the
 * close, spicier action more often); `tiltProneness` raises it further after a trailing loss
 * streak (`recentOutcomes`) — chasing losses, a well-documented real player behavior this
 * module makes an explicit, disclosed, bounded parameter rather than an emergent bug.
 */
import { handEV, canSplit } from '@red-cup-engineering/card-table/blackjack';

const clamp01 = (n) => Math.max(0, Math.min(1, n));

/** How many *consecutive* trailing losses sit at the end of `recentOutcomes` (most-recent
 *  last) — a win, push, or blackjack resets the count to 0. */
export function trailingLossStreak(recentOutcomes = []) {
  let streak = 0;
  for (let i = recentOutcomes.length - 1; i >= 0; i--) {
    if (recentOutcomes[i] !== 'loss') break;
    streak += 1;
  }
  return streak;
}

/** The probability a persona deviates from the exact-EV action on this hand. Exactly 0 at
 *  `riskTolerance <= 0.5` with no trailing loss streak (or `tiltProneness === 0`) — this is
 *  the property that makes `NEUTRAL_TEMPERAMENT` play exact-EV with certainty, not just high
 *  probability. Bounded to `[0, 0.85]` so even an extreme temperament never approaches
 *  "coin flip or worse" territory on every hand. */
export function deviationProbability(persona, recentOutcomes = []) {
  const riskTolerance = clamp01(persona.temperament?.riskTolerance ?? 0.5);
  const tiltProneness = clamp01(persona.temperament?.tiltProneness ?? 0);
  const riskSkew = Math.max(0, (riskTolerance - 0.5) * 2); // 0 at <=0.5, up to 1 at riskTolerance=1
  const lossStreak = trailingLossStreak(recentOutcomes);
  const tiltBoost = tiltProneness * Math.min(1, lossStreak / 3); // ramps over a 3-loss streak
  return Math.min(0.85, 0.35 * riskSkew + 0.5 * tiltBoost);
}

/** The legal `(action, ev)` pairs for this hand, sorted best-EV-first. `double`/`split` are
 *  included only when `handEV` returned a non-null figure for them (i.e. only on an eligible
 *  first two cards). `-Infinity`/`NaN` EVs (an already-21 hit, an exhausted composition) are
 *  excluded from consideration as a *deviation target* but `stand` is always present and
 *  finite, so this list is never empty. */
function rankedActions(ev) {
  const candidates = [
    { action: 'stand', ev: ev.stand },
    { action: 'hit', ev: ev.hit },
  ];
  if (ev.double !== null) candidates.push({ action: 'double', ev: ev.double });
  if (ev.split !== null) candidates.push({ action: 'split', ev: ev.split });
  return candidates
    .filter((c) => Number.isFinite(c.ev))
    .sort((a, b) => b.ev - a.ev);
}

/**
 * Decide a blackjack hand action for `persona` against `state`:
 *
 *  - `state.playerRanks` (>= 2 cards), `state.upcardRank`, `state.composition` (a card-table
 *    `Composition` vector already excluding every known dealt card) are required.
 *  - `state.options` (optional) is forwarded to `handEV`/`canSplit` (`hitSoft17`,
 *    `sameRankOnly`).
 *  - `state.recentOutcomes` (optional, most-recent last: `'win'|'loss'|'push'|'blackjack'`)
 *    feeds the tilt-chasing deviation boost.
 *
 * `rng` is an explicit `Rng` stream (computer-data randomization's `seededStream`) — this function is otherwise pure.
 */
export function blackjackPolicy(state, persona, rng) {
  const { playerRanks, upcardRank, composition, options = {}, recentOutcomes = [] } = state;
  const ev = handEV(playerRanks, upcardRank, composition, options);
  const ranked = rankedActions(ev);
  const best = ranked[0];
  const pDeviate = deviationProbability(persona, recentOutcomes);
  const deviate = ranked.length > 1 && pDeviate > 0 && rng.chance(pDeviate);
  const chosen = deviate ? ranked[1] : best;

  return Object.freeze({
    action: chosen.action,
    ev,
    bestAction: best.action,
    bestEV: best.ev,
    chosenEV: chosen.ev,
    deviationCost: best.ev - chosen.ev,
    deviated: chosen.action !== best.action,
    canSplit: canSplit(playerRanks, options),
  });
}

/** Convert a `blackjackPolicy` decision into a plain wire intent — the shape a transport's
 *  `sendIntent` typically expects (`{ kind: 'blackjack-action', action }`). A transport
 *  adapter is free to remap this; it's provided as the sane default `../runner.mjs` uses when
 *  no `toIntent` override is supplied. */
export function toIntent(decision) {
  return Object.freeze({ kind: 'blackjack-action', action: decision.action });
}
