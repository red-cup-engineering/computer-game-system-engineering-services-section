/**
 * send-tell.mjs — the tell effect: a cross-game direct message between two connected sessions,
 * delivered over qwzspace's broadcast-hub if the recipient is live, and always logged.
 */

/**
 * @param {object} directory - a PresenceDirectory (../src/presence-directory.mjs createPresenceDirectory return shape).
 * @param {string} fromKey the sender's sessionKey.
 * @param {string} toKey the recipient's sessionKey — may belong to a different game.
 * @param {string} body
 * @returns {{delivered: boolean, tell: object}}
 */
export function sendTell(directory, fromKey, toKey, body) {
  return directory.sendTell(fromKey, toKey, body);
}
