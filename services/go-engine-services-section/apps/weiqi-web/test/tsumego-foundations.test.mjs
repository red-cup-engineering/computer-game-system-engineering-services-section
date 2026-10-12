// Machine verification of public/data/tsumego-foundations.json against the real
// kernel package rather than the built public/lib/kernel/ tree, so this suite never depends on
// `npm run build` having been run first.
//
// Every problem is checked the same three ways:
//   1. every move named in `accept` is legal in the problem's starting
//      position;
//   2. replaying `accept[i]` followed by its `lines[accept[i]]` continuation
//      (auto-playing each line step's opponent `move`, then the solver's
//      `reply`) only ever plays legal moves;
//   3. the position that continuation reaches actually proves the goal —
//      a capture happened, a group has two real eyes (by liberty/region
//      inspection, not merely a leftover marker), a single eye is true or
//      false by false-eye.md's own diagonal-control rule, or a score
//      difference nets out the way the problem's prose claims.
//
// (3) is necessarily set-specific — "two eyes" and "the biggest point" are
// different claims about the board — so each set gets its own assertion
// helper below, built once and applied per problem, rather than one generic
// check papering over what's actually being proven.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  Game,
  createPositionFromCells,
  BLACK,
  WHITE,
  EMPTY,
  coordToPoint,
  pointToCoord,
  neighbors,
  findGroup,
  getRuleset,
  scoreArea,
  scoreTerritory,
} from "@red-cup-engineering/weiqi-engine";

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, "..");
const RULESET = "chinese"; // arbitrary but fixed — none of these problems turn on ko regime or komi

const { problems } = JSON.parse(readFileSync(path.resolve(appRoot, "public/data/tsumego-foundations.json"), "utf8"));

// ---------------------------------------------------------------------
// Shared board construction and inspection helpers.
// ---------------------------------------------------------------------

function colorOf(name) {
  return name === "black" ? BLACK : WHITE;
}

/** The problem's starting position, built directly from its `stones` diagram (not played move by move — a tsumego diagram is a resolved position, not a legal alternating game). */
function startingPosition(problem) {
  const cells = new Array(problem.size * problem.size).fill(EMPTY);
  for (const { pt, color } of problem.stones) {
    cells[coordToPoint(problem.size, problem.size, pt)] = colorOf(color);
  }
  return createPositionFromCells(problem.size, problem.size, cells, colorOf(problem.toPlay));
}

function gameAt(problem, position) {
  return new Game(problem.size, RULESET, position);
}

/** Play `problem.accept[acceptIndex]` followed by its full line continuation on a fresh Game; asserts every move played is legal. Returns the Game at the end of the line. */
function playAcceptAndLine(t, problem, acceptMove) {
  const g = gameAt(problem, startingPosition(problem));
  assert.ok(g.isLegal(acceptMove), `${problem.id}: accept move "${acceptMove}" is not legal in the starting position`);
  let out = g.play(acceptMove);
  assert.ok(out.ok, `${problem.id}: accept move "${acceptMove}" was rejected (${out.ok ? "" : out.reason})`);

  for (const step of problem.lines[acceptMove]) {
    assert.ok(g.isLegal(step.move), `${problem.id}: line move "${step.move}" is not legal after ${acceptMove}`);
    out = g.play(step.move);
    assert.ok(out.ok, `${problem.id}: line move "${step.move}" was rejected (${out.ok ? "" : out.reason})`);

    assert.ok(g.isLegal(step.reply), `${problem.id}: reply "${step.reply}" is not legal after ${step.move}`);
    out = g.play(step.reply);
    assert.ok(out.ok, `${problem.id}: reply "${step.reply}" was rejected (${out.ok ? "" : out.reason})`);
  }
  return g;
}

/** Every capture-type SemanticEvent detail across a play()/Game outcome trail, keyed by nothing in particular — just flattened for "did a capture happen" checks. */
function collectEvents(events, type) {
  return events.filter((e) => e.type === type);
}

function diagonals(width, height, point) {
  const col = point % width;
  const row = Math.floor(point / width);
  const out = [];
  for (const [dc, dr] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const c = col + dc;
    const r = row + dr;
    if (c >= 0 && c < width && r >= 0 && r < height) out.push(r * width + c);
  }
  return out;
}

/**
 * Real single-point eye per false-eye.md's own diagonal-control rule: a
 * corner needs its one diagonal, an edge needs both of its two, the center
 * needs three of four. A diagonal counts as safe when it already carries
 * `color`, or when it is empty and the opponent provably has no legal move
 * there right now (checked with isLegal on a scratch Game forced to the
 * opponent's turn, not merely assumed from the diagram).
 */
