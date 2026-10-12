/**
 * `policy/slots` — the cast's slot-machine policy. Slots have no strategic decision space (a
 * spin has one legal move: spin, at some bet size), so this module's whole job is play
 * *cadence* — how a persona sizes and paces its spins — plus a reaction-classification hook so
 * `../dialogue.mjs` can react to what just happened (`near-miss`, `jackpot-witnessed`, etc.)
 * without the runner needing any slots-specific knowledge of its own. Session-level questions
 * (buy-in, when to walk away) are deliberately NOT re-implemented here — see
 * `./bankroll.mjs`'s own header for why that's one generic module shared by every game.
 */
import { betSize } from './bankroll.mjs';

const clamp01 = (n) => Math.max(0, Math.min(1, n));

/**
 * Pick the bet denomination for the next spin from `state.betOptions` (ascending) — a cautious
 * persona spins at the lowest denomination available; a high-roller reaches for the top one;
 * everyone else lands proportionally in between by `riskTolerance`. Falls back to
 * `./bankroll.mjs`'s continuous `betSize` clamped to the nearest available option when
 * `betOptions` isn't supplied, so a machine with open bet sizing works too.
 */
export function chooseBet(state, persona, rng) {
  const { betOptions, chips } = state;
  if (!Array.isArray(betOptions) || betOptions.length === 0) {
    return betSize({ ...state, tableMinBet: 1, tableMaxBet: chips }, persona, rng);
  }
  const riskTolerance = clamp01(persona.temperament?.riskTolerance ?? 0.5);
  const sorted = [...betOptions].sort((a, b) => a - b);
  const affordable = sorted.filter((amount) => amount <= chips);
  const pool = affordable.length > 0 ? affordable : [sorted[0]];
  const index = Math.min(pool.length - 1, Math.floor(riskTolerance * pool.length));
  return pool[index];
}

/**
 * Classify a finished spin's result into a dialogue situation, or `null` for an ordinary
 * unremarkable loss that doesn't warrant a line (the runner still tracks it for bankroll
 * purposes; it just doesn't feed `../dialogue.mjs`). `payout` and `bet` are in the same unit;
 * `nearMiss` is a caller-supplied flag (the machine, not this policy, knows whether the reels
 * landed one symbol short — this module only maps that fact onto a situation name).
 */
export function classifySpinOutcome({ payout, bet, jackpot = false, nearMiss = false }) {
  if (jackpot) return 'win-big';
  if (payout <= 0) return nearMiss ? 'near-miss' : null;
  const multiple = bet > 0 ? payout / bet : payout;
  return multiple >= 10 ? 'win-big' : 'win-small';
}

/**
 * The full per-spin decision: `{ action: 'spin', bet }` sized per `chooseBet`. Session-level
 * exits (cash out, walk away) are the caller's responsibility via `./bankroll.mjs`'s
 * `bankrollPolicy` — composing the two is what a runner does; this module stays a pure
 * per-spin cadence function so it slots into `../policy/index.mjs`'s common `Policy` shape.
 */
export function slotsPolicy(state, persona, rng) {
  return Object.freeze({ action: 'spin', bet: chooseBet(state, persona, rng) });
}

/** Convert a `slotsPolicy` decision into a plain wire intent. */
export function toIntent(decision) {
  return Object.freeze({ kind: 'slot-spin', bet: decision.bet });
}
