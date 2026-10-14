import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import * as kernel from "../public/js/kernel/index.mjs";
import { WALL_WITH_INVADER, sessionAfterMoves } from "@red-cup-engineering/weiqi-engine/testing";
import { localCount, describeLocalCount } from "../public/js/local-game.mjs";
import { buildStudyReplay, playLink, sessionFromStudyHash, studyLink } from "../public/js/study-replay.mjs";

const source = await readFile(new URL("../public/js/play-app.mjs", import.meta.url), "utf8");
const countBegin = source.indexOf("function showCount() {");
const countEnd = source.indexOf("\nfunction showConceptSummary()", countBegin);
const begin = source.indexOf('acceptCountBtn.addEventListener("click", () => {');
const end = source.indexOf("\n});", begin);
if ([countBegin, countEnd, begin, end].some((n) => n < 0)) {
  throw new Error("Play must expose a real Accept count button and canonical count presentation");
}
const code = source.slice(countBegin, countEnd) + "\n" + source.slice(begin, end + 4);
const renderBegin = source.indexOf("function render() {");
const renderEnd = source.indexOf("\n// --- Ending the game", renderBegin);
if (renderBegin < 0 || renderEnd < 0) throw new Error("Play render control state is unavailable");
const renderSource = source.slice(renderBegin, renderEnd);

function liveFixture() {
  // Whole-group/settlement truth comes from the generated browser kernel;
  // the input sequence is the same upstream-owned wall fixture used by
  // engine and two-player match regressions.
  const session = sessionAfterMoves(
    { size: 5, ruleset: "chinese" }, WALL_WITH_INVADER, kernel);
  assert.equal(session.state.passStreak, 2);
  assert.equal(session.state.result, null);
  return session;
}

function mountedCountButton(session, marks = new Set(), {
  marking = true, finished = true, botThinking = false, CAPTURE_GO = false,
} = {}) {
  let click = null;
  const calls = { summaries: 0, events: 0, renders: 0, announcements: [],
    territory: null, markedCoordinates: null, status: [] };
  const acceptCountBtn = {
    addEventListener(event, fn) {
      assert.equal(event, "click");
      assert.equal(click, null);
      click = fn;
    },
  };
  const resultEl = { hidden: true, textContent: "" };
  const board = {
    setTerritory(value) { calls.territory = value; },
    setDeadStones(value) { calls.markedCoordinates = value; },
    announce(text) { calls.announcements.push(text); },
  };
  const dependencies = {
    acceptCountBtn, CAPTURE_GO, botThinking, session, marking, finished,
    deadPoints: new Set(marks), kernel, localCount, describeLocalCount, resultEl, board,
    setStatus(text) { calls.status.push(text); },
    rebuildEventLog() { calls.events++; },
    showConceptSummary() { calls.summaries++; },
    render() { calls.renders++; },
  };
  const mounted = new Function(...Object.keys(dependencies),
    code + "\nreturn { state() { return { session, marking, finished, deadPoints }; } };")(
    ...Object.values(dependencies));
  return {
    click() { assert.equal(typeof click, "function"); click(); return mounted.state(); },
    state: mounted.state, calls, resultEl,
  };
}

