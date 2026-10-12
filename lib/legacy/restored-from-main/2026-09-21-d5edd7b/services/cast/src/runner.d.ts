// Type declarations for @red-cup-engineering/cast/runner.

import type { Persona } from './persona.d.ts';
import type { Rng } from './rng.d.ts';
import type { Situation, UtteranceContext } from './dialogue.d.ts';

/** Whatever an adapter needs to remember between calls — a bearer token, a socket, a table id.
 *  Opaque to the runner; only the transport implementation reads it. */
export type CastSession = Record<string, unknown>;

export interface IntentResult {
  ok?: boolean;
  [key: string]: unknown;
}

/**
 * The one contract `runner.mjs` depends on. Any of the four methods may return a plain value
 * or a `Promise` — the runner always `await`s. See `./adapters/http-json.d.ts` and
 * `./adapters/qwzspace.d.ts` for the two reference contracts this package ships.
 */
export interface Transport<TState = unknown> {
  connect(persona: Persona): Promise<CastSession> | CastSession;
  observe(session: CastSession): Promise<TState> | TState;
  sendIntent(session: CastSession, intent: Record<string, unknown>): Promise<IntentResult> | IntentResult;
  disconnect(session: CastSession): Promise<void> | void;
}

export type CastEventType = 'sit-down' | 'action' | 'utterance' | 'walk-away' | 'farewell' | 'error';

export interface CastEvent {
  type: CastEventType;
  step: number;
  persona: string;
  tsMs: number;
  [extra: string]: unknown;
}

export interface RunnerOptions<TState = unknown, TDecision = unknown> {
  persona: Persona;
  /** A pure `(state, persona, rng) => decision` function — see `./policy/index.d.ts`'s `Policy`. */
  policy: (state: TState, persona: Persona, rng: Rng) => TDecision;
  transport: Transport<TState>;
  /** Root determinism seed for this persona's run; every rng draw and dialogue line derives
   *  from this via `./rng.mjs#makeSubRng`. */
  seed: string;
  /** Decision -> wire intent. Defaults to the identity function (the decision IS the intent). */
  toIntent?: (decision: TDecision) => Record<string, unknown>;
  /** Classify what just happened into a dialogue situation, or null/undefined for none —
   *  triggers a reaction utterance instead of the default ambient chat-idle roll. */
  classifyReaction?: (decision: TDecision, result: IntentResult, state: TState) => Situation | null | undefined;
  /** Slot-fill context for the reaction utterance (amount, peerName, ...). */
  dialogueContext?: (decision: TDecision, result: IntentResult, state: TState) => UtteranceContext;
  /** Whether to stop the loop given the freshly observed state (before deciding). Defaults to
   *  checking `state.ended === true || state.gameOver === true`. */
  shouldStop?: (state: TState) => boolean;
  maxSteps?: number;
  /** Injectable delay function — defaults to a real `setTimeout`-backed sleep; tests pass a
   *  no-op to run the same logical sequence instantly. */
  sleep?: (ms: number) => Promise<void>;
  /** Injectable clock for event timestamps — defaults to `Date.now`. */
  now?: () => number;
}

export interface Runner {
  /** An async generator of `CastEvent`s — iterate exactly once per runner instance. */
  events(): AsyncGenerator<CastEvent, void, void>;
  /** Request the loop stop before its next iteration (cooperative — a step already in
   *  progress still completes). */
  stop(): void;
  /** Queue an externally-observed situation (e.g. a floor-wide jackpot broadcast) to be
   *  reacted to at the top of the next loop iteration. */
  notify(situation: Situation, context?: UtteranceContext): void;
}

export function createRunner<TState = unknown, TDecision = unknown>(
  options: RunnerOptions<TState, TDecision>,
): Runner;
