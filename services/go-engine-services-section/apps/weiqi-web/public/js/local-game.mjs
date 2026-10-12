// Pure helpers for the local (human vs. bot) game page: undo, dead-stone
// marking, and the count. Every rules fact comes from the engine passed in
// (`engine` is the generated kernel's module namespace, exactly as bot.mjs
// takes it); this module only shapes page decisions, so it is testable
// without a DOM.

/**
 * The session as it stood before the human's last move -- taking back that
 * move and, when the bot has already replied, the reply too. Commands
 * alternate colors from Black, so the human's commands sit at the indices
 * whose parity matches `humanColor`. Returns null when the human has not
 * moved yet (nothing of theirs to take back), so a White human never
 * "undoes" only the bot's opening stone.
 */
export function undoLastExchange(session, humanColor, engine) {
  const colorAt = (index) => (index % 2 === 0 ? engine.BLACK : engine.WHITE);
  let cut = session.version - 1;
  while (cut >= 0 && colorAt(cut) !== humanColor) cut -= 1;
  if (cut < 0) return null;
  return engine.createWeiqiGameSession(session.config, session.commands.slice(0, cut));
}

/**
 * Toggle the dead mark on the whole group containing `point` (a point
 * index on `board`): all of its stones in, or all of them out. Marking is
 * an agreement, never a rules fact, so this reads the group off the
 * engine's own findGroup and decides nothing about life and death. An
 * empty point changes nothing. Returns a new Set.
 */
export function toggleDeadGroup(deadPoints, board, size, point, engine) {
  if (board[point] === engine.EMPTY) return deadPoints;
  const group = engine.findGroup(board, size, size, point);
  const next = new Set(deadPoints);
  const marking = !next.has(point);
  for (const stone of group.stones) {
    if (marking) next.add(stone);
    else next.delete(stone);
  }
  return next;
}

/**
 * The canonical session-level score, including ruleset, settled position,
 * score and territory ownership. The engine owns dead-stone removal, area
 * versus territory scoring, prisoner accounting and neutral-point decisions.
 * This page is a caller, not another implementation of that protocol.
 */
export function localCount(session, deadPoints, engine) {
  return engine.scoreWeiqiSession(session, deadPoints);
}

/**
 * A historical `mainPhaseEnded` flag stays true even if play resumes after
 * two passes. Only the ACTIVE two-pass, not-yet-settled position is editable
 * dead-stone marking. This is a projection of the engine's state, not rules.
 */
export function isUnsettledTwoPassPosition(game) {
  return game.passStreak >= 2 && game.result === null;
}

/** Count caption: provisional marking is editable; an engine-accepted
 * settlement is final and must never invite the player to change its dead. */
export function describeLocalCount(score, komi, deadCount, agreed = false) {
  const dead = agreed
    ? `${deadCount} stone${deadCount === 1 ? "" : "s"} agreed dead and removed before counting.`
    : deadCount === 0
      ? "Every stone on the board is counted as alive; click a stone to mark its group dead."
      : `${deadCount} stone${deadCount === 1 ? "" : "s"} marked dead and removed before counting.`;
  return `${score.margin}. ${agreed ? "Agreed" : "Provisional"} Chinese area count: Black ${score.blackScore} (${score.blackStones} stones + ${score.blackTerritory} territory), White ${score.whiteScore} (${score.whiteStones} stones + ${score.whiteTerritory} territory + ${komi} komi). Captures: Black took ${score.blackPrisoners}, White took ${score.whitePrisoners}. ${dead}`;
}
