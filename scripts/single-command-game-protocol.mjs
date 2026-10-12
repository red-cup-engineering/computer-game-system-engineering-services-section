/**
 * The simplest possible game intent shape for a qwzspace-based single-command text game: one
 * free-text command string, capped in length, riding qwzspace's own intent envelope
 * (`{ kind: "command", args: { command } }`). Several qwzspace text games need nothing more —
 * verb parsing, affordance checking, and effects all happen inside the game's own
 * execute()/capability handlers (feltos), which already refuse unknown verbs and impossible
 * actions back to the actor — so this layer only shapes the envelope, it never interprets it.
 *
 * `createSingleCommandValidator` returns a `(raw, actorId) => CommandIntent | null` matching
 * qwzspace's own `intent-queue.mjs` `validate()` contract directly — pass the result straight
 * as `createIntentQueue({ validate })`.
 */

export const DEFAULT_MAX_COMMAND_LENGTH = 256;

export function createSingleCommandValidator({ maxCommandLength = DEFAULT_MAX_COMMAND_LENGTH } = {}) {
  return function gameValidate(raw, _actorId) {
    if (raw === null || typeof raw !== "object") return null;
    const body = raw;
    if (body.kind !== "command") return null;
    const args = body.args;
    if (args === null || typeof args !== "object") return null;
    const command = args.command;
    if (typeof command !== "string") return null;
    const trimmed = command.trim();
    if (trimmed.length === 0 || trimmed.length > maxCommandLength) return null;
    return { kind: "command", args: { command: trimmed } };
  };
}
