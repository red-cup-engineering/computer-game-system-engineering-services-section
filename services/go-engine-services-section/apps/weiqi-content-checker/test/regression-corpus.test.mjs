// Integration test against the REAL, live weiqi-services-section corpus --
// not synthetic fixtures. Asserts the specific diagnostics this
// implementation pass found and documented in the README (real findings,
// not false positives -- see the README's "Family (b) scope note" and
// "genuine corpus findings" sections), and asserts every other rule family
// comes back clean, so a future regression in either direction is caught.

import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_GLOBS, runChecks } from "../src/run.mjs";
import { expandGlob } from "../src/glob.mjs";

const SECTION_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const result = await runChecks({ sectionRoot: SECTION_ROOT });
const currentDefaultFiles = new Set(DEFAULT_GLOBS.flatMap((glob) => expandGlob(glob, SECTION_ROOT)));

test("scans every current default corpus and app-data input exactly once", () => {
  assert.equal(result.filesScanned, currentDefaultFiles.size);
  assert.ok(result.filesScanned >= 3);
});

test("only the expected codes fire against the live corpus (a regression here means either a real corpus change or an implementation bug)", () => {
  const codes = new Set(result.diagnostics.map((d) => d.code));
  assert.deepEqual([...codes].sort(), ["WQ013", "WQ019", "WQ043", "WQ044"]);
});

test("Family (b) legality/score/ruleset/margin checks (WQ010-012, WQ014) are clean across the whole live corpus", () => {
  const codes = ["WQ003", "WQ004", "WQ010", "WQ011", "WQ012", "WQ014"];
  for (const code of codes) {
    assert.deepEqual(
      result.diagnostics.filter((d) => d.code === code),
      [],
      `expected zero ${code} diagnostics against the live corpus`,
    );
  }
});

test("Family (d) links/termRef checks (WQ030-032) are clean across the whole live corpus", () => {
  for (const code of ["WQ030", "WQ031", "WQ032"]) {
    assert.deepEqual(result.diagnostics.filter((d) => d.code === code), []);
  }
});

test("Family (f) app-data checks (WQ050-054) are clean against the live tsumego.json/lessons.json", () => {
  for (const code of ["WQ050", "WQ051", "WQ052", "WQ053", "WQ054"]) {
    assert.deepEqual(result.diagnostics.filter((d) => d.code === code), []);
  }
});

test("Family (c) never fires -- SPEC.md's own scope note: no ```sgf block exists anywhere in this corpus yet", () => {
  for (const code of ["WQ020", "WQ021", "WQ022", "WQ023"]) {
    assert.deepEqual(result.diagnostics.filter((d) => d.code === code), []);
  }
});

test("R1's ko_point claim is reported info/not-verified, never a false WQ013 error", () => {
  const d = result.diagnostics.find((x) => x.code === "WQ013" && x.severity === "info");
  assert.ok(d, "expected exactly one info-severity WQ013 diagnostic (R1's ko_point claim)");
  assert.match(d.message, /NOT VERIFIED/);
  assert.match(d.file, /regression-positions\.md/);
});

test("R4's and R5's suicide claims agree with the kernel now that both diagrams are complete boards (R4 verified under all five rulesets, R5 under New Zealand)", () => {
  // Until 2026-09-16 R4 drew a 3x3 'interior fragment' whose ring had no
  // outside liberties, so the kernel read White's move as an ordinary
  // capture and WQ013 fired four real errors. The corpus now draws the
  // ring on a 5x5 board, exactly as the engine's own regression tests do.
  const errors = result.diagnostics.filter((d) => d.code === "WQ013" && d.severity === "error");
  assert.deepEqual(errors, []);
});

test("R2/R3 are skipped self-disclaimed, R6/R7's status claims are reported not-verified -- exactly 4 WQ019 diagnostics, all info", () => {
  const wq019 = result.diagnostics.filter((d) => d.code === "WQ019");
  assert.equal(wq019.length, 4);
  assert.ok(wq019.every((d) => d.severity === "info"));
  assert.ok(wq019.some((d) => /R2-positional-superko-long-cycle/.test(d.message)));
  assert.ok(wq019.some((d) => /R3-situational-superko-permits/.test(d.message)));
  assert.ok(wq019.some((d) => /R6-seki-minimal/.test(d.message)));
  assert.ok(wq019.some((d) => /R7-dead-stone-no-escape/.test(d.message)));
});

test("WQ043/WQ044 fire only as error-severity, real, findable corpus gaps (inline citations with no references: entry, missing required frontmatter fields)", () => {
  const wq043 = result.diagnostics.filter((d) => d.code === "WQ043");
  const wq044 = result.diagnostics.filter((d) => d.code === "WQ044");
  assert.ok(wq043.length > 0);
  assert.ok(wq044.length > 0);
  assert.ok(wq043.every((d) => d.severity === "error"));
  assert.ok(wq044.every((d) => d.severity === "error" && /title|date-updated|date-created|type|authors/.test(d.message)));
});

test("every diagnostic against the live corpus has a real Diagnostic shape (code/severity/file/message/source/ruleUrl)", () => {
  for (const d of result.diagnostics) {
    assert.match(d.code, /^WQ\d{3}$/);
    assert.ok(["error", "warning", "info"].includes(d.severity));
    assert.equal(typeof d.file, "string");
    assert.ok(d.file.length > 0);
    assert.equal(typeof d.message, "string");
    assert.equal(typeof d.source, "string");
    assert.equal(d.ruleUrl, `#${d.code}`);
  }
});
