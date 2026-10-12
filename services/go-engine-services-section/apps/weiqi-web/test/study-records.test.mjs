import { test } from "node:test";
import assert from "node:assert/strict";
import * as kernel from "../public/js/kernel/index.mjs";
import { buildStudyReplay, playLink, rulesetFromSgf, sessionFromCommands, sessionFromSgf, sessionFromStudyHash, studyLink } from "../public/js/study-replay.mjs";

const BASE = "https://weiqi.561.group/play.html";

test("an SGF is read through the engine's parser and replayed into a versioned session", () => {
  const result = sessionFromSgf("(;GM[1]FF[4]SZ[9]RU[Japanese]KM[6.5];B[cc];W[gg];B[];W[dd])");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.session.config.size, 9);
  assert.equal(result.session.config.ruleset, "japanese");
  assert.deepEqual(result.session.state.moves, ["C3", "G7", "pass", "D4"]);
  assert.deepEqual(result.notes, []);
});

test("SGF rules names map onto the engine's rulesets, and unknown ones are counted as Chinese with a note", () => {
  assert.deepEqual(rulesetFromSgf("Chinese"), { ruleset: "chinese", note: null });
  assert.equal(rulesetFromSgf("NZ").ruleset, "newzealand");
  assert.equal(rulesetFromSgf("GOE").ruleset, "ing");
  assert.equal(rulesetFromSgf("Korean").ruleset, "japanese");
  assert.match(rulesetFromSgf("Korean").note ?? "", /Japanese/);
  assert.equal(rulesetFromSgf("Martian").ruleset, "chinese");
  assert.match(rulesetFromSgf("Martian").note ?? "", /not known/);
  assert.match(rulesetFromSgf(undefined).note ?? "", /No rules named/);
  const komiNote = sessionFromSgf("(;GM[1]FF[4]SZ[9]RU[Chinese]KM[0.5];B[cc])");
  assert.equal(komiNote.ok, true);
  if (komiNote.ok) assert.match(komiNote.notes.join(" "), /komi 0\.5/);
});


test("Study refuses duplicate SGF root properties instead of silently choosing the last size", () => {
  const imported = sessionFromSgf("(;GM[1]FF[4]SZ[19]SZ[9];B[cc])");
  assert.equal(imported.ok, false,
    "a duplicate SGF board-size property must not silently change a 19x19 game into 9x9");
  if (!imported.ok) assert.match(imported.reason, /Duplicate SGF property SZ/);
});


test("an SGF the engine cannot replay is refused with the first offending move named", () => {
  const malformed = sessionFromSgf("this is not sgf");
  assert.equal(malformed.ok, false);
  const illegal = sessionFromSgf("(;GM[1]FF[4]SZ[9];B[cc];W[cc])");
  assert.equal(illegal.ok, false);
  if (!illegal.ok) assert.match(illegal.reason, /move 2 \(C3\) is occupied/);
  const setup = sessionFromSgf("(;GM[1]FF[4]SZ[9]AB[cc][gg];W[dd])");
  assert.equal(setup.ok, false, "without HA, AB stones are ambiguous setup rather than an admitted handicap");
  if (!setup.ok) assert.match(setup.reason, /setup|handicap|HA/);
  const outOfTurn = sessionFromSgf("(;GM[1]FF[4]SZ[9];W[cc])");
  assert.equal(outOfTurn.ok, false);
  if (!outOfTurn.ok) assert.match(outOfTurn.reason, /out of turn/);
});

test("a share link carries the accepted commands in its fragment and replays to the same session", () => {
  const built = sessionFromCommands({ size: 9, ruleset: "chinese" }, [{ kind: "play", move: "C3" }, { kind: "pass" }, { kind: "play", move: "G7" }]);
  assert.equal(built.ok, true);
  if (!built.ok) return;
  const link = studyLink(built.session, BASE);
  const url = new URL(link);
  assert.equal(url.pathname, "/review.html");
  assert.equal(url.search, "");
  const reopened = sessionFromStudyHash(url.hash);
  assert.ok(reopened && reopened.ok);
  if (!reopened || !reopened.ok) return;
  assert.deepEqual(reopened.session.state.moves, built.session.state.moves);
  assert.equal(kernel.materializeWeiqiGame(reopened.session).current.boardHash, kernel.materializeWeiqiGame(built.session).current.boardHash);
  assert.equal(sessionFromStudyHash(""), null);
  const tampered = sessionFromStudyHash("#size=9&ruleset=chinese&moves=C3.C3");
  assert.equal(tampered?.ok, false);
});


