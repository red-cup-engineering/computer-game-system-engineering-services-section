/**
 * list-present-players.mjs — the who-list effect (read-only, but scripted like its siblings so a
 * consuming game calls one house verb per operation rather than reaching into the directory
 * object's own method surface directly).
 */

/**
 * @param {object} directory - a PresenceDirectory (../src/presence-directory.mjs createPresenceDirectory return shape).
 * @param {string} [gameId] when given, only that game's present players are returned.
 * @returns {Array<object>} live sessions.
 */
export function listPresentPlayers(directory, gameId) {
  return directory.listPresentPlayers(gameId);
}
