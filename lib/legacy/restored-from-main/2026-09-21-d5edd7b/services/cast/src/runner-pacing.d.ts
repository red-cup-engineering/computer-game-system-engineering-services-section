// Type declarations for @red-cup-engineering/cast/runner-pacing.

import type { Persona } from './persona.d.ts';
import type { Rng } from './rng.d.ts';

export function thinkDelayMs(persona: Persona, rng: Rng): number;
export function actDelayMs(persona: Persona, rng: Rng): number;
export function chatDelayMs(persona: Persona, rng: Rng): number;
