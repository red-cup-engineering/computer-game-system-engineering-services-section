// Type declarations for @red-cup-engineering/cast's internal personas/roster module
// (re-exported publicly from ../persona.d.ts — this file is not itself part of the package's
// exports map).

import type { Persona } from '../persona.d.ts';

export const AUTHORED_PERSONAS: readonly Persona[];
export function getAuthoredPersona(id: string): Persona | null;
export function listAuthoredPersonaIds(): string[];
