import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Game } from "../public/js/kernel/index.mjs";

const dataUrl = new URL("../public/data/", import.meta.url);

async function lesson(name) {
  return JSON.parse(await readFile(new URL(name, dataUrl), "utf8"));
}

test("Living Groups and Eyes is migrated into the Web Learn curriculum with its distinct worked shape", async () => {
  const migrated = await lesson("lesson-living-groups-and-eyes.json");

  assert.equal(migrated.lessonId, "living-groups-and-eyes");
  assert.equal(migrated.sourcePath, "content/text/documents/articles/teaching-articles/tutorials/living-groups-and-eyes.md");
  assert.equal(migrated.steps.length, 8);
  assert.deepEqual(migrated.steps[0].stones.filter((stone) => stone.color === "black").length, 6);
  assert.deepEqual(migrated.steps[0].stones.filter((stone) => stone.color === "white").length, 7);
  assert.match(migrated.steps[0].text, /A1 and C1/u);
  assert.equal(migrated.steps.at(-1).links.some((link) => link.href === "learn.html?lesson=weiqi-overview"), true);
});

test("the migrated two-eye worked shape is reachable and both eyes are illegal for White", () => {
  const game = new Game(9, "chinese");
  for (const move of ["A2", "A3", "B1", "B3", "B2", "C3", "C2", "D3", "D1", "E1", "D2", "E2", "pass", "E3"]) {
    const outcome = game.play(move);
    assert.equal(outcome.ok, true, `${move} must be legal in the lesson sequence`);
  }
  // The constructed line ends on White's E3; Black passes so the claim is
  // checked in White's actual turn context rather than against Black's moves.
  assert.equal(game.play("pass").ok, true);
  assert.equal(game.isLegal("A1"), false);
  assert.equal(game.isLegal("C1"), false);
});

test("the overview links to the migrated follow-on lesson", async () => {
  const overview = await lesson("lesson-weiqi-overview.json");
  const next = overview.steps.find((step) => step.type === "next");
  assert.ok(next);
  assert.equal(next.links.some((link) => link.href === "learn.html?lesson=living-groups-and-eyes"), true);
});

test("the public Learn receiver carries the former Learn-only history and handicap lessons with source provenance", async () => {
  for (const [name, lessonId, sourcePath] of [
    ["lesson-weiqi-history.json", "weiqi-history", "content/text/documents/articles/teaching-articles/tutorials/weiqi-history.md"],
    ["lesson-komi-and-handicap.json", "komi-and-handicap", "content/text/documents/articles/teaching-articles/tutorials/komi-and-handicap.md"],
  ]) {
    const migrated = await lesson(name);
    assert.equal(migrated.lessonId, lessonId);
    assert.equal(migrated.sourcePath, sourcePath);
    assert.ok(migrated.steps.some((step) => step.type === "exercise"));
  }
});
