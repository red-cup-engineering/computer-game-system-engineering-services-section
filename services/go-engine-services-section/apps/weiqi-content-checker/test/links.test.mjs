import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkRelativeLinks, checkSiteRootedTermPath, makeWq031Diagnostic, checkKernelTermPaths } from "../src/links.mjs";
import { loadKernel, DEFAULT_KERNEL_PATH } from "../src/kernel.mjs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const kernel = await loadKernel();

function withTempSection(fn) {
  const root = mkdtempSync(join(tmpdir(), "weiqi-lsp-links-"));
  try {
    mkdirSync(join(root, "content", "notes"), { recursive: true });
    mkdirSync(join(root, "content", "glossary", "terms"), { recursive: true });
    mkdirSync(join(root, "content", "text", "glossary", "terms"), { recursive: true });
    writeFileSync(join(root, "content", "glossary", "terms", "ko.md"), "# ko"); // resolved by a plain relative link from content/notes/a.md
    writeFileSync(join(root, "content", "text", "glossary", "terms", "ko.md"), "# ko"); // resolved by WQ031's site-rooted mapping
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("WQ030 -- broken relative link, spec's own minimal trigger (a typo'd filename)", () => {
  withTempSection((root) => {
    const file = join(root, "content", "notes", "a.md");
    writeFileSync(file, "See [Ending the Game](./ending-the-gaem.md).\n");
    const diagnostics = checkRelativeLinks("See [Ending the Game](./ending-the-gaem.md).\n", "content/notes/a.md", file);
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0].code, "WQ030");
  });
});

test("WQ030 -- a real relative link resolves cleanly", () => {
  withTempSection((root) => {
    const file = join(root, "content", "notes", "a.md");
    writeFileSync(file, "See [ko](../glossary/terms/ko.md).\n");
    const diagnostics = checkRelativeLinks("See [ko](../glossary/terms/ko.md).\n", "content/notes/a.md", file);
    assert.deepEqual(diagnostics, []);
  });
});

test("WQ030 -- external/mailto/anchor/absolute targets are skipped, per check-links.mts's own four steps", () => {
  withTempSection((root) => {
    const file = join(root, "content", "notes", "a.md");
    const text = [
      "[ext](https://example.com/x)",
      "[mail](mailto:a@example.com)",
      "[anchor](#section)",
      "[abs](/games/topics/board-games/weiqi/terms/nope.md)",
    ].join("\n");
    writeFileSync(file, text);
    const diagnostics = checkRelativeLinks(text, "content/notes/a.md", file);
    assert.deepEqual(diagnostics, []);
  });
});

test("WQ031 -- a site-rooted term path resolves to a real glossary file", () => {
  withTempSection((root) => {
    const result = checkSiteRootedTermPath("/games/topics/board-games/weiqi/terms/ko.md", root);
    assert.equal(result.ok, true);
  });
});

test("WQ030 checks prose targets, retaining source coordinates and excluding metadata and code", () => {
  withTempSection((root) => {
    const file = join(root, "content", "notes", "a.md");
    const text = [
      "---", 'example: "[metadata](missing-meta.md)"', "---",
      "~~~md", "[example](missing-fence.md)", "~~~",
      "``[inline](missing-inline.md)``",
      '[ko](../glossary/terms/ko.md "Go term")',
      '😀 See [bad](missing.md "Title").',
    ].join("\r\n");
    const diagnostics = checkRelativeLinks(text, "content/notes/a.md", file);
    assert.equal(diagnostics.length, 1);
    assert.deepEqual(diagnostics[0].start, { line: 9, column: 8 });
    assert.match(diagnostics[0].message, /"missing.md"/u);
  });
});

test("WQ031 -- a typo'd site-rooted term path does not resolve, spec's own minimal trigger", () => {
  withTempSection((root) => {
    const result = checkSiteRootedTermPath("/games/topics/board-games/weiqi/terms/atarii.md", root);
    assert.equal(result.ok, false);
    const d = makeWq031Diagnostic("/games/topics/board-games/weiqi/terms/atarii.md", "content/notes/a.md", 5);
    assert.equal(d.code, "WQ031");
    assert.equal(d.severity, "error");
  });
});

test("WQ031 -- a path outside the mounted prefix is out of scope (returns null, not a failure)", () => {
  withTempSection((root) => {
    assert.equal(checkSiteRootedTermPath("/games/curricula/what-is-a-game.md", root), null);
  });
});

test("WQ032 -- every real TERM_PATH entry resolves from the actual kernel package root", () => {
  const kernelPackageRoot = resolve(dirname(DEFAULT_KERNEL_PATH), "..");
  const sectionRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const diagnostics = checkKernelTermPaths(kernel, kernelPackageRoot, sectionRoot);
  assert.deepEqual(diagnostics, []);
});

test("WQ032 -- spec's own minimal trigger (a TERM_PATH entry pointing at a file that does not exist)", () => {
  const fakeKernel = { TERM_PATH: { cut: "../../content/text/glossary/terms/cut.md" } };
  const kernelPackageRoot = resolve(dirname(DEFAULT_KERNEL_PATH), "..");
  const sectionRoot = resolve(kernelPackageRoot, "..", "..");
  const diagnostics = checkKernelTermPaths(fakeKernel, kernelPackageRoot, sectionRoot);
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].code, "WQ032");
  assert.match(diagnostics[0].message, /cut/);
});
