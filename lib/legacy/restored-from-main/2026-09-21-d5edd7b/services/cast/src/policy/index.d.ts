// Type declarations for @red-cup-engineering/cast/policy (the barrel covers every policy subpath).

import type { Persona } from '../persona.d.ts';
import type { Rng } from '../rng.d.ts';

/** The shape every game's policy function takes — see this module's own header for the full
 *  contract new games are expected to follow. */
export type Policy<TState, TDecision> = (state: TState, persona: Persona, rng: Rng) => TDecision;

export {
  blackjackPolicy, deviationProbability, trailingLossStreak,
  type BlackjackAction, type BlackjackOutcome, type BlackjackGameState, type BlackjackDecision,
} from './blackjack.d.ts';
export { toIntent as blackjackToIntent } from './blackjack.d.ts';

export * from './bankroll.d.ts';

export {
  slotsPolicy, chooseBet, classifySpinOutcome,
  type SlotsState, type SlotsDecision, type SpinResult,
} from './slots.d.ts';
export { toIntent as slotsToIntent } from './slots.d.ts';

export * from './wander.d.ts';
