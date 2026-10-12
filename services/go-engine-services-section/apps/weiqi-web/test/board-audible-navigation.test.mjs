import assert from "node:assert/strict";
import { test } from "node:test";
import { describeBoardIntersection, nextBoardCursor } from "../public/js/board.mjs";

test("keyboard board reading announces stone colors, not coordinates alone", () => {
  const board = new Uint8Array(9 * 9);
  board[4 * 9 + 4] = 1;
  board[4 * 9 + 5] = 2;
  assert.equal(describeBoardIntersection(board, 9, 0, 0), "Cursor at A1: empty intersection.");
  assert.equal(describeBoardIntersection(board, 9, 4, 4), "Cursor at E5: black stone.");
  assert.equal(describeBoardIntersection(board, 9, 5, 4), "Cursor at F5: white stone.");
});

test("board reading distinguishes last move, ko, and marked-dead stones", () => {
  const board = new Uint8Array(9 * 9);
  board[3 * 9 + 2] = 2;
  assert.equal(describeBoardIntersection(board, 9, 2, 3, {
    lastMoveCoord: "C4", koCoord: "C4", deadCoords: ["C4"],
  }), "Cursor at C4: white stone; last move, ko marker, marked dead.");
  assert.equal(describeBoardIntersection(board, 9, 0, 0, { koCoord: "A1" }),
    "Cursor at A1: empty intersection; ko marker.");
});

test("invalid board geometry cannot silently announce the wrong intersection", () => {
  assert.throws(() => describeBoardIntersection(new Uint8Array(81), 9, 9, 0), /outside/u);
  assert.throws(() => describeBoardIntersection(new Uint8Array(81), 9, 2.5, 2), /outside/u);
  assert.throws(() => describeBoardIntersection(new Uint8Array(10), 9, 0, 0), /size²/u);
});

test("keyboard traversal clamps to the board and supports quick row/corner jumps", () => {
  assert.deepEqual(nextBoardCursor([4, 4], 9, "ArrowLeft"), [3, 4]);
  assert.deepEqual(nextBoardCursor([0, 0], 9, "ArrowLeft"), [0, 0]);
  assert.deepEqual(nextBoardCursor([4, 4], 9, "Home"), [0, 4]);
  assert.deepEqual(nextBoardCursor([4, 4], 9, "End"), [8, 4]);
  assert.deepEqual(nextBoardCursor([4, 4], 9, "Home", { ctrlKey: true }), [0, 0]);
  assert.deepEqual(nextBoardCursor([4, 4], 19, "End", { ctrlKey: true }), [18, 18]);
  assert.deepEqual(nextBoardCursor([18, 18], 19, "ArrowDown"), [18, 18]);
  assert.equal(nextBoardCursor([0, 0], 9, "Escape"), null);
});
