import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { rushDeck, rushResult } from "../public/js/tsumego-deck.mjs";

const source = new URL("../public/", import.meta.url);
const puzzles = Array.from({ length: 56 }, (_, i) => ({ id: `case-${i}`, category: "capture-go-basics" }));

test("daily Puzzle Rush is repeatable, changes by UTC day, and never repeats a puzzle", () => {
  const a = rushDeck(puzzles, 20740);
  assert.equal(a.length, 30);
  assert.deepEqual(a, rushDeck(puzzles, 20740));
  assert.notDeepEqual(a, rushDeck(puzzles, 20741));
  assert.equal(new Set(a.map(p => p.id)).size, a.length);
  assert.deepEqual(rushDeck(puzzles, 20740, { limit: 100 }).length, 56);
  assert.throws(() => rushDeck([{ id: "same" }, { id: "same" }], 20740), /Duplicate puzzle/);
  assert.throws(() => rushDeck(puzzles, NaN), /Invalid rush/);
  assert.throws(() => rushDeck(puzzles, 20740, { limit: 0 }), /Invalid rush/);
});

test("score and lives make a genuine consecutive-answer challenge, not cash balances", () => {
  let state = { lives: 3, streak: 0, bestStreak: 0, score: 0, solved: 0, answered: 0 };
  for (const correct of [true, true, false, true, false, false]) state = rushResult(state, correct);
  assert.deepEqual({ lives: state.lives, streak: state.streak, bestStreak: state.bestStreak, score: state.score, solved: state.solved, answered: state.answered },
    { lives: 0, streak: 0, bestStreak: 2, score: 325, solved: 3, answered: 6 });
  assert.equal(rushResult(state, true), state, "a finished run cannot claim extra points");
  assert.equal(rushResult({ lives: 1, streak: 20, score: 0, solved: 0, answered: 0, bestStreak: 20 }, true).score, 500, "per-answer bonus is bounded");
});

test("the actual player pages wire the arcade to the original game board and homepage", async () => {
  const [home, page, app, theme] = await Promise.all(["index.html", "tsumego.html", "js/tsumego-app.mjs", "css/theme.css"].map(async file => readFile(new URL(file, source), "utf8")));
  assert.match(home, /tsumego\.html#rush-panel/);
  assert.match(home, /play\.html/);
  assert.match(page, /id="rush-start"/);
  assert.match(page, /id="rush-score"/);
  assert.match(app, /rushDeck\(allProblems, epochDay\(\)\)/);
  assert.match(app, /rushResult\(rush, true\)/);
  assert.match(app, /rushResult\(rush, false\)/);
  assert.match(app, /new kernel\.Game\(problem.size, RULESET, startingPositionFor\(problem\)\)/);
  assert.match(theme, /\.rush-panel/);
  assert.match(theme, /\.lobby-modes/);
});
