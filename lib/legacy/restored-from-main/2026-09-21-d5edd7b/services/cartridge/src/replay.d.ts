// Type declarations for @561-group/cartridge/replay.

import type { GameEvent, Intent, IntentLog } from './intent-log.d.ts';

export interface ApplyResult<State> {
  readonly state: State;
  readonly events: readonly GameEvent[];
}

/** The contract every cartridge module implements, generic over the game's own `State` and
 *  `Intent` types. */
export interface Cartridge<State, TIntent extends Intent = Intent> {
  /** Pure function of (seed, configId): identical arguments must produce byte-identical
   *  state on every call. */
  createEngine(seed: string, configId?: string): State;

  /** Pure. Must never mutate `state`. Returns a fresh state plus the events that
   *  transition produced. */
  applyIntent(state: State, intent: TIntent): ApplyResult<State>;

  /** Derived: rebuilds state from nothing but (seed, intents) by calling `createEngine`
   *  once and `applyIntent` per entry, in order. Most implementers should just delegate to
   *  `defaultReplay` from this module rather than reimplementing this loop. */
  replay(seed: string, intents: readonly TIntent[], configId?: string): ReplayResult<State>;

  /** Round-trips state to/from a JSON-safe form. Must satisfy
   *  `deserialize(serialize(s))` deep-equals `s`. */
  serialize(state: State): unknown;
  deserialize(data: unknown): State;
}

export interface ReplayResult<State> {
  readonly finalState: State;
  readonly valid: boolean;
  readonly events: readonly GameEvent[];
  /** A stable hex digest of `finalState`'s canonical JSON form. */
  readonly stateHash: string;
}

export function hashState(value: unknown): string;

export function defaultReplay<State, TIntent extends Intent>(
  cartridge: Pick<Cartridge<State, TIntent>, 'createEngine' | 'applyIntent'>,
  seed: string,
  intents: readonly TIntent[],
  configId?: string,
): ReplayResult<State>;

export interface VerifyResult<State> {
  readonly valid: boolean;
  readonly finalState: State;
  readonly events: readonly GameEvent[];
  readonly stateHash: string;
}

export type Verify<State, TIntent extends Intent = Intent> = (
  seed: string,
  configId: string | undefined,
  intents: IntentLog<TIntent>,
) => VerifyResult<State>;

export function createVerifier<State, TIntent extends Intent>(
  cartridge: Pick<Cartridge<State, TIntent>, 'createEngine' | 'applyIntent'>,
): Verify<State, TIntent>;
