// Receiver check for the exact browser kernel and normal-game surface that
// `wrangler deploy` publishes. This complements source tests with the
// release artifact's player-critical flow without requiring a browser or a
// network deployment.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as kernel from "../public/js/kernel/index.mjs";
import { chooseInfluenceMove, chooseMonteCarloMove } from "../public/js/bot.mjs";
import { localCount } from "../public/js/local-game.mjs";

const playHtml = await readFile(new URL("../public/play.html", import.meta.url), "utf8");
const captureGoHtml = await readFile(new URL("../public/learn/capture-go/index.html", import.meta.url), "utf8");
const playApp = await readFile(new URL("../public/js/play-app.mjs", import.meta.url), "utf8");
const localGame = await readFile(new URL("../public/js/local-game.mjs", import.meta.url), "utf8");

for (const requiredSurface of [
  "Play Weiqi",
  "id=\"pass-btn\"",
  "id=\"undo-btn\"",
  "id=\"board-size-select\"",
  "id=\"human-color-select\"",
  "id=\"resign-btn\"",
  "id=\"game-result\"",
  "src=\"js/play-app.mjs\"",
]) {
  assert.ok(playHtml.includes(requiredSurface), `normal-play page is missing ${requiredSurface}`);
}
assert.ok(!playHtml.includes("Capture Go"), "normal-play page still presents Capture Go");
assert.ok(playApp.includes("You resigned."), "resignation result is not wired into the public app");
assert.ok(localGame.includes("Provisional Chinese area count:"), "the area count sentence is missing from local-game.mjs");
assert.ok(playApp.includes("describeLocalCount(") && playApp.includes("finishByScore()"), "area-count result is not wired into the public app");
assert.ok(playApp.includes("toggleDeadGroup(") && playApp.includes("setDeadStones("), "dead-stone marking is not wired into the public app");
assert.ok(playApp.includes("undoLastExchange("), "undo is not wired into the public app");
assert.ok(playApp.includes("bot-worker.mjs"), "the bot's worker thread is not wired into the public app");
assert.ok(playApp.includes("studyLink(") && playApp.includes("renderConceptSummaryCard("), "Study hand-off and the concept summary are not wired into the public app");
for (const artifact of ["../public/manifest.webmanifest", "../public/sw.js", "../public/icons/icon-192.png", "../public/icons/icon-512.png", "../public/js/pwa.mjs"]) {
  await readFile(new URL(artifact, import.meta.url));
}
assert.ok(playHtml.includes('rel="manifest"') && playHtml.includes("/js/pwa.mjs"), "the play page is not installable");

for (const requiredSurface of [
  "data-game-mode=\"capture-go\"",
  "Capture Go",
  "7&times;7 learning mode",
  "id=\"pass-btn\" type=\"button\" disabled",
  "src=\"../../js/play-app.mjs\"",
]) {
  assert.ok(captureGoHtml.includes(requiredSurface), `Capture Go page is missing ${requiredSurface}`);
}
assert.ok(!playHtml.includes("data-game-mode"), "normal play must not select a learning game mode");
assert.ok(playApp.includes('const DEFAULT_BOARD_SIZE = CAPTURE_GO ? 7 : 9;'), "page mode must select 7x7 only for Capture Go");
assert.ok(playApp.includes('const RULESET = CAPTURE_GO ? "japanese" : "chinese";'), "page mode must retain Chinese rules for normal play");
assert.ok(
  playApp.includes('if (CAPTURE_GO && outcome.events.some((event) => event.type === "capture")) finishByCapture(mover);'),
  "only Capture Go must finish on its first capture",
);
assert.ok(playApp.includes("made the first capture and wins this Capture Go learning game."), "Capture Go result is not wired into the public app");

