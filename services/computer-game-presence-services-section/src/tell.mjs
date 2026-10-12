/**
 * tell.mjs — the cross-game direct message envelope. Pure shaping and validation only; delivery
 * (finding the recipient's live client and sending) is presence-directory.mjs's job.
 */

const MAX_BODY_LENGTH = 4000;

/**
 * @param {{fromGameId: string, fromPlayerId: string, toGameId: string, toPlayerId: string, body: string, sentAt?: number}} input
 * @returns {{fromGameId: string, fromPlayerId: string, toGameId: string, toPlayerId: string, body: string, sentAt: number}}
 * @throws {TypeError} if any identity field is missing/empty or body is not a non-empty string.
 */
export function createTell({ fromGameId, fromPlayerId, toGameId, toPlayerId, body, sentAt = Date.now() }) {
  for (const [name, value] of Object.entries({ fromGameId, fromPlayerId, toGameId, toPlayerId })) {
    if (typeof value !== "string" || value === "") {
      throw new TypeError(`createTell: ${name} must be a non-empty string`);
    }
  }
  if (typeof body !== "string" || body === "") throw new TypeError("createTell: body must be a non-empty string");
  return Object.freeze({
    fromGameId,
    fromPlayerId,
    toGameId,
    toPlayerId,
    body: body.slice(0, MAX_BODY_LENGTH),
    sentAt,
  });
}

/**
 * @param {unknown} x
 * @returns {boolean} true iff x has the minimal tell shape createTell produces.
 */
export function isTell(x) {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof x.fromGameId === "string" &&
    typeof x.fromPlayerId === "string" &&
    typeof x.toGameId === "string" &&
    typeof x.toPlayerId === "string" &&
    typeof x.body === "string"
  );
}

/**
 * @param {{fromGameId: string, toGameId: string}} tell
 * @returns {boolean} true iff the tell crosses a game boundary — the differentiator this
 *   primitive exists for (a same-game DM is still valid, just not the novel case).
 */
export function isCrossGame(tell) {
  return tell.fromGameId !== tell.toGameId;
}