test("Study Replay imports the complete first SGF variation and preserves it in share links", () => {
  // Real-world SGF writers often put the continuation under the first
  // child when side variations exist. The Study page must not truncate
  // the main line to just the nodes before the branch.
  const sgf = "(;GM[1]FF[4]SZ[9]RU[Chinese];B[cc](;W[dd];B[ee])(;W[gg]))";
  const opened = sessionFromSgf(sgf);
  assert.equal(opened.ok, true, opened.ok ? undefined : opened.reason);
  if (!opened.ok) return;
  assert.deepEqual(opened.session.state.moves, ["C3", "D4", "E5"]);
  assert.equal(opened.session.version, 3);

  const share = studyLink(opened.session, BASE);
  const reopened = sessionFromStudyHash(new URL(share).hash);
  assert.equal(reopened?.ok, true);
  if (!reopened?.ok) return;
  assert.deepEqual(reopened.session.state.moves, opened.session.state.moves);
  assert.deepEqual(reopened.session.state.board, opened.session.state.board);
});


test("Study imports upstream fixed handicap, starts with White, and preserves stones in share links", () => {
  // 9x9 standard two-stone handicap: upper-right G7 and lower-left C3.
  const opened = sessionFromSgf("(;GM[1]FF[4]SZ[9]RU[Chinese]HA[2]AB[cc][gg];W[ee];B[dd])");
  assert.equal(opened.ok, true, opened.ok ? undefined : opened.reason);
  if (!opened.ok) return;
  assert.equal(opened.session.config.handicap, 2);
  assert.equal(opened.session.state.toMove, kernel.WHITE, "after W and B it is White to move");
  assert.deepEqual(opened.session.state.handicap, ["G7", "C3"]);
  assert.deepEqual(opened.session.state.moves, ["E5", "D4"]);
  const replay = buildStudyReplay(opened.session);
  assert.equal(replay.frames[0].toMove, kernel.WHITE);
  for (const stone of ["G7", "C3"]) {
    const point = kernel.coordToPoint(9, 9, stone);
    assert.equal(replay.frames[0].board[point], kernel.BLACK, `${stone} exists from frame zero`);
  }
  assert.equal(replay.frames.length, 3);
  assert.equal(replay.frames[1].mover, kernel.WHITE);

  const link = studyLink(opened.session, BASE);
  assert.equal(new URL(link).hash.includes("handicap=2"), true);
  const reopened = sessionFromStudyHash(new URL(link).hash);
  assert.equal(reopened?.ok, true);
  if (!reopened?.ok) return;
  assert.deepEqual(reopened.session.config, opened.session.config);
  assert.deepEqual(reopened.session.state, opened.session.state);
});

test("SGF round-trip consumes upstream 19x19 nine-stone placement, not a Study-side star table", () => {
  const config = { size: 19, ruleset: "japanese", handicap: 9 };
  const handicap = kernel.handicapStones(config);
  const sgf = kernel.gameRecordToSgf({
    size: 19, ruleset: "Japanese", komi: 6.5, handicap,
    moves: [{ color: kernel.WHITE, point: kernel.coordToPoint(19, 19, "K9") }],
  });
  const result = sessionFromSgf(sgf);
  assert.equal(result.ok, true, result.ok ? undefined : result.reason);
  if (!result.ok) return;
  assert.deepEqual(result.session.config, config);
  assert.deepEqual(result.session.state.handicap, handicap);
  assert.deepEqual(result.session.state.moves, ["K9"]);
  assert.deepEqual(kernel.materializeWeiqiGame(result.session).current.board.length, 19 * 19);
});

test("Study explicitly refuses nonstandard or conflicting SGF handicap claims", () => {
  const cases = [
    ["(;SZ[9]AB[cc][gg];W[ee])", /HA|setup|handicap/],
    ["(;SZ[9]HA[3]AB[cc][gg];W[ee])", /HA|count|stones/],
    ["(;SZ[9]HA[2]AB[cc][aa];W[ee])", /standard|fixed|handicap/],
    ["(;SZ[9]HA[2];W[ee])", /AB|placement|count/],
    ["(;SZ[9]HA[2]AB[cc][gg];B[ee])", /out of turn/],
    ["(;SZ[9]AW[cc];B[dd])", /setup/],
  ];
  for (const [sgf, error] of cases) {
    const result = sessionFromSgf(sgf);
    assert.equal(result.ok, false, sgf);
    if (!result.ok) assert.match(result.reason, error, sgf);
  }
});


test("Study link preserves a real resignation rather than reopening an unfinished game", () => {
  const config = { size: 9, ruleset: "chinese" };
  const commands = [
    { kind: "play", move: "C3" },
    { kind: "resign", color: kernel.WHITE },
  ];
  const built = sessionFromCommands(config, commands);
  assert.equal(built.ok, true);
  if (!built.ok) return;
  assert.equal(built.session.state.result.by, "resignation");
  const fragment = new URL(studyLink(built.session, BASE)).hash;
  const params = new URLSearchParams(fragment.slice(1));
  assert.equal(params.has("commands"), true, "terminal commands must carry the accepted record");
  assert.equal(params.has("moves"), false, "no second, diverging move list in the same link");
  assert.deepEqual(JSON.parse(params.get("commands")), commands);
  const reopened = sessionFromStudyHash(fragment);
  assert.equal(reopened?.ok, true);
  if (!reopened?.ok) return;
  assert.deepEqual(reopened.session.commands, built.session.commands);
  assert.deepEqual(reopened.session.state, built.session.state);
  const study = buildStudyReplay(reopened.session);
  assert.equal(study.frames.length, 3);
  assert.deepEqual(study.frames.at(-1)?.board, study.frames[1].board);
});

