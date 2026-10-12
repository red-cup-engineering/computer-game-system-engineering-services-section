// prove-integration.mjs — the walking-skeleton integration test: two simulated game clients
// (one human, one agent — house differentiator: agent players are first-class, never a special
// case) connect from DIFFERENT games, one broadcasts to a shared channel, the other receives; a
// tell crosses the game boundary; the who-list reflects both games; and the resulting log is a
// valid, replayable cartridge intent log.
import { test } from "node:test";
import assert from "node:assert/strict";

import { createPresenceDirectory } from "../src/presence-directory.mjs";
import { connectPlayer } from "../scripts/connect-player.mjs";
import { disconnectPlayer } from "../scripts/disconnect-player.mjs";
import { subscribeToChannel } from "../scripts/subscribe-to-channel.mjs";
import { broadcastToChannel } from "../scripts/broadcast-to-channel.mjs";
import { sendTell } from "../scripts/send-tell.mjs";
import { listPresentPlayers } from "../scripts/list-present-players.mjs";
import { encodePlayRecord, decodePlayRecord, validatePlayRecord } from "../src/log.mjs";

// createSimulatedClient — the minimal duck-typed transport a presence directory requires
// (send(obj):bool). No qwzspace RealtimeClient, no socket, no browser: this is exactly the shape
// an in-process game client, a test double, or (per cast's own Transport convention) an agent
// player's adapter all satisfy identically.
function createSimulatedClient() {
  const received = [];
  return {
    received,
    send(obj) {
      received.push(obj);
      return true;
    },
  };
}

test("two cross-game clients: connect, channel broadcast, cross-game tell, who-list, disconnect", () => {
  const directory = createPresenceDirectory();

  const clientA = createSimulatedClient(); // a human player, in "arnold"
  const clientB = createSimulatedClient(); // an agent player, in "daleske" — first-class, not a special case

  const { key: keyA } = connectPlayer(directory, {
    gameId: "arnold",
    playerId: "alice",
    displayName: "Alice",
    kind: "human",
    client: clientA,
  });
  const { key: keyB } = connectPlayer(directory, {
    gameId: "daleske",
    playerId: "bot-1",
    displayName: "Cast NPC",
    kind: "agent",
    client: clientB,
  });

  assert.equal(keyA, "arnold:alice");
  assert.equal(keyB, "daleske:bot-1");

  subscribeToChannel(directory, keyA, "global-lobby");
  subscribeToChannel(directory, keyB, "global-lobby");

  // one broadcasts, the other receives
  const { delivered } = broadcastToChannel(directory, "global-lobby", keyA, { text: "hello from arnold" });
  assert.equal(delivered, 1); // everyone but the broadcaster
  assert.equal(clientA.received.length, 0);
  assert.equal(clientB.received.length, 1);
  assert.equal(clientB.received[0].type, "channel.message");
  assert.equal(clientB.received[0].message.text, "hello from arnold");

  // a tell crosses games (daleske -> arnold)
  const { delivered: tellDelivered, tell } = sendTell(directory, keyB, keyA, "gg wp");
  assert.equal(tellDelivered, true);
  assert.equal(tell.fromGameId, "daleske");
  assert.equal(tell.toGameId, "arnold");
  const tellReceived = clientA.received.find((m) => m.type === "tell");
  assert.ok(tellReceived);
  assert.equal(tellReceived.body, "gg wp");

  // who-list reflects both games
  const everyone = listPresentPlayers(directory);
  assert.equal(everyone.length, 2);
  assert.deepEqual(
    everyone.map((s) => s.gameId).sort(),
    ["arnold", "daleske"],
  );
  assert.deepEqual(listPresentPlayers(directory, "arnold").map((s) => s.playerId), ["alice"]);
  assert.deepEqual(listPresentPlayers(directory, "daleske").map((s) => s.playerId), ["bot-1"]);

  // disconnect drops the session and its channel membership; a later broadcast no longer reaches it
  const removed = disconnectPlayer(directory, keyA);
  assert.equal(removed.playerId, "alice");
  assert.equal(listPresentPlayers(directory).length, 1);
  assert.deepEqual(directory.channels()["global-lobby"], [keyB]);

  // the whole run is a valid, replayable cartridge intent log
  const log = directory.log();
  const kinds = log.map((entry) => entry.intent.kind);
  assert.deepEqual(kinds, [
    "presence.connect",
    "presence.connect",
    "channel.subscribe",
    "channel.subscribe",
    "channel.broadcast",
    "tell.send",
    "presence.disconnect",
  ]);
  const encoded = encodePlayRecord(log);
  assert.deepEqual(decodePlayRecord(encoded), log);
  assert.equal(validatePlayRecord(log).valid, true);
});

test("disconnectPlayer on an unknown key is a no-op, not a throw", () => {
  const directory = createPresenceDirectory();
  assert.equal(disconnectPlayer(directory, "no-such-game:no-such-player"), null);
});

test("sendTell rejects a tell from or to a session that never connected", () => {
  const directory = createPresenceDirectory();
  const client = createSimulatedClient();
  const { key } = connectPlayer(directory, { gameId: "g", playerId: "p", client });
  assert.throws(() => sendTell(directory, key, "g:ghost", "hi"), RangeError);
  assert.throws(() => sendTell(directory, "g:ghost", key, "hi"), RangeError);
});
