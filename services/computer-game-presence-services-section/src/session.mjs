/**
 * session.mjs — the presence session: one connected player in one game. Pure data shaping only;
 * no I/O, no client wiring (that lives in presence-directory.mjs, which pairs a session with a
 * qwzspace-broadcast-hub client). `kind` defaults to "human" but "agent" is equally first-class —
 * nothing here or downstream branches on it except display/filtering.
 */

export const SESSION_KINDS = Object.freeze({ HUMAN: "human", AGENT: "agent" });

/**
 * @param {string} gameId
 * @param {string} playerId
 * @returns {string} the stable identity key a session is addressed by everywhere else in this
 *   package (channel membership, tell routing, the directory's client map).
 */
export function sessionKey(gameId, playerId) {
  if (typeof gameId !== "string" || gameId === "") throw new TypeError("sessionKey: gameId must be a non-empty string");
  if (typeof playerId !== "string" || playerId === "") throw new TypeError("sessionKey: playerId must be a non-empty string");
  return `${gameId}:${playerId}`;
}

/**
 * @param {{gameId: string, playerId: string, displayName?: string, kind?: string, connectedAt?: number}} input
 * @returns {{key: string, gameId: string, playerId: string, displayName: string, kind: string, connectedAt: number}}
 * @throws {TypeError} if gameId/playerId are missing or kind is not a recognized SESSION_KINDS value.
 */
export function createSession({ gameId, playerId, displayName, kind = SESSION_KINDS.HUMAN, connectedAt = Date.now() }) {
  const key = sessionKey(gameId, playerId);
  if (kind !== SESSION_KINDS.HUMAN && kind !== SESSION_KINDS.AGENT) {
    throw new TypeError(`createSession: kind must be "human" or "agent", got ${JSON.stringify(kind)}`);
  }
  return Object.freeze({
    key,
    gameId,
    playerId,
    displayName: typeof displayName === "string" && displayName !== "" ? displayName : playerId,
    kind,
    connectedAt,
  });
}

/**
 * @param {unknown} x
 * @returns {boolean} true iff x has the minimal session shape createSession produces.
 */
export function isSession(x) {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof x.key === "string" &&
    typeof x.gameId === "string" &&
    typeof x.playerId === "string" &&
    (x.kind === SESSION_KINDS.HUMAN || x.kind === SESSION_KINDS.AGENT)
  );
}

/**
 * @param {Iterable<{gameId: string}>} sessions
 * @param {string} [gameId] when given, only sessions for that game are returned.
 * @returns {Array<object>} sessions filtered by game, in iteration order — the pure form of
 *   "who's online, per game" that scripts/list-present-players.mjs calls against live state.
 */
export function listPresent(sessions, gameId) {
  const all = Array.from(sessions);
  return gameId == null ? all : all.filter((s) => s.gameId === gameId);
}
