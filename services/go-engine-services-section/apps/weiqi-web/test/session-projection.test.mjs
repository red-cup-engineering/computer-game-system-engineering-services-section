import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as kernel from "../public/js/kernel/index.mjs";

test("the browser projection admits versioned play and exports its shared session as SGF", () => {
  const initial = kernel.createWeiqiGameSession({ size: 9, ruleset: "chinese" });
  const admitted = kernel.admitWeiqiGameCommand(initial, initial.version, {
    kind: "play",
    move: "C3",
  });

  assert.equal(admitted.ok, true);
  if (!admitted.ok) return;
  assert.equal(admitted.session.version, 1);
  assert.match(
    kernel.gameRecordToSgf(kernel.weiqiSessionToSgfRecord(admitted.session)),
    /;B\[cc\]/u,
  );
});


test("generated browser session refuses premature settlement after play resumes", () => {
  let session = kernel.createWeiqiGameSession({ size: 9, ruleset: "chinese" });
  for (const move of ["E5", "D4", "pass", "pass", "C3"]) {
    const command = move === "pass" ? { kind: "pass" } : { kind: "play", move };
    const admitted = kernel.admitWeiqiGameCommand(session, session.version, command);
    assert.equal(admitted.ok, true, `browser engine must admit ${move}`);
    if (!admitted.ok) return;
    session = admitted.session;
  }
  assert.equal(session.state.mainPhaseEnded, true);
  assert.equal(session.state.passStreak, 0);
  const settle = { kind: "settle", dead: [] };
  assert.deepEqual(kernel.admitWeiqiGameCommand(session, session.version, settle),
    { ok: false, reason: "main-phase-open" });
  for (const command of [{ kind: "pass" }, { kind: "pass" }]) {
    const admitted = kernel.admitWeiqiGameCommand(session, session.version, command);
    assert.equal(admitted.ok, true);
    if (!admitted.ok) return;
    session = admitted.session;
  }
  const accepted = kernel.admitWeiqiGameCommand(session, session.version, settle);
  assert.equal(accepted.ok, true);
  if (accepted.ok) assert.equal(accepted.session.state.result.by, "count");
});


test("browser engine reconciles duplicate dead marks with the exact counted stone set", () => {
  let session = kernel.createWeiqiGameSession({ size: 9, ruleset: "japanese" });
  for (const move of ["E5", "D4", "pass", "pass"]) {
    const admitted = kernel.admitWeiqiGameCommand(session, session.version,
      move === "pass" ? { kind: "pass" } : { kind: "play", move });
    assert.equal(admitted.ok, true, move);
    if (!admitted.ok) return;
    session = admitted.session;
  }

  const duplicates = kernel.admitWeiqiGameCommand(session, session.version,
    { kind: "settle", dead: [" e05 ", "D04", "E5", "d4"] });
  assert.equal(duplicates.ok, true);
  if (!duplicates.ok) return;
  const result = duplicates.session.state.result;
  assert.deepEqual(result.dead, ["D4", "E5"]);
  assert.deepEqual(result.score,
    kernel.scoreWeiqiSession(session, ["E5", "D4"]).score);
  assert.equal(result.score.blackPrisoners, 1);
  assert.equal(result.score.whitePrisoners, 1);
  assert.throws(() => kernel.scoreWeiqiSession(session, ["A1"]),
    /not an occupied stone/);
});



test("browser scorer and settlement require whole connected dead groups", () => {
  let session = kernel.createWeiqiGameSession({ size: 9, ruleset: "japanese" });
  for (const move of ["E5", "A1", "E6", "A2", "pass", "pass"]) {
    const result = kernel.admitWeiqiGameCommand(session, session.version,
      move === "pass" ? { kind: "pass" } : { kind: "play", move });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    session = result.session;
  }
  assert.deepEqual(kernel.admitWeiqiGameCommand(session, session.version,
    { kind: "settle", dead: ["E5"] }),
    { ok: false, reason: "incomplete-dead-group" });
  assert.throws(() => kernel.scoreWeiqiSession(session, ["E5"]),
    /complete connected group/);
  const accepted = kernel.admitWeiqiGameCommand(session, session.version,
    { kind: "settle", dead: ["E5", "E6"] });
  assert.equal(accepted.ok, true);
  if (!accepted.ok) return;
  assert.deepEqual(accepted.session.state.result.dead, ["E5", "E6"]);
  assert.equal(accepted.session.state.result.score.whitePrisoners, 2);
});


test("Play hands its admitted session to Study Replay without another game model", async () => {
  const [page, app] = await Promise.all([
    readFile(new URL("../public/play.html", import.meta.url), "utf8"),
    readFile(new URL("../public/js/play-app.mjs", import.meta.url), "utf8"),
  ]);

  assert.match(page, /id="study-game-btn"/u);
  assert.match(app, /location\.href = studyLink\(session, location\.href\)/u);
});
