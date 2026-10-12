// Type declarations for @561-group/cartridge/fixtures/toy-engine.

import type { Cartridge, ApplyResult, ReplayResult } from '../replay.d.ts';
import type { Intent, GameEvent } from '../intent-log.d.ts';

export interface StonePileState {
  readonly name: string;
  readonly stones: number;
  readonly turn: number;
}

export type StonePileIntent =
  | (Intent & { readonly kind: 'add'; readonly amount: number })
  | (Intent & { readonly kind: 'remove'; readonly amount: number })
  | (Intent & { readonly kind: 'rename'; readonly name: string });

export function createEngine(seed: string, configId?: string): StonePileState;
export function applyIntent(state: StonePileState, intent: StonePileIntent): ApplyResult<StonePileState>;
export function replay(
  seed: string,
  intents: readonly StonePileIntent[],
  configId?: string,
): ReplayResult<StonePileState>;
export function serialize(state: StonePileState): unknown;
export function deserialize(data: unknown): StonePileState;

export const stonePileCartridge: Cartridge<StonePileState, StonePileIntent>;

// Re-exported for consumers importing bare GameEvent-shaped values from this fixture.
export type { GameEvent };
