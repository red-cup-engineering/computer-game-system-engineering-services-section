import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createPresenceLog,
  appendPresenceEvent,
  encodePlayRecord,
  decodePlayRecord,
  validatePlayRecord,
  PRESENCE_EVENT_KINDS,
} from "../src/log.mjs";

test("appendPresenceEvent produces cartridge-shaped, monotonic-seq entries", () => {
  let log = createPresenceLog();
  log = appendPresenceEvent(log, PRESENCE_EVENT_KINDS.CONNECT, { key: "g1:a" });
  log = appendPresenceEvent(log, PRESENCE_EVENT_KINDS.SUBSCRIBE, { key: "g1:a", channelName: "lobby" });
  assert.equal(log.length, 2);
  assert.equal(log[0].seq, 0);
  assert.equal(log[1].seq, 1);
  assert.equal(log[0].intent.kind, PRESENCE_EVENT_KINDS.CONNECT);
  assert.equal(log[1].intent.channelName, "lobby");
});

test("appendPresenceEvent is pure — never mutates the log it was handed", () => {
  const log = createPresenceLog();
  const next = appendPresenceEvent(log, PRESENCE_EVENT_KINDS.CONNECT, { key: "g1:a" });
  assert.equal(log.length, 0);
  assert.equal(next.length, 1);
});

test("a presence log round-trips through cartridge's own encode/decode/validate", () => {
  let log = createPresenceLog();
  log = appendPresenceEvent(log, PRESENCE_EVENT_KINDS.CONNECT, { key: "g1:a", gameId: "g1", playerId: "a" });
  log = appendPresenceEvent(log, PRESENCE_EVENT_KINDS.TELL, { fromGameId: "g1", toGameId: "g2", body: "hi" });
  const encoded = encodePlayRecord(log);
  const decoded = decodePlayRecord(encoded);
  assert.deepEqual(decoded, log);
  assert.equal(validatePlayRecord(decoded).valid, true);
});

test("appendPresenceEvent rejects an empty kind (cartridge's own isMove guard)", () => {
  assert.throws(() => appendPresenceEvent(createPresenceLog(), "", {}), TypeError);
});
