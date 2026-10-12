// Type declarations for @red-cup-engineering/cast/policy/bankroll.

import type { Persona } from '../persona.d.ts';
import type { Rng } from '../rng.d.ts';

export type SessionOutcome = 'win' | 'loss' | 'push' | 'jackpot';

export interface BankrollState {
  seated?: boolean;
  chips: number;
  startingChips: number;
  tableMinBet: number;
  tableMaxBet: number;
  handsPlayed: number;
  recentOutcomes?: readonly SessionOutcome[];
}

export type WalkAwayReason = 'bankroll-low' | 'bankroll-target' | 'session-length';

export type BankrollDecision =
  | { action: 'sit'; buyIn: number }
  | { action: 'bet'; amount: number }
  | { action: 'walk-away'; reason: WalkAwayReason };

export function buyInAmount(state: BankrollState, persona: Persona): number;
export function betSize(state: BankrollState, persona: Persona, rng: Rng): number;
export function sessionLengthTarget(persona: Persona, rng: Rng): number;
export function walkAwayReason(state: BankrollState, persona: Persona, rng: Rng): WalkAwayReason | null;
export function bankrollPolicy(state: BankrollState, persona: Persona, rng: Rng): BankrollDecision;
