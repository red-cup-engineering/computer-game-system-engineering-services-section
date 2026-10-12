// Pure admission guard for a board-originated human move. The engine remains
// the authority for whose turn it is; this only prevents page effects from
// attempting a move while the local opponent or terminal state owns the turn.
// `humanColor` defaults to Black.
export function canAdmitHumanBoardMove({ session, finished, botThinking, humanColor }, engine) {
  if (finished || botThinking) return false;
  return engine.materializeWeiqiGame(session).current.toMove === (humanColor ?? engine.BLACK);
}
