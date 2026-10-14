import assert from "node:assert/strict";
import test from "node:test";
import * as kernel from "../public/js/kernel/index.mjs";
import { buildStudyReplay, describeRulesObservation } from "../public/js/review-app.mjs";
import { commandLabel, studyBranchAt, studyLink, sessionFromStudyHash } from "../public/js/study-replay.mjs";

function admittedSession(commands) {
  let session = kernel.createWeiqiGameSession({ size: 9, ruleset: "chinese" });
  for (const command of commands) {
    const outcome = kernel.admitWeiqiGameCommand(session, session.version, command);
    assert.equal(outcome.ok, true);
    if (!outcome.ok) throw new Error(outcome.reason);
    session = outcome.session;
  }
  return session;
}

test("Study Replay derives every board frame and observation from the accepted versioned session", () => {
  const session = admittedSession([
    { kind: "play", move: "C3" }, { kind: "play", move: "C4" },
    { kind: "play", move: "B4" }, { kind: "play", move: "A1" },
    { kind: "play", move: "D4" }, { kind: "play", move: "A2" },
    { kind: "play", move: "C5" },
  ]);
  const study = buildStudyReplay(session);

  assert.equal(study.version, session.version);
  assert.equal(study.frames.length, session.version + 1);
  assert.equal(study.frames[0].version, 0);
  assert.deepEqual(study.frames.at(-1)?.board, [...kernel.materializeWeiqiGame(session).current.board]);
  assert.equal(study.frames.at(-1)?.events.some((event) => event.type === "capture"), true);
});

test("Study Replay refuses a session whose command history is not replayable", () => {
  const session = admittedSession([{ kind: "play", move: "C3" }]);
  const invalid = { ...session, version: 2 };
  assert.throws(() => buildStudyReplay(invalid), /version/u);
});

test("rules observations are never labeled as engine analysis or move judgment", () => {
  assert.equal(describeRulesObservation({ type: "atari-given" }), "Rules observation: atari given.");
  assert.doesNotMatch(describeRulesObservation({ type: "capture" }), /engine|good|bad|best|mistake/ui);
});


/** Independent, intentionally slower admission-based oracle for the refactor.
 * Short fixtures only: production Study must NOT reconstruct each prefix. */
function admissionReplayFrames(session) {
  let prefix = kernel.createWeiqiGameSession(session.config);
  const initial = kernel.materializeWeiqiGame(prefix).current;
  const frames = [{ version: 0, board: [...initial.board], toMove: initial.toMove,
    command: null, mover: null, events: [] }];
  for (const command of session.commands) {
    const before = kernel.materializeWeiqiGame(prefix);
    const result = kernel.admitWeiqiGameCommand(prefix, prefix.version, command);
    assert.equal(result.ok, true);
    if (!result.ok) break;
    prefix = result.session;
    const after = kernel.materializeWeiqiGame(prefix);
    frames.push({
      version: prefix.version, board: [...after.current.board],
      toMove: after.current.toMove, command, mover: before.current.toMove,
      events: [...result.events],
    });
  }
  return frames;
}

test("Study frames and semantic observations equal authoritative admission across terminal and handicap games", () => {
  const fixtures = [
    { config: { size: 9, ruleset: "chinese" }, commands: [] },
    { config: { size: 9, ruleset: "chinese" }, commands: [
      { kind: "play", move: "C3" }, { kind: "play", move: "G7" },
      { kind: "pass" }, { kind: "pass" }, { kind: "settle", dead: [] },
    ] },
    { config: { size: 9, ruleset: "japanese", handicap: 2 }, commands: [
      { kind: "play", move: "E5" }, { kind: "play", move: "D4" },
      { kind: "pass" }, { kind: "pass" }, { kind: "settle", dead: [] },
    ] },
    { config: { size: 9, ruleset: "chinese" }, commands: [
      { kind: "play", move: "C3" }, { kind: "resign", color: kernel.WHITE },
    ] },
  ];
  for (const { config, commands } of fixtures) {
    const session = kernel.createWeiqiGameSession(config, commands);
    const study = buildStudyReplay(session);
    assert.deepEqual(study.frames, admissionReplayFrames(session),
      `Study drifted from engine admission for ${JSON.stringify(config)}`);
    assert.equal(study.frames.length, session.version + 1);
    assert.equal(Object.isFrozen(study.frames), true);
    assert.equal(Object.isFrozen(study.frames[0].board), true);
    assert.equal(Object.isFrozen(study.frames[0].events), true);
    if (config.handicap) {
      assert.equal(study.frames[0].toMove, kernel.WHITE);
      assert.equal(study.frames[0].board.filter((stone) => stone === kernel.BLACK).length, config.handicap);
    }
    if (commands.some((command) => command.kind === "settle" || command.kind === "resign")) {
      assert.deepEqual(study.frames.at(-1).board, study.frames.at(-2).board,
        "settlement and resignation do not alter the board");
      assert.deepEqual(study.frames.at(-1).events, []);
    }
  }
});

test("Study names resignations and settlement instead of saying played undefined", () => {
  assert.equal(commandLabel({ kind: "resign", color: kernel.WHITE }, kernel.BLACK), "White resigned");
  assert.equal(commandLabel({ kind: "resign", color: kernel.BLACK }, kernel.WHITE), "Black resigned");
  assert.equal(commandLabel({ kind: "settle", dead: [] }, kernel.WHITE), "Dead-stone count settled");
  assert.equal(commandLabel({ kind: "pass" }, kernel.BLACK), "Black passed");
  assert.equal(commandLabel({ kind: "play", move: "E5" }, kernel.WHITE), "White played E5");
});

