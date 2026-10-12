import { test } from "node:test";
import assert from "node:assert/strict";
import { loadKernel, deriveColumnLetters, DEFAULT_KERNEL_PATH, KernelImportError } from "../src/kernel.mjs";

test("DEFAULT_KERNEL_PATH resolves to the installed @red-cup-engineering/weiqi-engine public entry point", () => {
  // The house resolver has no node_modules for house code (one in-repo
  // directory per package, never a literal `@scope/name` path segment), so
  // the assertion is on the package's real directory name, not the scope.
  assert.match(DEFAULT_KERNEL_PATH, /[/\\]weiqi-engine[/\\]src[/\\]index\.mjs$/);
});

test("loadKernel imports the exact-pinned engine's public surface", async () => {
  const kernel = await loadKernel();
  assert.equal(typeof kernel.Game, "function");
  assert.equal(typeof kernel.findGroup, "function");
  assert.equal(typeof kernel.coordToPoint, "function");
  assert.equal(typeof kernel.pointToCoord, "function");
  assert.equal(typeof kernel.getRuleset, "function");
  assert.equal(typeof kernel.scoreArea, "function");
  assert.equal(typeof kernel.scoreTerritory, "function");
  assert.equal(typeof kernel.parseSgfCollection, "function");
  assert.ok(kernel.RULESETS && typeof kernel.RULESETS === "object");
  assert.ok(kernel.TERM_PATH && typeof kernel.TERM_PATH === "object");
  assert.equal(kernel.BLACK, 1);
  assert.equal(kernel.WHITE, 2);
  assert.equal(kernel.EMPTY, 0);
});

test("the kernel's own RULESETS key is 'newzealand' (no underscore) -- confirms the digest's documented drift", async () => {
  const kernel = await loadKernel();
  assert.ok("newzealand" in kernel.RULESETS);
  assert.ok(!("new_zealand" in kernel.RULESETS));
});

test("board.mts does NOT export COLUMN_LETTERS -- confirms the SPEC.md WQ005 gap this package works around", async () => {
  const kernel = await loadKernel();
  assert.equal(kernel.COLUMN_LETTERS, undefined);
});

test("loadKernel throws KernelImportError for a path that does not resolve", async () => {
  await assert.rejects(() => loadKernel("/definitely/not/a/real/path/index.mts"), KernelImportError);
});

test("deriveColumnLetters matches the kernel's own skip-I convention, derived via pointToCoord, not hardcoded", async () => {
  const kernel = await loadKernel();
  assert.deepEqual(deriveColumnLetters(5, kernel), ["A", "B", "C", "D", "E"]);
  // 9 columns must skip "I": A-H then J.
  assert.deepEqual(deriveColumnLetters(9, kernel), ["A", "B", "C", "D", "E", "F", "G", "H", "J"]);
  // Round-trip check against coordToPoint itself for a wider board.
  const letters = deriveColumnLetters(11, kernel);
  assert.equal(letters.length, 11);
  assert.ok(!letters.includes("I"));
  for (let col = 0; col < 11; col++) {
    assert.equal(kernel.coordToPoint(11, 1, `${letters[col]}1`), col);
  }
});
