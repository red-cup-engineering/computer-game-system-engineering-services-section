/**
 * broadcast-to-channel.mjs — the broadcast half of "channels (subscribe/broadcast)": fan a
 * message out to every session subscribed to a channel, over qwzspace's broadcast-hub, and emit
 * the channel.broadcast log entry.
 */

/**
 * @param {object} directory - a PresenceDirectory (../src/presence-directory.mjs createPresenceDirectory return shape).
 * @param {string} channelName
 * @param {string} fromKey the broadcaster's sessionKey.
 * @param {unknown} message JSON-serializable payload.
 * @returns {{delivered: number, envelope: object}}
 */
export function broadcastToChannel(directory, channelName, fromKey, message) {
  return directory.broadcastToChannel(channelName, fromKey, message);
}
