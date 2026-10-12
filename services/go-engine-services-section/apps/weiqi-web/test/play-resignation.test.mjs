import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import * as kernel from "../public/js/kernel/index.mjs";
import { buildStudyReplay, playLink, sessionFromStudyHash, studyLink } from "../public/js/study-replay.mjs";

// Execute the actual shipped click handler with narrowly mocked DOM controls.
// This tests the wiring, not merely a hypothetical kernel resignation call.
// No browser APIs, network, or alternative game model are introduced.
const pageSource = await readFile(new URL("../public/js/play-app.mjs", import.meta.url), "utf8");
const begin = pageSource.indexOf('resignBtn.addEventListener("click", () => {');
const end = pageSource.indexOf("\n});", begin);
if (begin < 0 || end < 0) throw new Error("Play's resignation button listener was not found");
const listenerSource = pageSource.slice(begin, end + 4);

function mountedResignButton(initialSession, { humanColor = kernel.BLACK, finished = false, botThinking = false } = {}) {
  let callback = null;
  const calls = { summaries: 0, sound: 0, renders: 0, announcements: [] };
  const resignBtn = {
    addEventListener(event, fn) {
      assert.equal(event, "click");
      assert.equal(callback, null, "resignation listener must be bound exactly once");
      callback = fn;
    },
  };
  const resultEl = { hidden: true, textContent: "" };
  const deps = {
    resignBtn, kernel, session: initialSession, humanColor, finished,
    botThinking, resigned: false, marking: false, resultEl,
    showConceptSummary() { calls.summaries++; },
    sound: { playGameEnd() { calls.sound++; } },
    render() { calls.renders++; },
    board: { announce(text) { calls.announcements.push(text); } },
    colorName(color) { return color === kernel.BLACK ? "Black" : "White"; },
    opponentOf(color) { return color === kernel.BLACK ? kernel.WHITE : kernel.BLACK; },
  };
  const factory = new Function(...Object.keys(deps), listenerSource + `
    return { state() { return { session, finished, resigned, marking }; } };
  `);
  const mounted = factory(...Object.values(deps));
  return {
    click() { assert.equal(typeof callback, "function"); callback(); return mounted.state(); },
    state: mounted.state, calls, resultEl,
  };
}

test("Play's Black Resign button produces an accepted terminal engine command, Study replay, and SGF result", () => {
  const session = kernel.createWeiqiGameSession({ size: 9, ruleset: "chinese" });
  const ui = mountedResignButton(session);
  const state = ui.click();
  assert.equal(state.finished, true);
  assert.equal(state.resigned, true);
  assert.equal(state.marking, false);
  assert.equal(state.session.version, 1);
  assert.deepEqual(state.session.commands, [{ kind: "resign", color: kernel.BLACK }]);
  assert.deepEqual(state.session.state.result,
    { by: "resignation", winner: kernel.WHITE, loser: kernel.BLACK });
  assert.equal(ui.resultEl.hidden, false);
  assert.match(ui.resultEl.textContent, /White wins/);
  assert.equal(ui.calls.summaries, 1);
  assert.equal(ui.calls.sound, 1);
  assert.equal(ui.calls.renders, 1);

  const link = studyLink(state.session, "https://weiqi.561.group/play.html");
  assert.match(link, /commands=/);
  const reopened = sessionFromStudyHash(new URL(link).hash);
  assert.equal(reopened?.ok, true);
  if (!reopened?.ok) return;
  assert.deepEqual(reopened.session.commands, state.session.commands);
  assert.deepEqual(reopened.session.state.result, state.session.state.result);
  // Play's actual "Keep this game link" adds UI preferences to the same
  // accepted engine-command fragment, never a replacement resignation state.
  const bookmark = new URL(playLink(state.session, "https://weiqi.561.group/play.html",
    { human: "black", bot: "influence", resigned: state.resigned }));
  const bookmarkParams = new URLSearchParams(bookmark.hash.slice(1));
  assert.equal(bookmark.pathname, "/play.html");
  assert.equal(bookmarkParams.get("resigned"), "1");
  assert.equal(bookmarkParams.has("commands"), true);
  assert.deepEqual(sessionFromStudyHash(bookmark.hash).session.state.result,
    state.session.state.result);
  const replay = buildStudyReplay(reopened.session);
  assert.equal(replay.frames.length, 2);
  assert.deepEqual(replay.frames.at(-1).command, { kind: "resign", color: kernel.BLACK });

  const sgf = kernel.gameRecordToSgf(kernel.weiqiSessionToSgfRecord(state.session));
  assert.match(sgf, /RE\[W\+R\]/);
});

test("Play's White Resign button records its own color even off-turn", () => {
  const session = kernel.createWeiqiGameSession({ size: 9, ruleset: "chinese" });
  assert.equal(session.state.toMove, kernel.BLACK);
  const ui = mountedResignButton(session, { humanColor: kernel.WHITE });
  const next = ui.click();
  assert.equal(next.session.version, 1);
  assert.deepEqual(next.session.commands, [{ kind: "resign", color: kernel.WHITE }]);
  assert.deepEqual(next.session.state.result,
    { by: "resignation", winner: kernel.BLACK, loser: kernel.WHITE });
  assert.match(kernel.gameRecordToSgf(kernel.weiqiSessionToSgfRecord(next.session)), /RE\[B\+R\]/);
});

test("Resign refuses guarded or rejected actions without inventing a winner", () => {
  const initial = kernel.createWeiqiGameSession({ size: 9, ruleset: "chinese" });
  for (const option of [{ finished: true }, { botThinking: true }]) {
    const ui = mountedResignButton(initial, option);
    const state = ui.click();
    assert.equal(state.session, initial);
    assert.equal(state.resigned, false);
    assert.equal(ui.calls.summaries, 0);
    assert.equal(ui.calls.sound, 0);
  }
  const already = kernel.admitWeiqiGameCommand(initial, 0,
    { kind: "resign", color: kernel.WHITE });
  assert.equal(already.ok, true);
  if (!already.ok) return;
  // Deliberately inconsistent local flag: the upstream session must win.
  const ui = mountedResignButton(already.session);
  const state = ui.click();
  assert.equal(state.session, already.session);
  assert.equal(state.resigned, false);
  assert.equal(state.finished, false);
  assert.equal(ui.calls.summaries, 0);
  assert.equal(ui.calls.sound, 0);
  assert.equal(ui.resultEl.hidden, true);
  assert.match(ui.calls.announcements.join(" "), /not accepted|game-ended/i);
});