test("Study link preserves accepted settlement and its agreed dead stones", () => {
  const commands = [
    "B1", "D1", "B2", "D2", "B3", "D3", "B4", "D4", "B5", "D5",
    "pass", "A3", "pass", "pass",
  ].map(move => move === "pass" ? { kind: "pass" } : { kind: "play", move });
  commands.push({ kind: "settle", dead: ["a3"] });
  const built = sessionFromCommands({ size: 5, ruleset: "chinese" }, commands);
  assert.equal(built.ok, true, built.ok ? undefined : built.reason);
  if (!built.ok) return;
  const reopened = sessionFromStudyHash(new URL(studyLink(built.session, BASE)).hash);
  assert.equal(reopened?.ok, true, reopened?.ok ? undefined : reopened?.reason);
  if (!reopened?.ok) return;
  assert.equal(reopened.session.version, commands.length);
  assert.deepEqual(reopened.session.commands, built.session.commands);
  assert.deepEqual(reopened.session.state.result, built.session.state.result);
  assert.equal(reopened.session.state.result.by, "count");
  assert.deepEqual(reopened.session.state.result.dead, ["A3"]);
  assert.deepEqual(buildStudyReplay(reopened.session).frames.at(-1)?.events, []);
});

test("terminal share record retains upstream handicap and correct resignation color", () => {
  const commands = [
    { kind: "play", move: "E5" },
    { kind: "resign", color: kernel.BLACK },
  ];
  const built = sessionFromCommands({ size: 9, ruleset: "japanese", handicap: 2 }, commands);
  assert.equal(built.ok, true);
  if (!built.ok) return;
  const reopened = sessionFromStudyHash(new URL(studyLink(built.session, BASE)).hash);
  assert.equal(reopened?.ok, true);
  if (!reopened?.ok) return;
  assert.deepEqual(reopened.session.config, built.session.config);
  assert.deepEqual(reopened.session.commands, built.session.commands);
  assert.deepEqual(reopened.session.state.result, built.session.state.result);
});

test("legacy move-only Study and Play links remain unchanged", () => {
  const built = sessionFromCommands({ size: 9, ruleset: "chinese" }, [
    { kind: "play", move: "C3" }, { kind: "pass" }, { kind: "play", move: "G7" },
  ]);
  assert.equal(built.ok, true);
  if (!built.ok) return;
  const params = new URLSearchParams(new URL(studyLink(built.session, BASE)).hash.slice(1));
  assert.equal(params.get("moves"), "C3.pass.G7");
  assert.equal(params.has("commands"), false);
  assert.deepEqual(sessionFromStudyHash("#size=9&ruleset=chinese&moves=C3.pass.G7").session.commands,
    built.session.commands);
});

test("malformed and ambiguous terminal commands in share links are refused without throwing", () => {
  const links = [
    "#size=9&ruleset=chinese&commands=%7B",
    "#size=9&ruleset=chinese&commands=%7B%22kind%22%3A%22pass%22%7D",
    "#size=9&ruleset=chinese&commands=%5B%22pass%22%5D",
    "#size=9&ruleset=chinese&commands=%5B%7B%22kind%22%3A%22magic%22%7D%5D",
    "#size=9&ruleset=chinese&moves=C3&commands=%5B%5D",
    "#size=9&ruleset=chinese&commands=%5B%7B%22kind%22%3A%22play%22%2C%22move%22%3A%22C3%22%7D%2C%7B%22kind%22%3A%22play%22%2C%22move%22%3A%22C3%22%7D%5D",
  ];
  for (const hash of links) {
    let opened;
    assert.doesNotThrow(() => { opened = sessionFromStudyHash(hash); });
    assert.equal(opened?.ok, false, `unsafe or invalid commands accepted: ${hash}`);
  }
});


test("Play fragments keep terminal commands alongside independent UI preferences", () => {
  const built = sessionFromCommands({ size: 9, ruleset: "chinese" }, [
    { kind: "play", move: "C3" }, { kind: "resign", color: kernel.WHITE },
  ]);
  assert.equal(built.ok, true);
  if (!built.ok) return;
  const url = new URL(playLink(built.session, BASE, {
    human: "white", bot: "greedy", resigned: true,
  }));
  assert.equal(url.pathname, "/play.html");
  const params = new URLSearchParams(url.hash.slice(1));
  assert.equal(params.get("human"), "white");
  assert.equal(params.get("bot"), "greedy");
  assert.equal(params.get("resigned"), "1");
  assert.equal(params.has("moves"), false);
  assert.deepEqual(JSON.parse(params.get("commands")), built.session.commands);
  const restored = sessionFromStudyHash(url.hash);
  assert.equal(restored?.ok, true);
  if (!restored?.ok) return;
  assert.deepEqual(restored.session.state.result, built.session.state.result);
});