function isTrueSinglePointEye(position, size, point, color) {
  const { width, height, board } = position;
  for (const n of neighbors(width, height, point)) {
    if (board[n] !== color) return false; // not even orthogonally enclosed — not an eye at all
  }
  const opp = color === BLACK ? WHITE : BLACK;
  const diags = diagonals(width, height, point);
  const required = diags.length === 4 ? 3 : diags.length;
  let safe = 0;
  for (const d of diags) {
    if (board[d] === color) {
      safe++;
      continue;
    }
    if (board[d] === EMPTY) {
      const forced = createPositionFromCells(width, height, board, opp);
      const scratch = new Game(size, RULESET, forced);
      if (!scratch.isLegal(pointToCoord(width, d))) safe++;
    }
  }
  return safe >= required;
}

/** Connected empty regions of `position`, each with the set of stone colors bordering it. */
function emptyRegions(position) {
  const { width, height, board } = position;
  const visited = new Uint8Array(board.length);
  const regions = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== EMPTY || visited[i]) continue;
    const pts = [i];
    visited[i] = 1;
    const stack = [i];
    const borders = new Set();
    while (stack.length) {
      const p = stack.pop();
      for (const n of neighbors(width, height, p)) {
        const c = board[n];
        if (c === EMPTY) {
          if (!visited[n]) {
            visited[n] = 1;
            stack.push(n);
            pts.push(n);
          }
        } else {
          borders.add(c);
        }
      }
    }
    regions.push({ pts, borders });
  }
  return regions;
}

/**
 * Real-eye count for the group containing `anyStoneCoord`: distinct
 * single-color-bordered empty regions touching that group, a region of
 * size >= 2 counting as at most one eye (no internal stone subdivides it —
 * "one big eye is one eye" at this scale, see ending-the-game.md's
 * settlement discussion), a region of size 1 counting only when it passes
 * isTrueSinglePointEye above.
 */
function eyeCount(position, size, color, anyStoneCoord) {
  const { width } = position;
  const anyStone = coordToPoint(width, width, anyStoneCoord);
  const group = findGroup(position.board, width, width, anyStone);
  const groupSet = new Set(group.stones);
  let eyes = 0;
  for (const region of emptyRegions(position)) {
    if (region.borders.size !== 1 || !region.borders.has(color)) continue;
    const touchesGroup = region.pts.some((p) => neighbors(width, width, p).some((n) => groupSet.has(n)));
    if (!touchesGroup) continue;
    if (region.pts.length === 1) {
      if (isTrueSinglePointEye(position, size, region.pts[0], color)) eyes++;
    } else {
      eyes++;
    }
  }
  return eyes;
}

// ---------------------------------------------------------------------
// Structural checks every problem must satisfy, regardless of set.
// ---------------------------------------------------------------------

