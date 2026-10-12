import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFrontmatter, itemsOf, isNonEmpty } from "../src/frontmatter.mjs";

test("parseFrontmatter returns null when there is no --- delimited block", () => {
  assert.equal(parseFrontmatter("just a body\n"), null);
});

test("parseFrontmatter handles a 0-indent block list (ko.md's own style)", () => {
  const text = ["---", "title: ko", "aliases:", "- ko", "tags: []", "type: term", "---", "body text"].join("\n");
  const { data, bodyText, bodyStartLine } = parseFrontmatter(text);
  assert.equal(data.title, "ko");
  assert.deepEqual(itemsOf(data.aliases).map((e) => e.value), ["ko"]);
  assert.deepEqual(data.tags, []);
  assert.equal(bodyText, "body text");
  assert.equal(bodyStartLine, 8);
});

test("parseFrontmatter handles a 2-indent block list (authorization-record.md's own style)", () => {
  const text = ["---", "title: x", "authors:", "  - emsenn", "  - claude-fable-5", "---", ""].join("\n");
  const { data } = parseFrontmatter(text);
  assert.deepEqual(itemsOf(data.authors).map((e) => e.value), ["emsenn", "claude-fable-5"]);
});

test("parseFrontmatter handles a nested mapping (references: { key: { authors, title } })", () => {
  const text = [
    "---",
    "title: x",
    "references:",
    "  britgo2025default:",
    "    authors:",
    "    - Britgo2025default",
    "    title: Britgo2025default",
    "  ref1:",
    "    title: British Go Association, A. Default Rules",
    "---",
    "",
  ].join("\n");
  const { data } = parseFrontmatter(text);
  assert.ok(data.references.britgo2025default);
  assert.deepEqual(itemsOf(data.references.britgo2025default.authors).map((e) => e.value), ["Britgo2025default"]);
  assert.equal(data.references.britgo2025default.title, "Britgo2025default");
  assert.equal(data.references.ref1.title, "British Go Association, A. Default Rules");
});

test("parseFrontmatter handles a folded '>' block scalar", () => {
  const text = ["---", "description: >", "  line one", "  line two", "type: term", "---", ""].join("\n");
  const { data } = parseFrontmatter(text);
  assert.equal(data.description, "line one line two");
});

test("parseFrontmatter strips surrounding double quotes from a scalar", () => {
  const text = ['---', 'title: "quoted title"', '---', ''].join("\n");
  const { data } = parseFrontmatter(text);
  assert.equal(data.title, "quoted title");
});

test("isNonEmpty treats empty arrays/strings as empty, everything else as present", () => {
  assert.equal(isNonEmpty([]), false);
  assert.equal(isNonEmpty(""), false);
  assert.equal(isNonEmpty("  "), false);
  assert.equal(isNonEmpty(undefined), false);
  assert.equal(isNonEmpty(["x"]), true);
  assert.equal(isNonEmpty("x"), true);
});
