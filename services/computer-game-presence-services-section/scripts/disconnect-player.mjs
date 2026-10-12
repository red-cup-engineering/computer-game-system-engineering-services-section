/**
 * disconnect-player.mjs — the disconnect effect: drop a player's live client from a presence
 * directory, remove it from every channel it had joined, and emit the presence.disconnect entry.
 */

/**
 * @param {object} directory - a PresenceDirectory (../src/presence-directory.mjs createPresenceDirectory return shape).
 * @param {string} key a sessionKey, as returned by connect-player.mjs.
 * @returns {object|null} the removed session, or null if key was not connected.
 */
export function disconnectPlayer(directory, key) {
  return directory.disconnect(key);
}
