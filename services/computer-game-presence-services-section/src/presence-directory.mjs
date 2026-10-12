/**
 * presence-directory.mjs — the stateful orchestrator that wires session.mjs/channel.mjs/tell.mjs's
 * pure algebra to a live @red-cup-engineering/qwzspace broadcast-hub. This is the one place in the
 * package that holds mutable runtime state (the session table, the channel registry, the log) and
 * therefore the one place that is not pure — scripts/*.mjs each call exactly one method here per
 * effect, per the house scripts-import-src convention.
 *
 * TRANSPORT-AGNOSTIC BY CONSTRUCTION: a `client` is anything shaped `{ send(obj): boolean }`
 * (qwzspace broadcast-hub's own contract) — an agent player's in-process transport adapter and a
 * human's websocket both qualify identically. Nothing here assumes a browser or a human.
 */

import { createBroadcastHub } from "@red-cup-engineering/qwzspace/broadcast-hub";
import { createSession, listPresent } from "./session.mjs";
import { createChannelRegistry, subscribe as subscribeChannel, unsubscribeAll, membersOf } from "./channel.mjs";
import { createTell } from "./tell.mjs";
import { createPresenceLog, appendPresenceEvent, PRESENCE_EVENT_KINDS } from "./log.mjs";

/**
 * @returns {object} a presence directory: connect, disconnect, subscribeToChannel,
 *   broadcastToChannel, sendTell, listPresentPlayers, log, hub.
 */
export function createPresenceDirectory() {
  const hub = createBroadcastHub();
  /** @type {Map<string, object>} sessionKey -> session */
  const sessions = new Map();
  /** @type {Map<string, {send(obj: unknown): boolean}>} sessionKey -> client */
  const clients = new Map();
  let channels = createChannelRegistry();
  let log = createPresenceLog();

  /**
   * @param {{gameId: string, playerId: string, displayName?: string, kind?: string, client: {send(obj: unknown): boolean}}} input
   * @returns {{key: string, session: object}}
   * @throws {TypeError} if client does not implement send().
   */
  function connect({ gameId, playerId, displayName, kind, client }) {
    if (!client || typeof client.send !== "function") {
      throw new TypeError("connect: client must implement send(obj):boolean");
    }
    const session = createSession({ gameId, playerId, displayName, kind });
    sessions.set(session.key, session);
    clients.set(session.key, client);
    hub.add(client);
    log = appendPresenceEvent(log, PRESENCE_EVENT_KINDS.CONNECT, {
      key: session.key,
      gameId,
      playerId,
      displayName: session.displayName,
      sessionKind: session.kind,
    });
    return { key: session.key, session };
  }

  /**
   * @param {string} key a sessionKey.
   * @returns {object|null} the removed session, or null if key was not present.
   */
  function disconnect(key) {
    const session = sessions.get(key) ?? null;
    const client = clients.get(key);
    if (client) {
      hub.remove(client);
      clients.delete(key);
    }
    sessions.delete(key);
    channels = unsubscribeAll(channels, key);
    if (session) {
      log = appendPresenceEvent(log, PRESENCE_EVENT_KINDS.DISCONNECT, { key, gameId: session.gameId, playerId: session.playerId });
    }
    return session;
  }

  /**
   * @param {string} key a sessionKey.
   * @param {string} channelName
   * @throws {RangeError} if key names no connected session.
   */
  function subscribeToChannel(key, channelName) {
    if (!sessions.has(key)) throw new RangeError(`subscribeToChannel: no connected session for ${key}`);
    channels = subscribeChannel(channels, channelName, key);
    log = appendPresenceEvent(log, PRESENCE_EVENT_KINDS.SUBSCRIBE, { key, channelName });
  }

  /**
   * @param {string} channelName
   * @param {string} fromKey the sessionKey of the broadcaster.
   * @param {unknown} message JSON-serializable payload.
   * @returns {{delivered: number, envelope: object}} delivered is the count of live members sent to
   *   (excludes the broadcaster and any member whose client has since gone dead).
   */
  function broadcastToChannel(channelName, fromKey, message) {
    const envelope = { channel: channelName, from: fromKey, message, at: Date.now() };
    let delivered = 0;
    for (const memberKey of membersOf(channels, channelName)) {
      if (memberKey === fromKey) continue;
      const client = clients.get(memberKey);
      if (client && hub.send(client, { type: "channel.message", ...envelope })) delivered += 1;
    }
    log = appendPresenceEvent(log, PRESENCE_EVENT_KINDS.BROADCAST, envelope);
    return { delivered, envelope };
  }

  /**
   * @param {string} fromKey the sender's sessionKey.
   * @param {string} toKey the recipient's sessionKey — may be in a different game (the primitive's
   *   whole point: a tell crosses game boundaries the same way it crosses players).
   * @param {string} body
   * @returns {{delivered: boolean, tell: object}} delivered is false if toKey has no live client
   *   (e.g. it disconnected) — the tell is still logged either way.
   * @throws {RangeError} if fromKey or toKey names no connected session.
   */
  function sendTell(fromKey, toKey, body) {
    const fromSession = sessions.get(fromKey);
    const toSession = sessions.get(toKey);
    if (!fromSession) throw new RangeError(`sendTell: no connected session for ${fromKey}`);
    if (!toSession) throw new RangeError(`sendTell: no connected session for ${toKey}`);
    const tell = createTell({
      fromGameId: fromSession.gameId,
      fromPlayerId: fromSession.playerId,
      toGameId: toSession.gameId,
      toPlayerId: toSession.playerId,
      body,
    });
    const client = clients.get(toKey);
    const delivered = Boolean(client && hub.send(client, { type: "tell", ...tell }));
    log = appendPresenceEvent(log, PRESENCE_EVENT_KINDS.TELL, tell);
    return { delivered, tell };
  }

  /**
   * @param {string} [gameId] when given, only that game's present players are returned.
   * @returns {Array<object>} live sessions.
   */
  function listPresentPlayers(gameId) {
    return listPresent(sessions.values(), gameId);
  }

  return {
    connect,
    disconnect,
    subscribeToChannel,
    broadcastToChannel,
    sendTell,
    listPresentPlayers,
    log: () => log,
    channels: () => channels,
    hub,
  };
}
