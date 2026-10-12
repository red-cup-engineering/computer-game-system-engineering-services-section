// Type declarations for @red-cup-engineering/cast/dialogue.

import type { Persona } from './persona.d.ts';
import type { Rng } from './rng.d.ts';

export type Situation =
  | 'sit-down' | 'bet-placed' | 'win-small' | 'win-big' | 'loss' | 'near-miss'
  | 'jackpot-witnessed' | 'chat-idle' | 'farewell';

export const SITUATIONS: readonly Situation[];

export interface UtteranceContext {
  amount?: number | string;
  peerName?: string;
  [slot: string]: unknown;
}

export interface SayOptions {
  seed?: string;
  count?: number;
  context?: UtteranceContext;
}

export function reactionProbability(persona: Persona, situation: Situation): number;
export function shouldSpeak(persona: Persona, situation: Situation, rng: Rng): boolean;
export function say(persona: Persona, situation: Situation, options?: SayOptions): string[];
export function reactTo(persona: Persona, situation: Situation, options?: SayOptions): string | null;
