// Type declarations for @red-cup-engineering/cast/persona.

/** A small parameter vector, each dimension in [0, 1]. */
export interface Temperament {
  /** 0 = plays it as safe as the math allows; 1 = happily accepts negative-EV variance. */
  riskTolerance: number;
  /** 0 = near-silent; 1 = narrates constantly. */
  chattiness: number;
  /** 0 = a loss streak changes nothing; 1 = chases hard after losses. */
  tiltProneness: number;
  /** 0 = a deadpan win; 1 = fireworks. */
  exuberance: number;
  /** 0 = fast, erratic think/act timing; 1 = slow, steady timing. */
  patience: number;
}

export interface AvatarSpec {
  /** A qwzspace `drawables` registry name (e.g. 'disc', 'ring', 'gem') — never an image path. */
  drawable: string;
  params?: Record<string, unknown>;
  tint?: string;
}

export interface Persona {
  id: string;
  name: string;
  tagline: string;
  pronouns: string;
  /** Keys `./dialogue.mjs`'s generic template bank by archetype. */
  voiceTag: string;
  temperament: Temperament;
  avatar: AvatarSpec;
  /** Present on generated personas; absent (or the authoring source) on authored ones. */
  seed?: string;
  /** Authored-only: per-situation extra line variants layered over the generic voiceTag bank. */
  lines?: Readonly<Record<string, readonly string[]>>;
}

export const NEUTRAL_TEMPERAMENT: Readonly<Temperament>;
export const AUTHORED_PERSONAS: readonly Persona[];

export function assertValidTemperament(temperament: Temperament): true;
export function generatePersona(seed: string, options?: { idPrefix?: string }): Persona;
export function getAuthoredPersona(id: string): Persona | null;
export function getPersona(id: string): Persona | null;
export function listAuthoredPersonaIds(): string[];
export function isNeutralTemperament(temperament: Temperament): boolean;
export function clampTemperamentValue(value: number): number;
