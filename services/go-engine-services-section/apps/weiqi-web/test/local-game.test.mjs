import { test } from "node:test";
import assert from "node:assert/strict";
import * as kernel from "@red-cup-engineering/weiqi-engine";
import { WALL_WITH_INVADER, sessionAfterMoves } from "@red-cup-engineering/weiqi-engine/testing";
import { describeLocalCount, isUnsettledTwoPassPosition, localCount, toggleDeadGroup, undoLastExchange } from "../public/js/local-game.mjs";

function sessionAfter(moves, size = 9) {
  // Exercise the generated browser engine via the shared upstream test
  // fixture. The fixture owns command formation, not legality.
  return sessionAfterMoves({ size, ruleset: "chinese" }, moves, kernel);
}

test("undo as Black takes back the human's move and the bot's reply", () => {
  const session = sessionAfter(["E5", "D5"]);
  const previous = undoLastExchange(session, kernel.BLACK, kernel);
  assert.ok(previous);
  assert.equal(previous.version, 0);
  assert.equal(undoLastExchange(sessionAfter([]), kernel.BLACK, kernel), null);
  // Mid-exchange (the bot has not replied yet): only the human's move goes.
  const pending = undoLastExchange(sessionAfter(["E5", "D5", "E4"]), kernel.BLACK, kernel);
  assert.equal(pending?.version, 2);
  assert.equal(kernel.materializeWeiqiGame(pending).current.toMove, kernel.BLACK);
});

test("undo as White never removes only the bot's opening stone", () => {
  assert.equal(undoLastExchange(sessionAfter(["E5"]), kernel.WHITE, kernel), null);
  const previous = undoLastExchange(sessionAfter(["E5", "D5", "E4"]), kernel.WHITE, kernel);
  assert.equal(previous?.version, 1);
  assert.equal(kernel.materializeWeiqiGame(previous).current.toMove, kernel.WHITE);
});

test("undo after two passes reopens the game", () => {
  const ended = sessionAfter(["E5", "D5", "pass", "pass"]);
  assert.equal(ended.state.mainPhaseEnded, true);
  const previous = undoLastExchange(ended, kernel.BLACK, kernel);
  assert.equal(previous?.version, 2);
  assert.equal(previous?.state.mainPhaseEnded, false);
});

test("marking toggles a whole group at once and ignores empty points", () => {
  const game = kernel.materializeWeiqiGame(sessionAfter(["C3", "G7", "C4", "G6"]));
  const size = 9;
  const c3 = kernel.coordToPoint(size, size, "C3");
  const c4 = kernel.coordToPoint(size, size, "C4");
  const marked = toggleDeadGroup(new Set(), game.current.board, size, c3, kernel);
  assert.deepEqual([...marked].sort(), [c3, c4].sort());
  const unmarked = toggleDeadGroup(marked, game.current.board, size, c4, kernel);
  assert.equal(unmarked.size, 0);
  const untouched = toggleDeadGroup(marked, game.current.board, size, kernel.coordToPoint(size, size, "E5"), kernel);
  assert.equal(untouched, marked);
});

test("the count removes marked stones as prisoners before the engine counts", () => {
  // Black walls column B, White walls column D on 5x5, White drops a stone
  // at A3 inside Black's side, then both pass.
  const session = sessionAfter(WALL_WITH_INVADER, 5);
  const game = kernel.materializeWeiqiGame(session);
  const alive = localCount(session, new Set(), kernel);
  assert.equal(alive.score.blackTerritory, 0);
  const a3 = kernel.coordToPoint(5, 5, "A3");
  const settled = localCount(session, new Set([a3]), kernel);
  assert.equal(settled.position.board[a3], kernel.EMPTY);
  assert.equal(settled.score.blackTerritory, 5);
  assert.equal(settled.score.blackScore, 10);
  assert.deepEqual(settled, kernel.scoreWeiqiSession(session, new Set([a3])),
    "the web returns the engine's complete scoring receipt without recomputing it");
  assert.equal(settled.mode, "area");
  assert.equal(settled.ruleset.komi, 7.5);
  assert.ok(settled.ownership instanceof Uint8Array, "the board receives the engine's ownership map");
  assert.equal(settled.ownership[a3], kernel.BLACK, "after settling, the removed stone's point is black territory");
  assert.equal(alive.ownership[a3], kernel.EMPTY, "a living white stone never renders as black territory");
  for (let row = 1; row <= 5; row += 1) {
    assert.equal(settled.ownership[kernel.coordToPoint(5, 5, `A${row}`)], kernel.BLACK);
    assert.equal(settled.ownership[kernel.coordToPoint(5, 5, `C${row}`)], kernel.EMPTY,
      "the neutral region between the black and white walls must remain unshaded");
  }
  assert.equal(settled.score.margin, "White by 7.5");
  const text = describeLocalCount(settled.score, game.ruleset.komi, 1);
  assert.match(text, /^White by 7\.5\. Provisional Chinese area count: Black 10 \(5 stones \+ 5 territory\)/);
  assert.match(text, /1 stone marked dead/);
  assert.match(describeLocalCount(alive.score, game.ruleset.komi, 0), /counted as alive/);
});

