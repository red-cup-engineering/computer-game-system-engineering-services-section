// Type declarations for @red-cup-engineering/cast/adapters/qwzspace.
//
// `QwzspaceLikeClient` deliberately duck-types qwzspace's own `RealtimeClient`
// (`@red-cup-engineering/qwzspace/client.d.ts`) rather than importing it — this package has no
// dependency on qwzspace (see this module's own header).

import type { Persona } from '../persona.d.ts';
import type { CastSession, Transport } from '../runner.d.ts';

export interface QwzspaceLikeView {
  me(): Record<string, unknown> | undefined;
  entities(): Record<string, unknown>[];
  tick(): number;
  [key: string]: unknown;
}

export interface QwzspaceLikeClient {
  view: QwzspaceLikeView;
  sendIntent(kind: string, args?: Record<string, unknown>): void;
  close(): void;
  [key: string]: unknown;
}

export interface QwzspaceAdapterConfig {
  client: QwzspaceLikeClient;
  extractState?: (view: QwzspaceLikeView) => unknown;
  toWireIntent?: (intent: Record<string, unknown>) => { kind: string; [arg: string]: unknown };
}

export function createQwzspaceAdapter(config: QwzspaceAdapterConfig): Transport;
