// Type declarations for @red-cup-engineering/cast/policy/slots.

import type { Persona } from '../persona.d.ts';
import type { Rng } from '../rng.d.ts';
import type { Situation } from '../dialogue.d.ts';

export interface SlotsState {
  chips: number;
  betOptions?: readonly number[];
  tableMinBet?: number;
  tableMaxBet?: number;
  recentOutcomes?: readonly ('win' | 'loss' | 'jackpot')[];
}

export interface SlotsDecision {
  action: 'spin';
  bet: number;
}

export interface SpinResult {
  payout: number;
  bet: number;
  jackpot?: boolean;
  nearMiss?: boolean;
}

export function chooseBet(state: SlotsState, persona: Persona, rng: Rng): number;
export function classifySpinOutcome(result: SpinResult): Situation | null;
export function slotsPolicy(state: SlotsState, persona: Persona, rng: Rng): SlotsDecision;
export function toIntent(decision: SlotsDecision): Readonly<{ kind: 'slot-spin'; bet: number }>;
