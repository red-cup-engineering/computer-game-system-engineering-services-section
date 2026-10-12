/**
 * channel.mjs — channel membership as a pure, immutable data structure: `{ [channelName]:
 * sessionKey[] }`. subscribe/unsubscribe return a NEW registry rather than mutating their input,
 * so presence-directory.mjs's own log entries (which record the registry-changing call, not its
 * result) stay a faithful replay source — replaying the log means replaying these same pure
 * calls, not reading a mutable structure that has already moved on.
 */

/**
 * @returns {{}} an empty channel registry.
 */
export function createChannelRegistry() {
  return {};
}

/**
 * @param {Record<string, string[]>} registry
 * @param {string} channelName
 * @param {string} key a sessionKey (see session.mjs).
 * @returns {Record<string, string[]>} a new registry with key added to channelName's members
 *   (idempotent: subscribing twice does not duplicate the entry).
 */
export function subscribe(registry, channelName, key) {
  const current = registry[channelName] ?? [];
  if (current.includes(key)) return registry;
  return { ...registry, [channelName]: [...current, key] };
}

/**
 * @param {Record<string, string[]>} registry
 * @param {string} channelName
 * @param {string} key a sessionKey to remove from channelName's members.
 * @returns {Record<string, string[]>} a new registry with key removed from every entry it may
 *   still hold across ALL channels — a disconnecting session leaves every channel it joined, not
 *   just one.
 */
export function unsubscribeAll(registry, key) {
  const next = {};
  for (const [channelName, members] of Object.entries(registry)) {
    const filtered = members.filter((m) => m !== key);
    if (filtered.length > 0) next[channelName] = filtered;
  }
  return next;
}

/**
 * @param {Record<string, string[]>} registry
 * @param {string} channelName
 * @param {string} key
 * @returns {Record<string, string[]>} a new registry with key removed from just channelName.
 */
export function unsubscribe(registry, channelName, key) {
  const current = registry[channelName];
  if (!current || !current.includes(key)) return registry;
  const filtered = current.filter((m) => m !== key);
  const next = { ...registry };
  if (filtered.length > 0) next[channelName] = filtered;
  else delete next[channelName];
  return next;
}

/**
 * @param {Record<string, string[]>} registry
 * @param {string} channelName
 * @returns {string[]} the sessionKeys currently subscribed to channelName (empty array if none).
 */
export function membersOf(registry, channelName) {
  return registry[channelName] ?? [];
}
