// Pure admission binding for the multiplayer effect shell.  Rules, replay,
// versions, and idempotency remain exclusively owned by weiqi-engine/match.
import { createPositionFromCells, getRuleset, scoreArea, scoreTerritory } from "@red-cup-engineering/weiqi-engine";
import { admitWeiqiMatchCommand, createWeiqiMatch } from "@red-cup-engineering/weiqi-engine/match";

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

export function createStoredMatch({ config, black, white }) {
  if (!isNonEmptyString(black?.principal) || !isNonEmptyString(black?.capability)
    || !isNonEmptyString(white?.principal) || !isNonEmptyString(white?.capability)) {
    throw new TypeError("Each match player needs a principal and a capability");
  }
  const match = createWeiqiMatch(config, { black: black.principal, white: white.principal });
  return Object.freeze({ match, capabilities: Object.freeze({ black: black.capability, white: white.capability }) });
}

export function admitStoredMatchCommand(stored, { principal, capability, idempotencyKey, expectedVersion, command }, receivedAt) {
  const player = stored.match.players.black === principal ? "black" : stored.match.players.white === principal ? "white" : null;
  if (!player || stored.capabilities[player] !== capability) {
    return Object.freeze({ status: 401, body: Object.freeze({ ok: false, reason: "unauthorized" }) });
  }
  const admission = admitWeiqiMatchCommand(stored.match, { principal, idempotencyKey, expectedVersion, command }, receivedAt);
  if (!admission.ok) return Object.freeze({ status: admission.reason === "version-mismatch" ? 409 : 422, body: admission });
  return Object.freeze({
    status: 200,
    stored: admission.duplicate ? stored : Object.freeze({ ...stored, match: admission.match }),
    body: Object.freeze({ ok: true, duplicate: admission.duplicate, version: admission.match.session.version, stateHash: admission.match.stateHash, events: admission.events }),
  });
}

/**
 * The engine's own count of a finished match (both players passed), or null
 * while the main phase is open. Every stone is counted as alive: the match
 * has no dead-stone agreement yet, and the count says so. The scoring mode
 * follows the ruleset (territory rulesets count territory, all others area);
 * once the published engine exports scoreWeiqiSession this collapses to that
 * one call.
 */
export function storedMatchResult(stored) {
  const { config, state } = stored.match.session;
  if (!state.mainPhaseEnded) return null;
  const ruleset = getRuleset(config.ruleset);
  const position = createPositionFromCells(config.size, config.size, state.board, state.toMove, state.capturedBlackStones, state.capturedWhiteStones);
  const mode = ruleset.scoring === "territory" ? "territory" : "area";
  const score = mode === "territory" ? scoreTerritory(position, ruleset) : scoreArea(position, ruleset);
  return Object.freeze({ mode, komi: mode === "territory" ? ruleset.komi_territory ?? ruleset.komi : ruleset.komi, deadStonesAdjudicated: false, ...score });
}

/** The read-only view a player polls: the replay checkpoint plus the count when the game is over. */
export function describeStoredMatch(stored) {
  return Object.freeze({
    ok: true,
    version: stored.match.session.version,
    stateHash: stored.match.stateHash,
    session: stored.match.session,
    result: storedMatchResult(stored),
  });
}
