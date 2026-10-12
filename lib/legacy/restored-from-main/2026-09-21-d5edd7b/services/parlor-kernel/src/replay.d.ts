// Type declarations for @red-cup-engineering/parlor-kernel/replay.

import type { Cartridge, ApplyResult } from '@red-cup-engineering/cartridge/replay';
import type { Intent } from '@red-cup-engineering/cartridge/intent-log';

export {
  defaultReplay,
  hashState,
  createVerifier,
} from '@red-cup-engineering/cartridge/replay';

export {
  appendEntry,
  canonicalStringify,
  encodeIntentLog,
  decodeIntentLog,
  validateIntentLog,
} from '@red-cup-engineering/cartridge/intent-log';

export interface BuildCartridgeOptions<State> {
  readonly serialize?: (state: State) => unknown;
  readonly deserialize?: (data: unknown) => State;
}

export function buildCartridge<State, TIntent extends Intent = Intent>(
  createEngine: (seed: string, configId?: string) => State,
  applyIntent: (state: State, intent: TIntent) => ApplyResult<State>,
  options?: BuildCartridgeOptions<State>,
): Cartridge<State, TIntent>;
