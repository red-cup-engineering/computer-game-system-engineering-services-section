/**
 * subscribe-to-channel.mjs — the subscribe half of "channels (subscribe/broadcast)": join a
 * connected session to a channel so a later broadcast-to-channel reaches it. Not itself named in
 * the walking-skeleton verb list, but required to exercise it — a broadcast has no receiver
 * without a prior subscribe.
 */

/**
 * @param {object} directory - a PresenceDirectory (../src/presence-directory.mjs createPresenceDirectory return shape).
 * @param {string} key a sessionKey, as returned by connect-player.mjs.
 * @param {string} channelName
 * @returns {void}
 * @throws {RangeError} if key names no connected session.
 */
export function subscribeToChannel(directory, key, channelName) {
  directory.subscribeToChannel(key, channelName);
}
