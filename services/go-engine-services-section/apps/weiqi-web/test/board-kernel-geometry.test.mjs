import assert from "node:assert/strict";
import { test } from "node:test";

import { BLACK, EMPTY, WHITE, coordToPoint, pointIndex, pointToCoord } from "../public/js/kernel/board.mjs";
import { handicapPoints } from "../public/js/kernel/rulesets.mjs";
import { describeBoardIntersection, pointForBoard, starPoints } from "../public/js/board.mjs";

test("every keyboard coordinate and spoken intersection round-trips through the upstream engine", () => {
  for (const size of [7, 9, 13, 19]) {
    const board = new Uint8Array(size * size).fill(EMPTY);
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        const point = pointIndex(size, col, row);
        const coord = pointToCoord(size, point);
        assert.equal(coordToPoint(size, size, coord), point);
        assert.deepEqual(pointForBoard(size, coord), [col, row]);
        assert.equal(describeBoardIntersection(board, size, col, row),
          `Cursor at ${coord}: empty intersection.`);
      }
    }
  }
});

test("stone colors and move markers are read with canonical kernel values", () => {
  const board = new Uint8Array(9 * 9).fill(EMPTY);
  board[pointIndex(9, 4, 4)] = BLACK;
  board[pointIndex(9, 5, 4)] = WHITE;
  assert.equal(describeBoardIntersection(board, 9, 4, 4, { lastMoveCoord: "E5" }),
    "Cursor at E5: black stone; last move.");
  assert.equal(describeBoardIntersection(board, 9, 5, 4, { deadCoords: ["F5"] }),
    "Cursor at F5: white stone; marked dead.");
});

test("hoshi match the upstream fixed handicap layouts; Capture Go has none", () => {
  const expected = new Map([
    [7, []],
    [9, ["C3", "C7", "E5", "G3", "G7"]],
    [13, ["D4", "D10", "G7", "K4", "K10"]],
    [19, ["D4", "D10", "D16", "K4", "K10", "K16", "Q4", "Q10", "Q16"]],
  ]);
  for (const [size, coords] of expected) {
    const actual = starPoints(size).map(([col, row]) => pointToCoord(size, pointIndex(size, col, row))).sort();
    assert.deepEqual(actual, [...coords].sort(), `${size}x${size} hoshi drifted`);
    if (size !== 7) {
      const count = size === 19 ? 9 : 5;
      assert.deepEqual(actual, [...handicapPoints(size, count)].sort());
    }
  }
});

test("invalid Go notation is rejected by the engine parser, not a second UI parser", () => {
  assert.equal(pointForBoard(9, "I5"), null, "I is skipped in Go notation");
  assert.deepEqual(pointForBoard(9, "J5"), [8, 4], "J is the ninth Go column");
  assert.equal(pointForBoard(9, "K5"), null, "K is beyond a nine-column board (J is its final column)");
  assert.equal(pointForBoard(19, "T20"), null);
  assert.equal(pointForBoard(9, "E0"), null);
  assert.equal(pointForBoard(9, "pass"), null);
  assert.deepEqual(pointForBoard(19, "t19"), [18, 18]);
});
