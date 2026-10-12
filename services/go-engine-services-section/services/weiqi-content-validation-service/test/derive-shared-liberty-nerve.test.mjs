import { test } from "node:test";
import assert from "node:assert/strict";
import { BLACK, WHITE, EMPTY, createPositionFromCells, gameRecordToSgf } from "@red-cup-engineering/weiqi-engine";
import { libertyChuSpace, positionFromSgf } from "../scripts/derive-liberty-chu-space.mjs";
import { sharedLibertyNerve } from "../scripts/derive-shared-liberty-nerve.mjs";
import { at, extension } from "@red-cup-engineering/metrologic/chu";

// Kernel convention: cell index 0 is A1; row r of the cell array is rank r + 1.
const _ = EMPTY, B = BLACK, W = WHITE;

test("an empty board has no groups, no states, and vanishing H1", () => {
  const nerve = sharedLibertyNerve(createPositionFromCells(3, 3, [_, _, _, _, _, _, _, _, _]));
  assert.equal(nerve.groups, 0);
  assert.equal(nerve.cells.length, 0);
  assert.equal(nerve.components, 0);
  assert.equal(nerve.h1, 0);
});

test("two groups sharing one liberty give one cell, one component, H1 = 0", () => {
  // Rank 1: B _ B; B1 is a liberty of both single-stone groups.
  const position = createPositionFromCells(3, 3, [B, _, B, _, _, _, _, _, _]);
  const derived = libertyChuSpace(position);
  assert.deepEqual(derived.states, ["B@A1", "B@C1"]);
  assert.deepEqual([...extension(derived.space, "B@A1")].sort(), ["A2", "B1"]);
  assert.equal(at(derived.space, "C3", "B@A1"), "active");
  const nerve = sharedLibertyNerve(position);
  assert.deepEqual(nerve.sharedLiberties, ["B1"]);
  assert.deepEqual(nerve.cells, [{ subject: "B@A1", predicate: "shares-liberty:B1", object: "B@C1" }]);
  assert.equal(nerve.sameColorCells, 1);
  assert.equal(nerve.components, 1);
  assert.equal(nerve.h1, 0);
});

test("three mutually adjacent groups carry a cycle the nerve reads as H1 = 3", () => {
  // Rank 1: B _ B; rank 2: _ W _. The white stone at B2 shares B1 with both
  // black stones and A2/C2 with one each: 5 cells over 3 groups, one component.
  const position = createPositionFromCells(3, 3, [B, _, B, _, W, _, _, _, _]);
  const nerve = sharedLibertyNerve(position);
  assert.equal(nerve.groups, 3);
  assert.equal(nerve.groupsInNerve, 3);
  assert.deepEqual(nerve.sharedLiberties, ["B1", "A2", "C2"]);
  assert.equal(nerve.cells.length, 5);
  assert.equal(nerve.sameColorCells, 1);
  assert.equal(nerve.oppositeColorCells, 4);
  assert.equal(nerve.components, 1);
  assert.equal(nerve.h1, 5 - 3 + 1);
});

test("a position is replayed from SGF through the kernel, captures applied", () => {
  // Black surrounds a white stone at C8 on a 9x9 board; the capture removes it.
  const at = (col, rank) => 9 * (rank - 1) + col;
  const sgf = gameRecordToSgf({
    size: 9,
    ruleset: "chinese",
    moves: [
      { color: B, point: at(1, 8) }, // B8
      { color: W, point: at(2, 8) }, // C8
      { color: B, point: at(3, 8) }, // D8
      { color: W, point: "pass" },
      { color: B, point: at(2, 7) }, // C7
      { color: W, point: "pass" },
      { color: B, point: at(2, 9) }, // C9 captures C8
    ],
  });
  const full = positionFromSgf(sgf);
  assert.equal(full.moveIndex, 7);
  assert.equal(full.position.capturedWhiteStones, 1);
  const nerve = sharedLibertyNerve(full.position);
  assert.equal(nerve.groups, 4);
  assert.ok(nerve.sharedLiberties.includes("C8"));
  const early = positionFromSgf(sgf, 2);
  assert.equal(early.moveIndex, 2);
  assert.equal(sharedLibertyNerve(early.position).groups, 2);
});
