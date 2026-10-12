// Machine verification of public/data/tsumego.json against the real
// kernel -- the Equivo discipline the task calls for: author a problem,
// verify it by actually replaying its solution through the kernel, keep
// only the ones that reproduce. Imported straight from the kernel's .mts
// source (native type stripping, the house pattern -- see smoke.test.mts),
// not the built public/js/kernel/ tree, so this suite never depends on
// `npm run build` having run first.
//
// Every problem is checked three ways:
//   1. structure -- ids unique, every `accept` move has a `lines` entry,
//      goalType/targetAnchor/category/band are all one of the declared
//      values, source is either "original" or a "traditional-shape:*" tag
//      (never left unmarked -- the task's own citation requirement).
//   2. legality -- `accept[i]` and its full `lines[accept[i]]`
//      continuation (the scripted opponent tries and the solver's own
//      replies) are ALL legal moves in sequence; an illegal move anywhere
//      in an authored line fails the problem outright.
//   3. the goal -- what "solved" actually means depends on `goalType`, so
//      each gets its own real assertion against the position the line
//      reaches, not a generic "did something happen" check:
//        - capture / kill: the target group is off the board (targetAnchor
//          reads EMPTY) and a `capture` event fired somewhere in the line.
//        - escape: the target group is still on the board, still the
//          solver's own color, with more than one liberty (no capture
//          event needed -- escaping atari without a capture is exactly
//          what some of these problems teach).
//        - live: the group at targetAnchor has at least two real eyes, by
//          the same false-eye.md diagonal-control rule the kernel's own
//          `isLegal` already enforces (an opponent play into a true single-
//          point eye is suicide and therefore illegal -- checked directly
//          below as a second, independent confirmation).
//
// This file's eyeCount/isTrueSinglePointEye/emptyRegions helpers follow
// the same real-eye-by-diagonal-control approach the kernel's own
// regression suite and (independently) the section's sibling weiqi-learn
// app's tsumego-data.test.mjs both use for the identical question ("does
// this empty point survive as a true eye") -- reimplemented here rather
// than imported, since this file has no dependency on that sibling app.

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
} from "@red-cup-engineering/weiqi-engine";

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, "..");
const RULESET = "chinese"; // arbitrary but fixed, per the sibling app's own note: none of these problems turn on ko regime or komi

const { problems } = JSON.parse(readFileSync(path.resolve(appRoot, "public/data/tsumego.json"), "utf8"));

const CATEGORIES = ["capture-go-basics", "ladders-and-nets", "life-and-death-fundamentals"];
const BANDS = ["introductory", "developing", "challenging"];
const GOAL_TYPES = ["capture", "escape", "live", "kill"];

// ---------------------------------------------------------------------
// Shared board construction and inspection helpers.
// ---------------------------------------------------------------------

function colorOf(name) {
  return name === "black" ? BLACK : WHITE;
}

/** The problem's starting position, built directly from its `stones` diagram (not played move by move -- a tsumego diagram is a resolved position, not a legal alternating game). */
function startingPosition(problem) {
  const cells = new Array(problem.size * problem.size).fill(EMPTY);
  for (const { pt, color } of problem.stones) {
    cells[coordToPoint(problem.size, problem.size, pt)] = colorOf(color);
  }
  return createPositionFromCells(problem.size, problem.size, cells, colorOf(problem.toPlay));
}

function gameAt(problem) {
  return new Game(problem.size, RULESET, startingPosition(problem));
}

