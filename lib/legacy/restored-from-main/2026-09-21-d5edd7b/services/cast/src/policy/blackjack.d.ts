// Type declarations for @red-cup-engineering/cast/policy/blackjack.

import type { Rank, Composition, DealerOptions, CanSplitOptions, HandEVResult } from '@red-cup-engineering/card-table/blackjack';
import type { Persona } from '../persona.d.ts';
import type { Rng } from '../rng.d.ts';

export type BlackjackAction = 'stand' | 'hit' | 'double' | 'split';
export type BlackjackOutcome = 'win' | 'loss' | 'push' | 'blackjack';

export interface BlackjackGameState {
  playerRanks: readonly Rank[];
  upcardRank: Rank;
  composition: Composition;
  options?: DealerOptions & CanSplitOptions;
  recentOutcomes?: readonly BlackjackOutcome[];
}

export interface BlackjackDecision {
  action: BlackjackAction;
  ev: HandEVResult;
  bestAction: BlackjackAction;
  bestEV: number;
  chosenEV: number;
  /** bestEV - chosenEV; always >= 0; 0 exactly when `deviated` is false. */
  deviationCost: number;
  deviated: boolean;
  canSplit: boolean;
}

export function trailingLossStreak(recentOutcomes?: readonly BlackjackOutcome[]): number;
export function deviationProbability(persona: Persona, recentOutcomes?: readonly BlackjackOutcome[]): number;
export function blackjackPolicy(state: BlackjackGameState, persona: Persona, rng: Rng): BlackjackDecision;
export function toIntent(decision: BlackjackDecision): Readonly<{ kind: 'blackjack-action'; action: BlackjackAction }>;
