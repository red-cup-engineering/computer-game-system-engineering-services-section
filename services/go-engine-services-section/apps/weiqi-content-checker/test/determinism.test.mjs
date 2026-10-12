// Determinism: running the same check twice against the same content must
// produce byte-for-byte identical diagnostics (same order, same fields) --
// no reliance on object-key iteration order across different Node
// versions, no Set/Map iteration surprises, no timestamps or randomness
// anywhere in a Diagnostic.

import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runChecks } from "../src/run.mjs";

const SECTION_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

test("runChecks against the live corpus is deterministic across repeated runs", async () => {
  const first = await runChecks({ sectionRoot: SECTION_ROOT });
  const second = await runChecks({ sectionRoot: SECTION_ROOT });
  const third = await runChecks({ sectionRoot: SECTION_ROOT });
  assert.deepEqual(first.diagnostics, second.diagnostics);
  assert.deepEqual(second.diagnostics, third.diagnostics);
  assert.equal(first.filesScanned, second.filesScanned);
});

test("no diagnostic ever carries a timestamp, random id, or other non-reproducible field", async () => {
  const { diagnostics } = await runChecks({ sectionRoot: SECTION_ROOT });
  const allowedKeys = new Set(["code", "severity", "file", "start", "end", "message", "source", "ruleUrl"]);
  for (const d of diagnostics) {
    for (const key of Object.keys(d)) {
      assert.ok(allowedKeys.has(key), `unexpected field "${key}" on a Diagnostic`);
    }
  }
});

test("file globbing order does not change the resulting diagnostic set (only its within-file order is file-path-sorted, not glob-order-sorted)", async () => {
  const a = await runChecks({ sectionRoot: SECTION_ROOT, globs: ["apps/weiqi-platform/content/**/*.md", "apps/weiqi-web/public/data/tsumego-foundations.json"] });
  const b = await runChecks({ sectionRoot: SECTION_ROOT, globs: ["apps/weiqi-web/public/data/tsumego-foundations.json", "apps/weiqi-platform/content/**/*.md"] });
  const sortKey = (d) => `${d.code}|${d.file}|${d.start?.line ?? 0}|${d.start?.column ?? 0}|${d.message}`;
  assert.deepEqual([...a.diagnostics].sort((x, y) => sortKey(x).localeCompare(sortKey(y))), [...b.diagnostics].sort((x, y) => sortKey(x).localeCompare(sortKey(y))));
});
