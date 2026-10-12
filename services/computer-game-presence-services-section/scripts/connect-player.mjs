/**
 * connect-player.mjs — the connect effect: register one player's live client with a presence
 * directory and emit the presence.connect log entry (via presence-directory.mjs).
 */

/**
 * @param {object} directory - a PresenceDirectory (../src/presence-directory.mjs createPresenceDirectory return shape).
 * @param {{gameId: string, playerId: string, displayName?: string, kind?: string, client: {send(obj: unknown): boolean}}} params
 * @returns {{key: string, session: object}}
 */
export function connectPlayer(directory, params) {
  return directory.connect(params);
}
