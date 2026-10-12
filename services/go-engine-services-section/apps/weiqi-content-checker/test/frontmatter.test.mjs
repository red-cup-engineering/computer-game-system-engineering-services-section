import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkFrontmatter } from "../src/frontmatter.mjs";

function withSectionRoot(fn) {
  const root = mkdtempSync(join(tmpdir(), "weiqi-lsp-fm-"));
  try {
    mkdirSync(join(root, "content", "text", "glossary", "terms"), { recursive: true });
    writeFileSync(join(root, "content", "text", "glossary", "terms", "liberty.md"), "# liberty");
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("WQ044 -- a missing required field, spec's own minimal trigger (no date-updated)", () => {
  withSectionRoot((root) => {
    const text = ["---", "title: x", "type: term", "date-created: 2026-01-01", "authors:", "- a", "defines:", "- x", "---", "body"].join("\n");
    const diagnostics = checkFrontmatter(text, "f.md", root);
    const wq044 = diagnostics.filter((d) => d.code === "WQ044");
    assert.equal(wq044.length, 1);
    assert.match(wq044[0].message, /date-updated/);
  });
});

test("WQ044 -- no frontmatter block at all reports every required field missing", () => {
  withSectionRoot((root) => {
    const diagnostics = checkFrontmatter("just a body, no frontmatter\n", "f.md", root);
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0].code, "WQ044");
  });
});

test("WQ040 -- type: term with no defines:, spec's own minimal trigger", () => {
  withSectionRoot((root) => {
    const text = ["---", "title: x", "type: term", "date-created: d", "date-updated: d", "authors:", "- a", "---", "body"].join("\n");
    const diagnostics = checkFrontmatter(text, "f.md", root);
    assert.equal(diagnostics.filter((d) => d.code === "WQ040").length, 1);
  });
});

test("WQ040 does not fire when defines: is present and non-empty", () => {
  withSectionRoot((root) => {
    const text = ["---", "title: x", "type: term", "date-created: d", "date-updated: d", "authors:", "- a", "defines:", "- x", "---", "body"].join("\n");
    assert.deepEqual(
      checkFrontmatter(text, "f.md", root).filter((d) => d.code === "WQ040"),
      [],
    );
  });
});

test("WQ041 -- type: lesson with no teaches:, spec's own minimal trigger", () => {
  withSectionRoot((root) => {
    const text = ["---", "title: x", "type: lesson", "date-created: d", "date-updated: d", "authors:", "- a", "---", "body"].join("\n");
    const diagnostics = checkFrontmatter(text, "f.md", root);
    assert.equal(diagnostics.filter((d) => d.code === "WQ041").length, 1);
  });
});

test("WQ042 -- a typo'd uses-mechanic: entry, spec's own minimal trigger", () => {
  withSectionRoot((root) => {
    const text = [
      "---",
      "title: x",
      "type: lesson",
      "date-created: d",
      "date-updated: d",
      "authors:",
      "- a",
      "teaches:",
      "- x",
      "uses-mechanic:",
      "- /games/topics/board-games/weiqi/terms/liberty.md",
      "- /games/topics/board-games/weiqi/terms/nosuchterm.md",
      "---",
      "body",
    ].join("\n");
    const diagnostics = checkFrontmatter(text, "f.md", root);
    const wq042 = diagnostics.filter((d) => d.code === "WQ042");
    assert.equal(wq042.length, 1);
    assert.match(wq042[0].message, /nosuchterm/);
  });
});

test("WQ042 -- a requires: entry outside this section's own prefix is left unverified (a cross-section curriculum path)", () => {
  withSectionRoot((root) => {
    const text = [
      "---",
      "title: x",
      "type: lesson",
      "date-created: d",
      "date-updated: d",
      "authors:",
      "- a",
      "teaches:",
      "- x",
      "requires:",
      "- /games/curricula/what-is-a-game.md",
      "---",
      "body",
    ].join("\n");
    const diagnostics = checkFrontmatter(text, "f.md", root);
    assert.deepEqual(
      diagnostics.filter((d) => d.code === "WQ042"),
      [],
    );
  });
});

test("WQ043 -- an inline citation with no backing references: entry, spec's own minimal trigger", () => {
  withSectionRoot((root) => {
    const text = [
      "---",
      "title: x",
      "type: term",
      "date-created: d",
      "date-updated: d",
      "authors:",
      "- a",
      "defines:",
      "- x",
      "---",
      "Some text citing [@newsource2026] with no backing entry.",
    ].join("\n");
    const diagnostics = checkFrontmatter(text, "f.md", root);
    const wq043 = diagnostics.filter((d) => d.code === "WQ043");
    assert.equal(wq043.length, 1);
    assert.match(wq043[0].message, /newsource2026/);
  });
});

test("WQ043 does not fire when the citation key has a matching references: entry", () => {
  withSectionRoot((root) => {
    const text = [
      "---",
      "title: x",
      "type: term",
      "date-created: d",
      "date-updated: d",
      "authors:",
      "- a",
      "defines:",
      "- x",
      "references:",
      "  britgo2025default:",
      "    authors:",
      "    - Britgo2025default",
      "    title: Britgo2025default",
      "---",
      "Cites [@britgo2025default] correctly.",
    ].join("\n");
    const diagnostics = checkFrontmatter(text, "f.md", root);
    assert.deepEqual(
      diagnostics.filter((d) => d.code === "WQ043"),
      [],
    );
  });
});

test("WQ043 handles a multi-citation bracket like [@a; @b]", () => {
  withSectionRoot((root) => {
    const text = [
      "---",
      "title: x",
      "type: term",
      "date-created: d",
      "date-updated: d",
      "authors:",
      "- a",
      "defines:",
      "- x",
      "references:",
      "  a2026:",
      "    title: A",
      "---",
      "Cites [@a2026; @b2026] here.",
    ].join("\n");
    const diagnostics = checkFrontmatter(text, "f.md", root);
    const wq043 = diagnostics.filter((d) => d.code === "WQ043");
    assert.equal(wq043.length, 1);
    assert.match(wq043[0].message, /b2026/);
  });
});

test("WQ043 shares prose eligibility and editor coordinates for suppressed citations", () => {
  withSectionRoot((root) => {
    const text = ["---", "title: x", "---", "~~~", "[@example]", "~~~", "`[@inline]`", "😀 Cite [-@missing]."].join("\r\n");
    const diagnostics = checkFrontmatter(text, "f.md", root).filter(({ code }) => code === "WQ043");
    assert.equal(diagnostics.length, 1);
    assert.match(diagnostics[0].message, /missing/u);
    assert.deepEqual(diagnostics[0].start, { line: 8, column: 9 });
  });
});
