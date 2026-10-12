import { test } from "node:test";
import assert from "node:assert/strict";
import { Game } from "@red-cup-engineering/weiqi-engine";
import * as kernel from "@red-cup-engineering/weiqi-engine";
import { chooseInfluenceMove } from "../public/js/bot.mjs";
import { canAdmitHumanBoardMove } from "../public/js/play-turn-admission.mjs";

test("a board event is admitted only while the human owns the engine turn", () => {
  const opening = kernel.createWeiqiGameSession({ size: 9, ruleset: "chinese" });
  assert.equal(canAdmitHumanBoardMove({ session: opening, finished: false, botThinking: false }, kernel), true);

  const moved = kernel.admitWeiqiGameCommand(opening, opening.version, { kind: "play", move: "E5" });
  assert.equal(moved.ok, true);
  if (!moved.ok) return;
  assert.equal(canAdmitHumanBoardMove({ session: moved.session, finished: false, botThinking: false }, kernel), false);
  assert.equal(canAdmitHumanBoardMove({ session: opening, finished: false, botThinking: true }, kernel), false);
  assert.equal(canAdmitHumanBoardMove({ session: opening, finished: true, botThinking: false }, kernel), false);

  // As White, the human owns the turn only after the bot's opening move.
  assert.equal(canAdmitHumanBoardMove({ session: opening, finished: false, botThinking: false, humanColor: kernel.WHITE }, kernel), false);
  assert.equal(canAdmitHumanBoardMove({ session: moved.session, finished: false, botThinking: false, humanColor: kernel.WHITE }, kernel), true);
});

test("the public opponent makes a legal White reply in a normal 9x9 game", () => {
  const game = new Game(9, "chinese");
  const humanMove = game.play("E5");
  assert.equal(humanMove.ok, true);
  assert.equal(game.mainPhaseEnded, false);

  const aiMove = chooseInfluenceMove(game, kernel, () => 0);
  assert.notEqual(aiMove, "pass");
  assert.equal(game.isLegal(aiMove), true);
  const reply = game.play(aiMove);
  assert.equal(reply.ok, true);
  assert.equal(game.current.toMove, kernel.BLACK);
  assert.equal(game.history.length, 3);
});

test("two passes, rather than a capture, end a normal match", () => {
  const game = new Game(9, "chinese");
  assert.equal(game.play("C3").ok, true);
  assert.equal(game.play("D3").ok, true);
  assert.equal(game.play("C4").ok, true);
  assert.equal(game.play("D4").ok, true);
  assert.equal(game.play("pass").ok, true);
  const finalPass = game.play("pass");
  assert.equal(finalPass.ok, true);
  assert.equal(game.mainPhaseEnded, true);
  if (finalPass.ok) assert.ok(finalPass.events.some((event) => event.type === "game-ended"));
});