describe("tsumego-foundations.json structure", () => {
  test("has twelve problems in the three graded sets the corpus's concept clusters name", () => {
    assert.equal(problems.length, 12);
    const bySet = {};
    for (const p of problems) bySet[p.set] = (bySet[p.set] ?? 0) + 1;
    assert.deepEqual(bySet, { capture: 4, "life-and-death": 5, endgame: 3 });
  });

  test("ids are unique", () => {
    const ids = problems.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  for (const problem of problems) {
    test(`${problem.id}: every accept move is legal in the starting position, and its full line replays legally`, () => {
      assert.ok(problem.accept.length > 0, "accept must name at least one winning move");
      for (const move of problem.accept) {
        assert.ok(Object.hasOwn(problem.lines, move), `lines is missing an entry for accept move "${move}"`);
        playAcceptAndLine(null, problem, move); // throws (via assert) on any illegality
      }
    });
  }
});

// ---------------------------------------------------------------------
// capture: each accept line must actually resolve the stated capture, or
// (extend-to-safety) must escape atari without one.
// ---------------------------------------------------------------------

describe("capture set", () => {
  const bySet = problems.filter((p) => p.set === "capture");
  assert.equal(bySet.length, 4);

  test("capture-atari: E4 captures the lone White stone at D4", () => {
    const g = playAcceptAndLine(null, bySet.find((p) => p.id === "capture-atari"), "E4");
    assert.equal(g.current.board[coordToPoint(7, 7, "D4")], EMPTY);
    assert.equal(collectEvents(g.moveEvents.at(-1), "capture").length, 1);
  });

  test("capture-pair: F4 captures both White stones at once", () => {
    const g = playAcceptAndLine(null, bySet.find((p) => p.id === "capture-pair"), "F4");
    const capture = collectEvents(g.moveEvents.at(-1), "capture")[0];
    assert.equal(capture.detail.stonesCaptured, 2);
    assert.equal(g.current.board[coordToPoint(7, 7, "D4")], EMPTY);
    assert.equal(g.current.board[coordToPoint(7, 7, "E4")], EMPTY);
  });

  test("capture-escape-by-capture: F4 captures White's G4 stone and leaves Black's E4 group with liberties to spare", () => {
    const problem = bySet.find((p) => p.id === "capture-escape-by-capture");
    const g = playAcceptAndLine(null, problem, "F4");
    const events = g.moveEvents.at(-1);
    assert.equal(collectEvents(events, "capture").length, 1);
    assert.ok(collectEvents(events, "atari-escaped").length >= 1, "expected an atari-escaped event");
    const group = findGroup(g.current.board, 7, 7, coordToPoint(7, 7, "E4"));
    assert.ok(group.liberties.size > 1, `expected Black's group to have escaped atari, has ${group.liberties.size} liberties`);
  });

  test("capture-escape-by-extension: A6 escapes atari without capturing anything", () => {
    const problem = bySet.find((p) => p.id === "capture-escape-by-extension");
    const g = playAcceptAndLine(null, problem, "A6");
    const events = g.moveEvents.at(-1);
    assert.equal(collectEvents(events, "capture").length, 0, "this problem is extend-to-safety, not capture");
    assert.ok(collectEvents(events, "atari-escaped").length >= 1, "expected an atari-escaped event");
    const group = findGroup(g.current.board, 7, 7, coordToPoint(7, 7, "A6"));
    assert.ok(group.liberties.size > 1, `expected Black's group to have escaped atari, has ${group.liberties.size} liberties`);
  });
});

// ---------------------------------------------------------------------
// life-and-death: the split-* / deny-* pairs are checked by eye count on
// the group named by the problem's own stones; the false-eye problem is
// checked by isTrueSinglePointEye directly, before and after.
// ---------------------------------------------------------------------

describe("life-and-death set", () => {
  const bySet = problems.filter((p) => p.set === "life-and-death");
  assert.equal(bySet.length, 5);

  test("life-death-split-straight: B7 gives Black's group two real eyes, and White has no legal way to contest either", () => {
    const problem = bySet.find((p) => p.id === "life-death-split-straight");
    const g = playAcceptAndLine(null, problem, "B7");
    assert.equal(eyeCount(g.current, 7, BLACK, "A6"), 2);
    assert.equal(g.isLegal("A7"), false, "White playing into the first eye should be suicide, hence illegal");
    assert.equal(g.isLegal("C7"), false, "White playing into the second eye should be suicide, hence illegal");
  });

  test("life-death-deny-straight: B7 leaves White with zero real eyes from its only eye space", () => {
    const problem = bySet.find((p) => p.id === "life-death-deny-straight");
    const afterVital = gameAt(problem, startingPosition(problem));
    afterVital.play("B7");
    assert.equal(eyeCount(afterVital.current, 7, WHITE, "A6"), 0);

    // The scripted line: White resists by trying to capture the invader,
    // which only costs White its own last liberties.
    const g = playAcceptAndLine(null, problem, "B7");
    assert.equal(g.current.board[coordToPoint(7, 7, "D7")], EMPTY, "White's whole wall should have been captured");
    const capture = collectEvents(g.moveEvents.at(-1), "capture")[0];
    assert.equal(capture.detail.groupsCaptured, 1);
    assert.ok(capture.detail.stonesCaptured >= 6, "expected the entire White wall to go in one capture");
  });

  test("life-death-false-eye: A1's diagonal is false before the capture and true after it", () => {
    const problem = bySet.find((p) => p.id === "life-death-false-eye");
    const before = startingPosition(problem);
    const a1 = coordToPoint(7, 7, "A1");
    assert.equal(isTrueSinglePointEye(before, 7, a1, BLACK), false, "A1 should start false — White holds the corner's only diagonal");

    const g = playAcceptAndLine(null, problem, "B3");
    assert.equal(g.current.board[coordToPoint(7, 7, "B2")], EMPTY, "the diagonal stone should have been captured");
    assert.equal(isTrueSinglePointEye(g.current, 7, a1, BLACK), true, "A1 should now be a true eye");
    assert.equal(g.isLegal("B2"), false, "White should have no legal way back into the vacated diagonal");
  });

  test("life-death-split-bent: G7 gives Black's group two real eyes, and White has no legal way to contest either", () => {
    const problem = bySet.find((p) => p.id === "life-death-split-bent");
    const g = playAcceptAndLine(null, problem, "G7");
    assert.equal(eyeCount(g.current, 7, BLACK, "E6"), 2);
    assert.equal(g.isLegal("F7"), false);
    assert.equal(g.isLegal("G6"), false);
  });

  test("life-death-deny-bent: G7 leaves White with zero real eyes from its only eye space", () => {
    const problem = bySet.find((p) => p.id === "life-death-deny-bent");
    const afterVital = gameAt(problem, startingPosition(problem));
    afterVital.play("G7");
    assert.equal(eyeCount(afterVital.current, 7, WHITE, "E6"), 0);

    const g = playAcceptAndLine(null, problem, "G7");
    const capture = collectEvents(g.moveEvents.at(-1), "capture")[0];
    assert.equal(capture.detail.groupsCaptured, 1);
    assert.ok(capture.detail.stonesCaptured >= 6, "expected the entire White wall to go in one capture");
  });
});

// ---------------------------------------------------------------------
// endgame: each claim is a score comparison, checked with the kernel's own
// scoreArea/scoreTerritory over the reached position(s).
// ---------------------------------------------------------------------

describe("endgame set", () => {
  const bySet = problems.filter((p) => p.set === "endgame");
  assert.equal(bySet.length, 3);
  const ruleset = getRuleset(RULESET);

  test("endgame-biggest-point: capturing at E2 outscores filling the lone dame at G7", () => {
    const problem = bySet.find((p) => p.id === "endgame-biggest-point");

    const capture = playAcceptAndLine(null, problem, "E2");
    const captureScore = scoreArea(capture.current, ruleset);

    const dameOnly = gameAt(problem, startingPosition(problem));
    const dameOut = dameOnly.play("G7");
    assert.ok(dameOut.ok);
    const dameScore = scoreArea(dameOnly.current, ruleset);

    assert.ok(
      captureScore.blackScore - captureScore.whiteScore > dameScore.blackScore - dameScore.whiteScore,
      `expected capturing to net a better margin than the dame fill: capture=${captureScore.margin}, dame=${dameScore.margin}`,
    );
  });

  test("endgame-dame: filling A1 shifts area scoring by a point per side but never touches territory scoring", () => {
    const problem = bySet.find((p) => p.id === "endgame-dame");
    const empty = startingPosition(problem);
    const emptyTerritory = scoreTerritory(empty, ruleset);
    const emptyArea = scoreArea(empty, ruleset);

    const blackFills = playAcceptAndLine(null, problem, "A1");
    const blackTerritory = scoreTerritory(blackFills.current, ruleset);
    const blackArea = scoreArea(blackFills.current, ruleset);

    const whiteFills = new Game(
      problem.size,
      RULESET,
      createPositionFromCells(
        problem.size,
        problem.size,
        startingPosition(problem).board,
        WHITE,
      ),
    );
    whiteFills.play("A1");
    const whiteTerritory = scoreTerritory(whiteFills.current, ruleset);
    const whiteArea = scoreArea(whiteFills.current, ruleset);

    assert.equal(emptyTerritory.margin, blackTerritory.margin, "dame left empty vs. filled by Black should score identically under territory scoring");
    assert.equal(emptyTerritory.margin, whiteTerritory.margin, "dame left empty vs. filled by White should score identically under territory scoring");

    assert.equal(emptyArea.blackScore + 1, blackArea.blackScore, "Black filling the dame should gain exactly one area-scoring point");
    assert.equal(
      blackArea.blackScore - blackArea.whiteScore - (whiteArea.blackScore - whiteArea.whiteScore),
      2,
      "the two fills should differ by exactly two area-scoring points of margin",
    );
  });

  test("endgame-recognize-the-finish: passing preserves the score; self-filling A1 costs a point under territory scoring but nothing under area scoring", () => {
    const problem = bySet.find((p) => p.id === "endgame-recognize-the-finish");
    const pass = playAcceptAndLine(null, problem, "pass");
    const passTerritory = scoreTerritory(pass.current, ruleset);
    const passArea = scoreArea(pass.current, ruleset);

    const fill = gameAt(problem, startingPosition(problem));
    assert.ok(fill.isLegal("A1"));
    fill.play("A1");
    const fillTerritory = scoreTerritory(fill.current, ruleset);
    const fillArea = scoreArea(fill.current, ruleset);

    assert.equal(passTerritory.blackScore - 1, fillTerritory.blackScore, "self-filling settled territory should cost exactly one territory-scoring point");
    assert.equal(passArea.blackScore, fillArea.blackScore, "self-filling settled territory should not change the area score");
  });
});

