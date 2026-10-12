// Type declarations for @red-cup-engineering/cast/adapters/http-json.

import type { Persona } from '../persona.d.ts';
import type { CastSession, Transport } from '../runner.d.ts';

export interface HttpRequestSpec {
  path: string;
  method?: string;
  body?: unknown;
}

export interface HttpJsonAdapterConfig {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  buildSessionRequest?: (persona: Persona) => HttpRequestSpec;
  buildObserveRequest?: (session: CastSession) => HttpRequestSpec;
  buildIntentRequest?: (session: CastSession, intent: Record<string, unknown>) => HttpRequestSpec;
  buildDisconnectRequest?: ((session: CastSession) => HttpRequestSpec) | null;
  extractSession?: (responseBody: unknown) => CastSession;
  authHeaderName?: string;
  authHeaderValue?: (session: CastSession) => string;
}

export function createHttpJsonAdapter(config: HttpJsonAdapterConfig): Transport;