test("Accept count writes the real marked-dead settlement to the engine and makes Study/SGF durable", () => {
  const session = liveFixture();
  const a3 = kernel.coordToPoint(5, 5, "A3");
  const ui = mountedCountButton(session, new Set([a3]));
  const next = ui.click();
  assert.equal(next.session.version, session.version + 1);
  assert.equal(next.session.commands.at(-1).kind, "settle");
  assert.deepEqual(next.session.commands.at(-1).dead, ["A3"]);
  assert.equal(next.session.state.result?.by, "count");
  assert.deepEqual(next.session.state.result.dead, ["A3"]);
  assert.equal(next.session.state.result.score.blackScore, 10);
  assert.equal(next.session.state.result.score.whiteScore, 17.5);
  assert.equal(next.marking, false);
  assert.equal(next.finished, true);
  assert.equal(ui.calls.events, 1);
  assert.equal(ui.calls.summaries, 1);
  assert.equal(ui.calls.renders, 1);
  assert.deepEqual(ui.calls.markedCoordinates, ["A3"]);
  assert.match(ui.resultEl.textContent, /Agreed Chinese area count/);
  assert.doesNotMatch(ui.resultEl.textContent, /Provisional|click a stone/i);
  assert.deepEqual(localCount(next.session, new Set([a3]), kernel).score,
    next.session.state.result.score);
  assert.deepEqual(buildStudyReplay(next.session).frames.at(-1).command,
    { kind: "settle", dead: ["A3"] });

  const shared = sessionFromStudyHash(new URL(studyLink(next.session, "https://weiqi.561.group")).hash);
  assert.equal(shared?.ok, true);
  if (!shared?.ok) return;
  assert.deepEqual(shared.session.state.result, next.session.state.result);
  assert.deepEqual(shared.session.commands, next.session.commands);
  const bookmark = new URL(playLink(next.session, "https://weiqi.561.group/play.html",
    { human: "black", bot: "influence", dead: [...next.deadPoints] }));
  assert.equal(bookmark.pathname, "/play.html");
  const params = new URLSearchParams(bookmark.hash.slice(1));
  assert.equal(params.has("commands"), true);
  assert.equal(params.has("moves"), false);
  assert.equal(params.get("dead"), String(a3));
  const reopened = sessionFromStudyHash(bookmark.hash);
  assert.equal(reopened?.ok, true);
  if (reopened?.ok) assert.deepEqual(reopened.session.state.result, next.session.state.result);
  const sgf = kernel.gameRecordToSgf(kernel.weiqiSessionToSgfRecord(next.session));
  assert.ok(sgf.includes("RE[W+7.5]"), sgf);
});

test("Accept count supports all-alive agreement and cannot run outside active scoring", () => {
  const allAlive = mountedCountButton(liveFixture());
  const accepted = allAlive.click();
  assert.equal(accepted.session.state.result?.by, "count");
  assert.deepEqual(accepted.session.state.result.dead, []);
  assert.equal(accepted.marking, false);
  assert.match(allAlive.resultEl.textContent, /0 stones agreed dead/);

  for (const flags of [
    { marking: false }, { finished: false }, { botThinking: true }, { CAPTURE_GO: true },
  ]) {
    const initial = liveFixture();
    const ui = mountedCountButton(initial, new Set(), flags);
    const result = ui.click();
    assert.equal(result.session, initial, "a guard must leave the session unchanged");
    assert.equal(result.marking, flags.marking ?? true);
    assert.equal(ui.calls.summaries, 0);
    assert.equal(ui.calls.renders, 0);
  }
});

test("Rejected dead-stone agreements do not close or overwrite provisional marking", () => {
  const session = liveFixture();
  // E5 is empty: only a real stone can be agreed dead.
  const empty = kernel.coordToPoint(5, 5, "E5");
  const ui = mountedCountButton(session, new Set([empty]));
  const result = ui.click();
  assert.equal(result.session, session);
  assert.equal(result.marking, true);
  assert.equal(result.session.state.result, null);
  assert.equal(ui.calls.events, 0);
  assert.equal(ui.calls.summaries, 0);
  assert.equal(ui.calls.renders, 0);
  assert.match(ui.calls.announcements.join(" "), /not accepted|not-a-stone/);
});


/** Exercise the actual Play render function for button availability. */
function renderedCountButton(session, {
  marking = false, finished = false, botThinking = false, CAPTURE_GO = false,
} = {}) {
  const acceptCountBtn = { hidden: true, disabled: true };
  const dependencies = {
    acceptCountBtn, session, marking, finished, botThinking, CAPTURE_GO, watchReelBtn: null, repriseBtn: null,
    kernel, openingError: null, humanColor: kernel.BLACK,
    keepGameLink() {},
    board: { setPosition() {}, setLegalityChecker() {} },
    passBtn: { disabled: false }, resignBtn: { disabled: false }, undoBtn: null,
    botSelect: { disabled: false }, boardSizeSelect: null, humanColorSelect: null,
    setStatus() {}, playerLabel() { return "Black"; },
  };
  new Function(...Object.keys(dependencies), renderSource + "\nrender();")(
    ...Object.values(dependencies));
  return { hidden: acceptCountBtn.hidden, disabled: acceptCountBtn.disabled };
}

