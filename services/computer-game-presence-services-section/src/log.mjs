/**
 * log.mjs — the presence/chat event log, built directly on @red-cup-engineering/gaming/running's
 * intent-log discipline: cartridge's `appendMove` already enforces the append-only, monotonic-
 * seq, kind-enveloped shape (`{seq, intent: {kind, ...}, ts}`) that this package's differentiator
 * ("every presence/chat event lands in an append-only log replayable per the cartridge/intent-log
 * discipline") calls for. This module adds nothing to that shape — it only names the vocabulary
 * of `kind`s a presence/chat log actually contains, so a consumer decoding one of these logs with
 * plain cartridge tooling (`decodePlayRecord`/`validatePlayRecord`) sees recognizable event kinds.
 *
 * NOTE ON NAMING: qwzspace also ships a module called `intent-log.mjs`, but that one is
 * tick-bound (records carry `{tick, seq, actorId, kind, args}` and are hashed per-room-tick via
 * `@red-cup-engineering/event-stream-data-service`). Presence/chat events are not tick-quantized,
 * so this package builds on cartridge's plain, tick-agnostic log instead — see the section's
 * census notes for why qwzspace's own intent-log was deliberately not reused here.
 */

import { appendMove, isMove, encodePlayRecord, decodePlayRecord, validatePlayRecord } from "@red-cup-engineering/gaming/running/play-record";
import { canonicalJson } from "@red-cup-engineering/json-services-section/canonical-json";

export const PRESENCE_EVENT_KINDS = Object.freeze({
  CONNECT: "presence.connect",
  DISCONNECT: "presence.disconnect",
  SUBSCRIBE: "channel.subscribe",
  UNSUBSCRIBE: "channel.unsubscribe",
  BROADCAST: "channel.broadcast",
  TELL: "tell.send",
});

/**
 * @returns {Array<object>} a fresh, empty cartridge-shaped presence/chat log.
 */
export function createPresenceLog() {
  return [];
}

/**
 * @param {Array<object>} log a cartridge-shaped log (as returned by createPresenceLog/appendPresenceEvent).
 * @param {string} kind one of PRESENCE_EVENT_KINDS.
 * @param {object} payload JSON-serializable event data; a `kind` key in payload is shadowed —
 *   the event's own kind always wins, so a caller logging e.g. a session's "human"/"agent" kind
 *   in the same payload cannot silently overwrite the event kind.
 * @param {{seq?: number, ts?: number}} [options]
 * @returns {Array<object>} a NEW log with the event appended (cartridge's appendMove is pure).
 * @throws {TypeError} if kind is not a non-empty string, via cartridge's own isMove check.
 */
export function appendPresenceEvent(log, kind, payload = {}, options) {
  const intent = { ...payload, kind };
  if (!isMove(intent)) throw new TypeError("appendPresenceEvent: kind must be a non-empty string");
  return appendMove(log, intent, options);
}

export { encodePlayRecord, decodePlayRecord, validatePlayRecord, canonicalJson };