test("Study can branch at any recorded move and play a distinct kernel-legal continuation", () => {
  const original = admittedSession([
    { kind: "play", move: "C3" }, { kind: "play", move: "G7" },
    { kind: "play", move: "D3" }, { kind: "play", move: "F7" },
  ]);
  const base = studyBranchAt(original, 2);
  assert.equal(base.version, 2);
  assert.deepEqual(base.commands, original.commands.slice(0, 2));
  const moved = kernel.admitWeiqiGameCommand(base, base.version, { kind: "play", move: "E4" });
  assert.equal(moved.ok, true);
  const variation = moved.session;
  assert.equal(variation.version, 3);
  assert.deepEqual(original.state.moves, ["C3", "G7", "D3", "F7"],
    "studying a different move cannot rewrite the recorded game");
  assert.notDeepEqual(variation.state.board, original.state.board);

  const replayed = kernel.createWeiqiGameSession(original.config, [
    ...original.commands.slice(0, 2), { kind: "play", move: "E4" },
  ]);
  assert.deepEqual(variation, replayed);
  const link = studyLink(variation, "https://weiqi.play.561.group/review.html");
  const opened = sessionFromStudyHash(new URL(link).hash);
  assert.equal(opened.ok, true);
  assert.deepEqual(opened.session.state.board, variation.state.board);
  assert.deepEqual(opened.session.commands, variation.commands);
  assert.throws(() => studyBranchAt(original, original.version + 1), /outside/);
  assert.throws(() => studyBranchAt(original, -1), /outside/);
});

test("Study branching preserves handicap and ko/superko history under the real selected rules", () => {
  const handicapped = kernel.createWeiqiGameSession({ size: 9, ruleset: "japanese", handicap: 2 }, [
    { kind: "play", move: "E5" }, { kind: "play", move: "D4" },
  ]);
  const branch = studyBranchAt(handicapped, 1);
  const before = kernel.materializeWeiqiGame(branch);
  assert.equal(before.current.toMove, kernel.BLACK);
  assert.equal(branch.config.handicap, 2);
  assert.equal(before.current.board.filter(v => v === kernel.BLACK).length, 2,
    "the original handicap setup remains in the accepted rules state");
  assert.deepEqual(kernel.materializeWeiqiGame(branch).current.board,
    kernel.materializeWeiqiGame(kernel.createWeiqiGameSession(handicapped.config, handicapped.commands.slice(0, 1))).current.board);
});

test("variation controls belong to the currently loaded game and do not resurrect old events", async () => {
  const { readFile } = await import("node:fs/promises");
  const app = await readFile(new URL("../public/js/review-app.mjs", import.meta.url), "utf8");
  const html = await readFile(new URL("../public/review.html", import.meta.url), "utf8");
  for (const id of ["variation-explore", "variation-pass", "variation-undo", "variation-return", "variation-status"]) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(app, /studyBranchAt\(recordedSession, currentVersion\)/);
  assert.match(app, /admitWeiqiGameCommand\(branch, branch.version, command\)/);
  assert.match(app, /branch.version > branchBase/);
  assert.match(app, /activeStudy\?\.dispose\(\)/);
  assert.match(app, /previous\.onclick =/);
  assert.match(app, /scrubber\.oninput =/);
  assert.match(app, /activeStudy\.selectedSession\(\)/);
});

test("the accepted game drives the spectator's selected moments in the same generated engine", () => {
  const session = admittedSession([
    { kind: "play", move: "C3" }, { kind: "play", move: "C4" },
    { kind: "play", move: "B4" }, { kind: "play", move: "A1" },
    { kind: "play", move: "D4" }, { kind: "play", move: "A2" },
    { kind: "play", move: "C5" },
  ]);
  const source = buildStudyReplay(session);
  const moments = kernel.planReplayMoments(source.frames);
  assert.equal(moments[0].version, 0);
  assert.ok(moments.some(moment => moment.kind === "capture"));
  assert.equal(moments.at(-1).version, session.version);
  for (const moment of moments) {
    assert.deepEqual(source.frames[moment.version].board,
      buildStudyReplay(session).frames[moment.version].board);
  }
});

test("cinematic replay controls reuse Study's original engine/timeline and clean up on import", async () => {
  const { readFile } = await import("node:fs/promises");
  const app = await readFile(new URL("../public/js/review-app.mjs", import.meta.url), "utf8");
  const html = await readFile(new URL("../public/review.html", import.meta.url), "utf8");
  for (const id of ["reel-play-btn", "reel-stop-btn", "reel-audio-btn", "reel-share-btn",
    "reel-speed", "reel-progress", "reel-status", "reel-beats"]) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(app, /kernel\.planReplayMoments\(study\.frames/);
  assert.match(app, /select\(beat\.version, \{ fromReel: true \}\)/);
  assert.match(app, /new WeiqiSound\(\)/);
  assert.match(app, /stopReel\(\)/);
  assert.match(app, /board\.destroy\(\)/);
  assert.match(app, /params\.set\("moment", String\(currentVersion\)\)/);
  assert.match(app, /document\.addEventListener\("visibilitychange"/);
});
