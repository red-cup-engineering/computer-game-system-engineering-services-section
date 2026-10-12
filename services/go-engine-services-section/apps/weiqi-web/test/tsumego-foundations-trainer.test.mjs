import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
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