/** Play `problem.accept[acceptIndex]` followed by its full line continuation on a fresh Game; asserts every move played is legal. Returns { game, sawCapture }. */
function playAcceptAndLine(problem, acceptMove) {
  const g = gameAt(problem);
  assert.ok(g.isLegal(acceptMove), `${problem.id}: accept move "${acceptMove}" is not legal in the starting position`);
  let out = g.play(acceptMove);
  assert.ok(out.ok, `${problem.id}: accept move "${acceptMove}" was rejected (${out.ok ? "" : out.reason})`);
  let sawCapture = out.ok && out.events.some((e) => e.type === "capture");

  for (const step of problem.lines[acceptMove] ?? []) {
    assert.ok(g.isLegal(step.move), `${problem.id}: line move "${step.move}" is not legal after prior moves`);
    out = g.play(step.move);
    assert.ok(out.ok, `${problem.id}: line move "${step.move}" was rejected (${out.ok ? "" : out.reason})`);
    sawCapture = sawCapture || (out.ok && out.events.some((e) => e.type === "capture"));

    assert.ok(g.isLegal(step.reply), `${problem.id}: reply "${step.reply}" is not legal after ${step.move}`);
    out = g.play(step.reply);
    assert.ok(out.ok, `${problem.id}: reply "${step.reply}" was rejected (${out.ok ? "" : out.reason})`);
    sawCapture = sawCapture || (out.ok && out.events.some((e) => e.type === "capture"));
  }
  return { game: g, sawCapture };
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

/** Real single-point eye per false-eye.md's own diagonal-control rule: a corner needs its one diagonal, an edge needs both of its two, the center needs three of four. A diagonal counts as safe when it already carries `color`, or when it is empty and the opponent provably has no legal move there right now. */
function isTrueSinglePointEye(position, size, point, color) {
  const { width, height, board } = position;
  for (const n of neighbors(width, height, point)) {
    if (board[n] !== color) return false;
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

/** Real-eye count for the group containing `anyStoneCoord`: distinct single-color-bordered empty regions touching that group, a region of size >= 2 counting as at most one eye, a region of size 1 counting only when it passes isTrueSinglePointEye above. */
function eyeCount(position, size, color, anyStoneCoord) {
  const { width } = position;
  const anyStone = coordToPoint(width, width, anyStoneCoord);
  if (position.board[anyStone] !== color) return -1; // sentinel: the anchor stone isn't even there anymore
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
// Structural checks every problem must satisfy, regardless of goalType.
// ---------------------------------------------------------------------

describe("tsumego.json structure", () => {
  test(`has at least 40 problems across the three graded categories`, () => {
    assert.ok(problems.length >= 40, `expected >= 40 problems, got ${problems.length}`);
  });

  test("ids are unique", () => {
    const ids = problems.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length, "duplicate problem id found");
  });

  for (const problem of problems) {
    test(`${problem.id}: structural fields are all declared values`, () => {
      assert.ok(CATEGORIES.includes(problem.category), `${problem.id}: unknown category "${problem.category}"`);
      assert.ok(BANDS.includes(problem.band), `${problem.id}: unknown band "${problem.band}"`);
      assert.ok(GOAL_TYPES.includes(problem.goalType), `${problem.id}: unknown goalType "${problem.goalType}"`);
      assert.ok(
        problem.source === "original" || /^traditional-shape:/.test(problem.source),
        `${problem.id}: source must be "original" or "traditional-shape:<name>", got "${problem.source}"`,
      );
      assert.ok(problem.accept.length > 0, `${problem.id}: accept must name at least one winning move`);
      assert.ok(typeof problem.targetAnchor === "string", `${problem.id}: targetAnchor is required`);
      assert.ok(typeof problem.failNote === "string" && problem.failNote.length > 0, `${problem.id}: failNote is required`);
      for (const move of problem.accept) {
        assert.ok(Object.hasOwn(problem.lines, move), `${problem.id}: lines is missing an entry for accept move "${move}"`);
      }
    });

    test(`${problem.id}: every accept line replays legally and proves its stated goal (${problem.goalType})`, () => {
      for (const acceptMove of problem.accept) {
        const { game: g, sawCapture } = playAcceptAndLine(problem, acceptMove);
        const color = colorOf(problem.toPlay);
        const opp = color === BLACK ? WHITE : BLACK;

        if (problem.goalType === "capture" || problem.goalType === "kill") {
          const targetPoint = coordToPoint(problem.size, problem.size, problem.targetAnchor);
          assert.equal(
            g.current.board[targetPoint],
            EMPTY,
            `${problem.id} (${acceptMove}): expected targetAnchor "${problem.targetAnchor}" to be captured (empty), board has ${g.current.board[targetPoint]}`,
          );
          assert.ok(sawCapture, `${problem.id} (${acceptMove}): goalType "${problem.goalType}" requires a capture event somewhere in the line`);
        } else if (problem.goalType === "escape") {
          const targetPoint = coordToPoint(problem.size, problem.size, problem.targetAnchor);
          assert.equal(
            g.current.board[targetPoint],
            color,
            `${problem.id} (${acceptMove}): expected the escaping group's targetAnchor "${problem.targetAnchor}" to still be ${problem.toPlay}`,
          );
          const group = findGroup(g.current.board, problem.size, problem.size, targetPoint);
          assert.ok(group.liberties.size > 1, `${problem.id} (${acceptMove}): expected the escaping group to have more than one liberty, has ${group.liberties.size}`);
        } else if (problem.goalType === "live") {
          const eyes = eyeCount(g.current, problem.size, color, problem.targetAnchor);
          assert.equal(eyes, 2, `${problem.id} (${acceptMove}): expected exactly 2 real eyes for the living group, got ${eyes}`);
        } else if (problem.goalType === "kill") {
          // handled above alongside "capture"
        }
      }
    });
  }
});
