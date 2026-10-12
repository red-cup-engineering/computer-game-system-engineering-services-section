/**
 * `policy/bankroll` — the generic, game-agnostic session policy: how much a persona buys in
 * for, how it sizes a bet against its own temperament and recent results, and when it walks
 * away. Every game-specific policy (`./blackjack.mjs`, `./slots.mjs`) decides *what to do on
 * this turn*; this module decides *whether there should be a next turn at all* and *how much
 * is at stake on it* — the two concerns any table or machine shares regardless of what game
 * sits on top, which is why this lives here rather than duplicated per game.
 */
const clamp01 = (n) => Math.max(0, Math.min(1, n));

/** Buy-in sizing: a cautious persona (low riskTolerance) buys in near the table minimum; a
 *  high-roller buys in toward several multiples of it. `tableMinBet` anchors the scale so this
 *  works identically at a $1 table and a $500 table. */
export function buyInAmount(state, persona) {
  const riskTolerance = clamp01(persona.temperament?.riskTolerance ?? 0.5);
  const minBuyIn = state.tableMinBet * 20;
  const maxBuyIn = state.tableMinBet * 100;
  return Math.round(minBuyIn + riskTolerance * (maxBuyIn - minBuyIn));
}

/**
 * Bet sizing for the next round: a base proportional to `riskTolerance` between
 * `tableMinBet` and `tableMaxBet`, then bumped up by a tilt-chasing persona after a trailing
 * loss streak (never past `tableMaxBet`, never past `chips` on hand). A small seeded jitter
 * keeps repeated bets from looking robotically identical.
 */
export function betSize(state, persona, rng) {
  const { chips, tableMinBet, tableMaxBet, recentOutcomes = [] } = state;
  const riskTolerance = clamp01(persona.temperament?.riskTolerance ?? 0.5);
  const tiltProneness = clamp01(persona.temperament?.tiltProneness ?? 0);
  const base = tableMinBet + riskTolerance * (tableMaxBet - tableMinBet);

  let lossStreak = 0;
  for (let i = recentOutcomes.length - 1; i >= 0; i--) {
    if (recentOutcomes[i] !== 'loss') break;
    lossStreak += 1;
  }
  const chaseMultiplier = 1 + tiltProneness * Math.min(1, lossStreak / 3);

  const jitter = 1 + (rng.next() - 0.5) * 0.1; // +/- 5%
  const raw = base * chaseMultiplier * jitter;
  const bounded = Math.max(tableMinBet, Math.min(tableMaxBet, raw));
  return Math.max(tableMinBet, Math.min(chips, Math.round(bounded)));
}

/** How many hands/spins a persona is willing to play in one sitting before patience runs out
 *  — a low-patience persona (impulsive) sits for a short session; a high-patience one settles
 *  in for a long one. Returns a seeded-jittered integer so a whole cast of the same voiceTag
 *  doesn't all leave on the exact same hand. */
export function sessionLengthTarget(persona, rng) {
  const patience = clamp01(persona.temperament?.patience ?? 0.5);
  const base = 15 + patience * 60; // 15..75 hands, roughly
  const jitter = rng.int(-5, 5);
  return Math.max(3, Math.round(base + jitter));
}

/**
 * Whether `persona` walks away right now, and why. Checked in priority order: can't cover the
 * table minimum; hit a profit target (scaled down for a cautious persona — it locks in gains
 * sooner — and up for a high-roller, who plays through a win); reached its own session-length
 * target for this sitting. Returns `null` when none apply (keep playing).
 */
export function walkAwayReason(state, persona, rng) {
  const { chips, startingChips, tableMinBet, handsPlayed } = state;
  if (chips < tableMinBet) return 'bankroll-low';

  const riskTolerance = clamp01(persona.temperament?.riskTolerance ?? 0.5);
  // A cautious persona locks in at a modest multiple of its buy-in; a bold one holds out for more.
  const profitTargetMultiplier = 1.3 + riskTolerance * 1.2; // 1.3x .. 2.5x
  if (startingChips > 0 && chips >= startingChips * profitTargetMultiplier) return 'bankroll-target';

  const target = sessionLengthTarget(persona, rng);
  if (handsPlayed >= target) return 'session-length';

  return null;
}

/**
 * The full session decision for one turn: `{ action: 'sit', buyIn }` when not yet seated
 * (`state.seated === false`), `{ action: 'walk-away', reason }` when a walk-away condition
 * fires, otherwise `{ action: 'bet', amount }` sized for the next round.
 */
export function bankrollPolicy(state, persona, rng) {
  if (state.seated === false) {
    return Object.freeze({ action: 'sit', buyIn: buyInAmount(state, persona) });
  }
  const reason = walkAwayReason(state, persona, rng);
  if (reason !== null) {
    return Object.freeze({ action: 'walk-away', reason });
  }
  return Object.freeze({ action: 'bet', amount: betSize(state, persona, rng) });
}
