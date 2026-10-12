// Type declarations for @red-cup-engineering/cast/policy/wander.

import type { AddressedLine, TelnetGameState } from '../adapters/telnet.d.ts';
import type { Persona } from '../persona.d.ts';
import type { Rng } from '../rng.d.ts';

export interface WanderDecision {
  action: 'go' | 'say' | 'look';
  direction?: string;
  message?: string;
  respondingTo?: AddressedLine;
}

export function wanderPolicy(gameState: TelnetGameState, persona: Persona, rng: Rng): WanderDecision;
