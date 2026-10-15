/**
 * `runner` — the harness that actually drives a persona against a real game: connect, loop
 * (observe -> think -> decide -> act -> send -> react), disconnect. It is the one place in
 * this package that talks to the outside world, and it talks to it only through an injected
 * `Transport` (see `runner.d.ts`) — a game-agnostic four-method interface
 * (`connect`/`observe`/`sendIntent`/`disconnect`) any consumer implements. This package ships
 * no concrete transport of its own (see `./adapters/http-json.mjs` and `./adapters/qwzspace.mjs`
 * for the two reference *contracts*, matching casino-service's bearer-token HTTP shape and
 * qwzspace's `RealtimeClient` shape respectively) — `createRunner` is fully headless-testable
 * today against a hand-written fake transport (`runner.test.mts`'s own `FakeTransport`).
 *
 * ## Determinism
 *
 * Every random draw in a run — think/act pacing jitter, the policy's own rng, dialogue line
 * selection — is derived from one root `seed` via `seededStream` (computer-data randomization), namespaced by a
 * monotonic step counter, so a fixed `(seed, transport script)` pair reproduces byte-identical
 * decisions and lines every run. Wall-clock pacing is the one deliberately NON-deterministic
 * axis by default (`sleep` calls real `setTimeout`) — tests inject a no-op `sleep` to run the
 * exact same logical sequence instantly.
 *
 * ## The event stream
 *
 * `runner.events()` is an async generator of `CastEvent`s (`sit-down`, `action`, `utterance`,
 * `reaction` via the `walk-away`/`farewell` lifecycle events, `error`) — a consumer (a floor UI,
 * a chat pane, a test) drives it with `for await (const event of runner.events())`. Nothing in
 * this package assumes how those events get displayed; they are plain, JSON-serializable data.
 *
 * ## Two decision-shape conventions
 *
 * A policy's decision may optionally carry `action: 'walk-away'` (as `../policy/bankroll.mjs`'s
 * `bankrollPolicy` does) — the runner treats that as a graceful session end (a `walk-away`
 * event, a farewell line, disconnect) rather than sending it to the transport as an intent.
 * Every other decision shape is sent through `toIntent` and on to `transport.sendIntent`
 * unmodified; this is the only decision-shape convention `runner.mjs` itself understands.
 */
import { seededStream } from '@red-cup-engineering/computer-data-engineering-services-section/randomization/stream';
import { reactTo } from './dialogue.mjs';
import { thinkDelayMs, actDelayMs, chatDelayMs } from './runner-pacing.mjs';

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const identity = (x) => x;
const defaultShouldStop = (state) => Boolean(state && (state.ended === true || state.gameOver === true));

/**
 * Build a runner for `persona` against `transport` using `policy`. See `runner.d.ts` for the
 * full `RunnerOptions` shape; every option beyond `persona`, `policy`, `transport`, and `seed`
 * has a sane default so a minimal call site is small.
 */
export function createRunner(options) {
  const {
    persona, policy, transport, seed,
    toIntent = identity,
    classifyReaction = () => null,
    dialogueContext = () => ({}),
    // Null means this game has no casino-style idle bark to manufacture.
    idleSituation = 'chat-idle',
    shouldStop = defaultShouldStop,
    maxSteps = Infinity,
    sleep = defaultSleep,
    now = () => Date.now(),
  } = options;

  if (!persona || typeof persona.id !== 'string') {
    throw new TypeError('createRunner: options.persona (with an id) is required');
  }
  if (typeof policy !== 'function') {
    throw new TypeError('createRunner: options.policy must be a function');
  }
  if (!transport || typeof transport.connect !== 'function') {
    throw new TypeError('createRunner: options.transport must implement the Transport interface');
  }
  if (typeof seed !== 'string' || seed.length === 0) {
    throw new TypeError('createRunner: options.seed must be a non-empty string');
  }

  let stopped = false;
  let started = false;
  const pending = [];

  function notify(situation, context = {}) {
    pending.push({ situation, context });
  }

  function stop() {
    stopped = true;
  }

  async function* events() {
    if (started) {
      throw new Error('createRunner: events() can only be iterated once per runner — create a new runner to run again');
    }
    started = true;

    // A monotonic counter, not the step count, namespaces each utterance's seed: several
    // utterances (a reaction, a drained notification, ambient chat-idle) can occur within the
    // same step, and each still needs its own independent, deterministic sub-stream.
    let utteranceSeq = 0;

    function makeEvent(type, extra = {}) {
      return Object.freeze({ type, step: stepCount, persona: persona.id, tsMs: now(), ...extra });
    }

    async function* emitReaction(situation, context) {
      const lineSeed = `${seed}:utterance:${utteranceSeq}`;
      const delayRng = seededStream(seed, persona.id, 'chat-delay', utteranceSeq);
      utteranceSeq += 1;
      const line = reactTo(persona, situation, { seed: lineSeed, context });
      if (line === null) return;
      await sleep(chatDelayMs(persona, delayRng));
      yield makeEvent('utterance', { situation, text: line, context });
    }

    let stepCount = 0;
    let session;
    try {
      session = await transport.connect(persona);
    } catch (error) {
      yield makeEvent('error', { error: String(error?.message ?? error), phase: 'connect' });
      return;
    }

    yield makeEvent('sit-down', {});
    yield* emitReaction('sit-down', {});

    try {
      while (!stopped && stepCount < maxSteps) {
        while (pending.length > 0) {
          const { situation, context } = pending.shift();
          yield* emitReaction(situation, context);
        }

        let gameState;
        try {
          gameState = await transport.observe(session);
        } catch (error) {
          yield makeEvent('error', { error: String(error?.message ?? error), phase: 'observe' });
          break;
        }

        if (shouldStop(gameState)) break;

        await sleep(thinkDelayMs(persona, seededStream(seed, persona.id, 'think', stepCount)));

        const decisionRng = seededStream(seed, persona.id, 'decision', stepCount);
        const decision = policy(gameState, persona, decisionRng);

        if (decision && decision.action === 'walk-away') {
          yield makeEvent('walk-away', { reason: decision.reason ?? null, decision });
          break;
        }

        await sleep(actDelayMs(persona, seededStream(seed, persona.id, 'act', stepCount)));

        const intent = toIntent(decision);
        let result;
        try {
          result = await transport.sendIntent(session, intent);
        } catch (error) {
          yield makeEvent('error', { error: String(error?.message ?? error), phase: 'sendIntent' });
          break;
        }

        yield makeEvent('action', { intent, decision, result });

        const situation = classifyReaction(decision, result, gameState);
        if (situation !== null && situation !== undefined) {
          yield* emitReaction(situation, dialogueContext(decision, result, gameState));
        } else if (idleSituation !== null) {
          yield* emitReaction(idleSituation, {});
        }

        stepCount += 1;
      }
    } finally {
      try {
        await transport.disconnect(session);
      } catch {
        // Disconnect failures don't change the outcome of the run already completed; a
        // consumer wanting to know still sees every prior event, which is the honest record.
      }
      yield* emitReaction('farewell', {});
      yield makeEvent('farewell', {});
    }
  }

  return Object.freeze({ events, stop, notify });
}