test("Accept count becomes available only for the currently provisional normal game", () => {
  const provisional = liveFixture();
  assert.deepEqual(renderedCountButton(provisional, { marking: true, finished: true }),
    { hidden: false, disabled: false });
  assert.deepEqual(renderedCountButton(provisional, { marking: true, finished: true, botThinking: true }),
    { hidden: false, disabled: true });
  assert.deepEqual(renderedCountButton(provisional, { marking: true, finished: true, CAPTURE_GO: true }),
    { hidden: true, disabled: true });
  assert.deepEqual(renderedCountButton(provisional), { hidden: true, disabled: true });
  assert.deepEqual(renderedCountButton(provisional, { marking: true, finished: false }),
    { hidden: true, disabled: true }, "an inconsistent marking flag cannot show a live action");

  const final = kernel.admitWeiqiGameCommand(provisional, provisional.version,
    { kind: "settle", dead: [] });
  assert.equal(final.ok, true);
  if (final.ok) {
    assert.deepEqual(renderedCountButton(final.session, { marking: true, finished: true }),
      { hidden: true, disabled: true },
      "an accepted terminal result cannot be changed by reopening the score control");
  }
});

test("normal Play alone exposes a hidden-by-default Accept count control", async () => {
  const [play, capture] = await Promise.all([
    readFile(new URL("../public/play.html", import.meta.url), "utf8"),
    readFile(new URL("../public/learn/capture-go/index.html", import.meta.url), "utf8"),
  ]);
  assert.match(play, /id="accept-count-btn"[^>]*\bhidden\b[^>]*\bdisabled\b/);
  assert.doesNotMatch(capture, /id="accept-count-btn"/);
});

test("a settled local Go game offers the playable source-verified spectator reel", async () => {
  const html = await readFile(new URL("../public/play.html", import.meta.url), "utf8");
  assert.match(html, /id="watch-reel-btn"[^>]*hidden[^>]*disabled/);
  assert.match(source, /if \(watchReelBtn\) \{/);
  assert.match(source, /watchReelBtn\.hidden = !finished \|\| session\.version === 0/);
  assert.match(source, /watchReelBtn\.addEventListener\("click"/);
  assert.match(source, /params\.set\("moment", "0"\)/);
  const finishedGame = liveFixture();
  const accepted = kernel.admitWeiqiGameCommand(finishedGame, finishedGame.version,
    { kind: "settle", dead: [] });
  assert.equal(accepted.ok, true);
  if (!accepted.ok) return;
  const watched = studyLink(accepted.session, "https://weiqi.play.561.group/play.html");
  assert.equal(sessionFromStudyHash(new URL(watched).hash).ok, true);
  assert.equal(buildStudyReplay(accepted.session).frames.at(-1).command.kind, "settle");
});

test("postgame reprise opens a genuine legal branching point, never a new guessed game", async () => {
  const html = await readFile(new URL("../public/play.html", import.meta.url), "utf8");
  assert.match(html, /id="reprise-btn"[^>]*hidden[^>]*disabled/);
  assert.match(source, /kernel\.planReplayMoments\(accepted\.frames/);
  assert.match(source, /params\.set\("explore", "1"\)/);
  assert.match(source, /const from = best \? best\.version - 1/);
  const session = kernel.createWeiqiGameSession({ size: 9, ruleset: "chinese" }, [
    { kind: "play", move: "C3" }, { kind: "play", move: "C4" },
    { kind: "play", move: "B4" }, { kind: "play", move: "A1" },
    { kind: "play", move: "D4" }, { kind: "play", move: "A2" },
    { kind: "play", move: "C5" },
  ]);
  const studied = buildStudyReplay(session);
  const selected = kernel.planReplayMoments(studied.frames).find(x => x.kind === "capture");
  assert.ok(selected && selected.version > 0);
  const from = selected.version - 1;
  const link = new URL(studyLink(session, "https://weiqi.play.561.group/play.html"));
  const params = new URLSearchParams(link.hash.slice(1));
  params.set("moment", String(from));
  params.set("explore", "1");
  link.hash = params.toString();
  assert.equal(sessionFromStudyHash(link.hash).ok, true);
  assert.equal(params.get("moment"), String(from));
  assert.equal(params.get("explore"), "1");
  assert.ok(from < session.version);
});
