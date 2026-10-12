// Type declarations for @red-cup-engineering/parlor-kernel/fixtures/pig-fixture.

import type { Cartridge, ApplyResult } from '@red-cup-engineering/cartridge/replay';
import type { Intent } from '@red-cup-engineering/cartridge/intent-log';
import type { TurnState } from '../turns.d.ts';

export const GAME_ID: string;

export interface PigFixtureData {
  readonly scores: Record<string, number>;
  readonly turnTotal: number;
  readonly rollCount: number;
}

export interface PigFixtureState {
  readonly seed: string;
  readonly turn: TurnState<PigFixtureData>;
}

export type PigFixtureIntent =
  | ({ readonly kind: 'roll' } & Intent)
  | ({ readonly kind: 'bank' } & Intent);

export function createEngine(seed: string, configId?: string): PigFixtureState;
export function applyIntent(
  state: PigFixtureState,
  intent: PigFixtureIntent,
): ApplyResult<PigFixtureState>;

export const pigCartridge: Cartridge<PigFixtureState, PigFixtureIntent>;
