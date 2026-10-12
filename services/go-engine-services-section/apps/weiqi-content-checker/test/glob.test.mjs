import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expandGlob } from "../src/glob.mjs";

function withTempTree(fn) {
  const root = mkdtempSync(join(tmpdir(), "weiqi-lsp-glob-"));
  try {
    mkdirSync(join(root, "content", "a", "b"), { recursive: true });
    mkdirSync(join(root, "content", "c"), { recursive: true });
    mkdirSync(join(root, "data"), { recursive: true });
    writeFileSync(join(root, "content", "top.md"), "x");
    writeFileSync(join(root, "content", "a", "one.md"), "x");
    writeFileSync(join(root, "content", "a", "b", "two.md"), "x");
    writeFileSync(join(root, "content", "c", "three.md"), "x");
    writeFileSync(join(root, "content", "c", "not-markdown.txt"), "x");
    writeFileSync(join(root, "data", "x.json"), "{}");
    writeFileSync(join(root, "data", "y.json"), "{}");
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("expandGlob with ** finds .md files at every depth", () => {
  withTempTree((root) => {
    const matches = expandGlob("content/**/*.md", root).sort();
    assert.equal(matches.length, 4);
    assert.ok(matches.every((m) => m.endsWith(".md")));
  });
});

test("expandGlob with a single-segment wildcard matches only that directory", () => {
  withTempTree((root) => {
    const matches = expandGlob("data/*.json", root).sort();
    assert.equal(matches.length, 2);
  });
});

test("expandGlob returns an empty array for a pattern that matches nothing", () => {
  withTempTree((root) => {
    assert.deepEqual(expandGlob("content/**/*.sgf", root), []);
    assert.deepEqual(expandGlob("nonexistent/*.md", root), []);
  });
});
