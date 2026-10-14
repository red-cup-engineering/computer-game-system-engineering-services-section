import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as kernel from "@red-cup-engineering/weiqi-engine";
import { foundationProblemForTrainer } from "../public/js/tsumego-foundations.mjs";

const foundations = JSON.parse(
  await readFile(new URL("../public/data/tsumego-foundations.json", import.meta.url), "utf8"),
);

test("the public trainer admits every preserved foundation problem through one explicit binding", () => {
  assert.equal(foundations.problems.length, 12);
  for (const problem of foundations.problems) {
    const trainerProblem = foundationProblemForTrainer(problem);
    assert.equal(trainerProblem.prompt, problem.goal);
    assert.equal(trainerProblem.band, "introductory");
    assert.equal(trainerProblem.source, "foundation-curriculum");
    assert.match(trainerProblem.category, /^(capture-go-basics|life-and-death-fundamentals|endgame-and-scoring)$/);
  }
});

test("the binding refuses an unmodeled foundation set", () => {
  assert.throws(() => foundationProblemForTrainer({ set: "unmodeled" }), /Unknown foundation tsumego set/);
});

test("the endgame pass challenge is executable through the same real Game and public trainer", async () => {
  const problem = foundations.problems.find((entry) => entry.id === "endgame-recognize-the-finish");
  assert.ok(problem);
  assert.deepEqual(problem.accept, ["pass"]);
  const cells = new Array(problem.size * problem.size).fill(kernel.EMPTY);
  for (const stone of problem.stones) {
    cells[kernel.coordToPoint(problem.size, problem.size, stone.pt)] =
      stone.color === "black" ? kernel.BLACK : kernel.WHITE;
  }
  const start = kernel.createPositionFromCells(problem.size, problem.size, cells,
    problem.toPlay === "black" ? kernel.BLACK : kernel.WHITE);
  const game = new kernel.Game(problem.size, "chinese", start);
  assert.equal(game.play("pass").ok, true, "the rules authority accepts the authored answer");
  const [html, client] = await Promise.all([
    readFile(new URL("../public/tsumego.html", import.meta.url), "utf8"),
    readFile(new URL("../public/js/tsumego-app.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(html, /id="pass-problem-btn"/);
  assert.match(client, /submitPuzzleMove\("pass"\)/);
  assert.match(client, /currentProblem\.accept\.includes\(coord\)/,
    "the Pass action and board action must share answer admission");
});
