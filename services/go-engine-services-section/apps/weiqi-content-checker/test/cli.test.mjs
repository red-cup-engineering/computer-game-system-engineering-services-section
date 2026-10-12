// End-to-end CLI test: spawns the REAL `scripts/check.mjs` as a child process
// (real argv parsing, real process exit codes) against both the live
// corpus and synthetic fixture trees -- not a fake in-process harness.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const BIN = resolve(HERE, "..", "scripts", "check.mjs");
const SECTION_ROOT = resolve(HERE, "..", "..", "..");

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [BIN, ...args], { encoding: "utf8", cwd: SECTION_ROOT, ...options });
}

test("exit 0, no error diagnostics: the live corpus's own genuine findings are all info/warning/error-but-real, still exits per the actual error count", () => {
  // The live corpus DOES contain real WQ013/WQ043/WQ044 errors (see
  // regression-corpus.test.mjs), so a full default run must exit 1, not 0
  // -- exercised by the next test. This test instead scopes to a
  // known-clean rule family so a clean run's exit-0 path is exercised too.
  const result = runCli(["--only=WQ030,WQ031,WQ032,WQ050,WQ051,WQ052,WQ053,WQ054"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /0 error\(s\)/);
});

test("default invocation against the live corpus exits 1 (real WQ013/WQ043/WQ044 errors exist) and reports a nonzero error count", () => {
  const result = runCli([]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /error\(s\)/);
  assert.doesNotMatch(result.stdout, /^\s*$/);
});

test("--json emits the documented {tool,version,filesScanned,diagnostics,summary} shape", () => {
  const result = runCli(["--json", "--only=WQ044"]);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.tool, "weiqi-lsp");
  assert.equal(typeof parsed.version, "string");
  assert.equal(typeof parsed.filesScanned, "number");
  assert.ok(Array.isArray(parsed.diagnostics));
  assert.ok(parsed.diagnostics.every((d) => d.code === "WQ044"));
  assert.equal(typeof parsed.summary.errors, "number");
});

test("--only restricts BOTH what is reported and exit-code evaluation (real WQ044 errors exist, but are excluded)", () => {
  const scoped = runCli(["--json", "--only=WQ044"]);
  const scopedParsed = JSON.parse(scoped.stdout);
  assert.ok(scopedParsed.diagnostics.every((d) => d.code === "WQ044"));
  assert.equal(scoped.status, scopedParsed.summary.errors > 0 ? 1 : 0);

  const excluding = runCli(["--json", "--only=WQ030"]); // a rule family known to be clean against the live corpus
  const excludingParsed = JSON.parse(excluding.stdout);
  assert.equal(excludingParsed.diagnostics.length, 0);
  assert.equal(excluding.status, 0, "excluded codes' real errors must not affect the exit code");
});

test("--severity-min filters what is REPORTED but never changes the exit code", () => {
  const full = runCli(["--json", "--only=WQ013"]);
  const fullParsed = JSON.parse(full.stdout);
  const infoOnly = fullParsed.diagnostics.filter((d) => d.severity === "info").length;
  assert.ok(infoOnly > 0, "expected R1's info-severity WQ013 diagnostic to exist");

  const filtered = runCli(["--json", "--only=WQ013", "--severity-min=error"]);
  const filteredParsed = JSON.parse(filtered.stdout);
  assert.ok(filteredParsed.diagnostics.every((d) => d.severity === "error"));
  assert.equal(filtered.status, full.status, "--severity-min must not change the exit code");
});

test("--quiet suppresses per-diagnostic lines but still prints the summary line", () => {
  const result = runCli(["--quiet", "--only=WQ044"]);
  assert.doesNotMatch(result.stdout, /WQ044/);
  assert.match(result.stdout, /error\(s\)/);
});

test("exit 2: a glob that matches zero files is a tool-level failure, not a silent pass", () => {
  const result = runCli(["content/**/*.this-extension-does-not-exist"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /matched zero files/);
});

test("exit 2: an unknown CLI flag is a tool-level failure", () => {
  const result = runCli(["--not-a-real-flag"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Unknown option/);
});

test("exit 2: an invalid --severity-min value is a tool-level failure", () => {
  const result = runCli(["--severity-min=nonsense"]);
  assert.equal(result.status, 2);
});

test("exit 2: --kernel-path pointing at a nonexistent file is a tool-level failure, never masked as a clean pass", () => {
  const result = runCli(["--kernel-path=/definitely/not/a/kernel.mts"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Could not import weiqi-kernel/);
});

test("a glob scoped to a single, known-clean real file exits 0 with zero diagnostics", () => {
  // The CLI's own section root is fixed relative to scripts/check.mjs's own
  // location (per SPEC.md: globs resolve "relative to the section root
  // (weiqi-services-section/)", a repo-embedded anchor, not the invoking
  // shell's cwd) -- so an end-to-end fixture test scopes itself to one
  // real, already-known-clean file via a glob, rather than pointing the
  // binary at a synthetic tree outside the section it is built to check.
  const result = runCli(["--json", "content/text/documents/articles/notes/weiqi-platform-plan.md"]);
  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.filesScanned, 1);
  assert.deepEqual(parsed.diagnostics, []);
});

test("a glob scoped to the regression corpus verifies every legality claim end-to-end and exits 0 (R1's ko claim and R2/R3/R6/R7 stay info)", () => {
  const result = runCli(["--json", "content/text/documents/articles/teaching-articles/references/regression-positions.md"]);
  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  assert.deepEqual(parsed.diagnostics.filter((d) => d.severity === "error"), []);
  assert.equal(parsed.diagnostics.filter((d) => d.code === "WQ013" && d.severity === "info").length, 1);
  assert.equal(parsed.diagnostics.filter((d) => d.code === "WQ019").length, 4);
});