test("local count delegates all scoring authority to the upstream session API", () => {
  const session = Object.freeze({ version: 3 });
  const dead = new Set([12, 13]);
  const receipt = Object.freeze({
    mode: "area", ruleset: { komi: 7.5 }, position: {}, score: {}, ownership: new Uint8Array(9),
  });
  let calls = 0;
  const engine = Object.freeze({
    scoreWeiqiSession(receivedSession, receivedDead) {
      assert.equal(receivedSession, session);
      assert.equal(receivedDead, dead);
      calls += 1;
      return receipt;
    },
  });
  assert.equal(localCount(session, dead, engine), receipt);
  assert.equal(calls, 1);
});

test("the same web projection respects another upstream scoring mode without rewriting rules", () => {
  const session = kernel.createWeiqiGameSession({ size: 9, ruleset: "japanese" });
  const counted = localCount(session, [], kernel);
  assert.equal(counted.mode, "territory");
  assert.deepEqual(counted, kernel.scoreWeiqiSession(session, []));
  assert.equal(counted.ruleset.komi, 6.5);
  assert.equal(counted.score.whiteScore, 6.5);
});


test("restoring play distinguishes provisional two passes from later resumed play", () => {
  const passed = sessionAfter(["C3", "G7", "pass", "pass"]);
  const provisional = kernel.materializeWeiqiGame(passed);
  assert.equal(provisional.mainPhaseEnded, true);
  assert.equal(provisional.passStreak, 2);
  assert.equal(isUnsettledTwoPassPosition(provisional), true);

  const continued = kernel.admitWeiqiGameCommand(passed, passed.version,
    { kind: "play", move: "E5" });
  assert.equal(continued.ok, true);
  if (!continued.ok) return;
  const resumed = kernel.materializeWeiqiGame(continued.session);
  assert.equal(resumed.mainPhaseEnded, true, "engine preserves historical phase transition");
  assert.equal(resumed.passStreak, 0, "the active two-pass phase has ended");
  assert.equal(isUnsettledTwoPassPosition(resumed), false,
    "Play must not restore a resumed game as a finished one");

  const settled = kernel.admitWeiqiGameCommand(passed, passed.version,
    { kind: "settle", dead: [] });
  assert.equal(settled.ok, true);
  if (settled.ok) {
    assert.equal(isUnsettledTwoPassPosition(kernel.materializeWeiqiGame(settled.session)), false,
      "the accepted count is final, not editable provisional marking");
  }
});

test("agreed counts are explicitly final and agree with upstream settlement scoring", () => {
  const session = sessionAfter(WALL_WITH_INVADER, 5);
  const accepted = kernel.admitWeiqiGameCommand(session, session.version,
    { kind: "settle", dead: ["A3"] });
  assert.equal(accepted.ok, true);
  if (!accepted.ok) return;
  const settled = kernel.materializeWeiqiGame(accepted.session);
  const dead = new Set([kernel.coordToPoint(5, 5, "A3")]);
  const receipt = localCount(accepted.session, dead, kernel);
  assert.deepEqual(receipt.score, settled.result.score,
    "the final presentation must use the upstream agreed dead-stone count");
  const display = describeLocalCount(receipt.score, receipt.ruleset.komi, dead.size, true);
  assert.match(display, /^White by 7\.5\. Agreed Chinese area count:/);
  assert.match(display, /1 stone agreed dead and removed before counting\./);
  assert.doesNotMatch(display, /click a stone|Provisional/);
  const provisional = describeLocalCount(receipt.score, receipt.ruleset.komi, 0);
  assert.match(provisional, /Provisional Chinese area count/);
  assert.match(provisional, /click a stone/);
});