const replyGame = new kernel.Game(9, "chinese");
assert.equal(replyGame.play("E5").ok, true, "the player opening must be legal");
const aiReply = chooseInfluenceMove(replyGame, kernel, () => 0);
assert.notEqual(aiReply, "pass", "the selected local AI must reply while placements remain");
assert.equal(replyGame.isLegal(aiReply), true, "the selected local AI reply must be legal");
assert.equal(replyGame.play(aiReply).ok, true, "the selected local AI reply must apply");
assert.equal(replyGame.current.toMove, kernel.BLACK, "play returns to the player after the AI reply");

const ponderGame = new kernel.Game(9, "chinese");
assert.equal(ponderGame.play("E5").ok, true);
const ponderReply = chooseMonteCarloMove(ponderGame, kernel, () => 0.5, { playouts: 8 });
assert.equal(ponderGame.isLegal(ponderReply), true, "the Monte Carlo tier must reply legally through the release engine");

// Black surrounds and captures White D4. A normal Chinese-rules match must
// continue after that capture; Capture Go behavior is explicitly rejected.
const captureGame = new kernel.Game(9, "chinese");
for (const move of ["E4", "D4", "D3", "A1", "C4", "A2", "D5"]) {
  assert.equal(captureGame.play(move).ok, true, `${move} must be a legal setup move`);
}
assert.equal(captureGame.current.board[kernel.coordToPoint(9, 9, "D4")], kernel.EMPTY, "D4 must be captured");
assert.equal(captureGame.mainPhaseEnded, false, "a capture must not end a normal match");

const learningCaptureGame = new kernel.Game(7, "japanese");
let learningCapture;
for (const move of ["E4", "D4", "D3", "A1", "C4", "A2", "D5"]) {
  learningCapture = learningCaptureGame.play(move);
  assert.equal(learningCapture.ok, true, `${move} must be legal in Capture Go`);
}
assert.ok(
  learningCapture.events.some((event) => event.type === "capture"),
  "the Capture Go learning line must produce its first capture",
);
assert.equal(learningCaptureGame.mainPhaseEnded, false, "first-capture completion is a learning-mode UI outcome, not normal engine termination");

const scoreGame = new kernel.Game(9, "chinese");
assert.equal(scoreGame.play("C3").ok, true);
assert.equal(scoreGame.play("D3").ok, true);
assert.equal(scoreGame.play("pass").ok, true);
const finalPass = scoreGame.play("pass");
assert.equal(finalPass.ok, true);
assert.equal(scoreGame.mainPhaseEnded, true, "two passes must end the match");
assert.ok(finalPass.events.some((event) => event.type === "game-ended"), "final pass must emit game-ended");
const score = kernel.scoreArea(scoreGame.current, scoreGame.ruleset);
assert.ok(Number.isFinite(score.blackScore) && Number.isFinite(score.whiteScore), "area count must be numeric");
assert.match(score.margin, /^(Black|White) by \d+(?:\.\d+)?$|^Draw$/, "area count must name a result");

// The page-facing count uses the very same receipt returned by the built
// browser kernel, rather than reconstructing dead-stone rules or territory.
let scoreSession = kernel.createWeiqiGameSession({ size: 9, ruleset: "chinese" });
for (const command of [
  { kind: "play", move: "C3" }, { kind: "play", move: "D3" },
  { kind: "pass" }, { kind: "pass" },
]) {
  const admission = kernel.admitWeiqiGameCommand(scoreSession, scoreSession.version, command);
  assert.equal(admission.ok, true, "the scoring fixture must be an admitted session");
  scoreSession = admission.session;
}
const browserReceipt = kernel.scoreWeiqiSession(scoreSession, []);
const pageReceipt = localCount(scoreSession, [], kernel);
assert.deepEqual(pageReceipt, browserReceipt, "the page must not invent its own count");
assert.equal(pageReceipt.mode, "area", "normal Play uses Chinese area scoring");
assert.equal(pageReceipt.ownership.length, 81, "the board must receive the whole ownership map");

console.log("normal-play release receiver check passed");
