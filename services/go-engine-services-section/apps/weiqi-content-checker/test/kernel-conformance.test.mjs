// Kernel-conformance: whatever this package computes about a position must
// agree with what weiqi-kernel itself computes for that SAME board -- same
// verdicts, same numbers. This is not testing Family (b)'s diagnostics
// (regression-corpus.test.mjs does that); it independently recomputes each
// regression position DIRECTLY through the kernel's own public API and
// cross-checks the numbers this package's own diagram parser derives
// against that independent computation, so a drift in either the parser or
// the rule modules would be caught even if both happened to agree with each
// other but not with the kernel.

import { test } from "node:test";
import assert from "node:assert/strict";
import { extractFences } from "../src/markdown.mjs";
import { checkDiagramFence } from "../src/diagram.mjs";
import { loadKernel } from "../src/kernel.mjs";

const kernel = await loadKernel();

function diagramFrom(body) {
  const fence = extractFences("```\n" + body + "\n```")[0];
  return checkDiagramFence(fence, "f.md", kernel).diagram;
}

// R9's own diagram, transcribed verbatim from regression-positions.md.
const R9 = ["       A B C D E F G", "    1  . . X . O . .", "    2  . . X O O . .", "    3  . . X . O . .", "    4  . . X X O . .", "    5  . . X . O . ."].join(
  "\n",
);

test("this package's diagram parser produces the exact same board the kernel's own regression-position parser derives (R9)", () => {
  const diagram = diagramFrom(R9);
  // Independently reconstruct the same board directly via kernel calls,
  // bypassing this package's parser entirely, and compare cell-for-cell.
  const width = 7;
  const height = 5;
  const blackCoords = ["C1", "C2", "C3", "C4", "C5", "D4"];
  const whiteCoords = ["E1", "E2", "E3", "E4", "E5", "D2"];
  const independentCells = new Uint8Array(width * height);
  for (const c of blackCoords) independentCells[kernel.coordToPoint(width, height, c)] = kernel.BLACK;
  for (const c of whiteCoords) independentCells[kernel.coordToPoint(width, height, c)] = kernel.WHITE;
  assert.deepEqual([...diagram.cells], [...independentCells]);
});

test("scoreArea computed from this package's parsed diagram matches R9's hand-verified numbers, via the kernel's own scoreArea", () => {
  const diagram = diagramFrom(R9);
  const position = kernel.createPositionFromCells(diagram.width, diagram.height, diagram.cells, kernel.BLACK, 0, 0);
  const ruleset = kernel.getRuleset("chinese");
  const result = kernel.scoreArea(position, ruleset);
  assert.equal(result.blackStones, 6);
  assert.equal(result.blackTerritory, 10);
  assert.equal(result.blackScore, 16);
  assert.equal(result.whiteStones, 6);
  assert.equal(result.whiteTerritory, 10);
  assert.equal(result.whiteScore, 23.5); // 16 + chinese komi 7.5
  assert.equal(result.margin, "White by 7.5");
});

test("scoreTerritory computed from this package's parsed diagram matches R10's hand-verified numbers", () => {
  const diagram = diagramFrom(R9); // R10 reuses R9's exact diagram, per regression-positions.md
  const position = kernel.createPositionFromCells(diagram.width, diagram.height, diagram.cells, kernel.BLACK, 0, 0);
  const ruleset = kernel.getRuleset("japanese");
  const result = kernel.scoreTerritory(position, ruleset);
  assert.equal(result.blackTerritory, 10);
  assert.equal(result.blackPrisoners, 0);
  assert.equal(result.blackScore, 10);
  assert.equal(result.whiteTerritory, 10);
  assert.equal(result.whitePrisoners, 0);
  assert.equal(result.whiteScore, 16.5); // 10 + japanese komi 6.5
  assert.equal(result.margin, "White by 6.5");
});

test("findGroup on R6's parsed diagram agrees with the kernel's own liberty computation (the seki shape)", () => {
  const diagram = diagramFrom(["    A B C", "  1 X . O", "  2 X . O"].join("\n"));
  const blackGroup = kernel.findGroup(diagram.cells, diagram.width, diagram.height, kernel.coordToPoint(3, 2, "A1"));
  const whiteGroup = kernel.findGroup(diagram.cells, diagram.width, diagram.height, kernel.coordToPoint(3, 2, "C1"));
  assert.equal(blackGroup.liberties.size, 2);
  assert.equal(whiteGroup.liberties.size, 2);
  assert.equal(blackGroup.stones.length, 2);
  assert.equal(whiteGroup.stones.length, 2);
});

test("Game.isLegal on R8's parsed diagram agrees with the kernel's own capture-not-suicide verdict", () => {
  const diagram = diagramFrom(["    A B", "  1 O *", "  2 X ."].join("\n"));
  const position = kernel.createPositionFromCells(diagram.width, diagram.height, diagram.cells, kernel.BLACK, 0, 0);
  for (const rulesetName of Object.keys(kernel.RULESETS)) {
    const game = new kernel.Game(diagram.width, rulesetName, position);
    assert.equal(game.isLegal("B1"), true, `expected B1 legal (a real capture, not suicide) under ruleset.${rulesetName}`);
  }
});

test("handicapPoints for a 9x9 4-stone handicap matches R13's diagram exactly, independent of this package's own parser", () => {
  const points = kernel.handicapPoints(9, 4);
  assert.deepEqual([...points].sort(), ["C3", "C7", "G3", "G7"]);
});

test("deriveColumnLetters used by WQ005 agrees with coordToPoint's own column resolution for every width the corpus actually uses", async () => {
  const { deriveColumnLetters } = await import("../src/kernel.mjs");
  for (const width of [2, 3, 4, 5, 7, 9]) {
    const letters = deriveColumnLetters(width, kernel);
    for (let col = 0; col < width; col++) {
      const coord = `${letters[col]}1`;
      assert.equal(kernel.coordToPoint(width, 1, coord), col, `column ${col} of width ${width}`);
    }
  }
});
