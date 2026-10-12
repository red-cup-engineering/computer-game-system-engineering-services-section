import { test } from "node:test";
import assert from "node:assert/strict";
import { extractFences, looksLikeDiagramHeader, looksLikeExpectedBlock } from "../src/markdown.mjs";

test("verification fences share Markdown admission and retain editor lines", () => {
  const text = ["---", "example: |", "  ```sgf", "  ignored", "  ```", "---", "~~~sgf", "(;SZ[9])", "~~~", "````", "```", "expected:", "````"].join("\r\n");
  const fences = extractFences(text);
  assert.equal(fences.length, 2);
  assert.deepEqual(fences[0], { lang: "sgf", content: "(;SZ[9])", contentLines: ["(;SZ[9])"], fenceStartLine: 7, contentStartLine: 8 });
  assert.deepEqual(fences[1].contentLines, ["```", "expected:"]);
  assert.equal(fences[1].fenceStartLine, 10);
});

test("extractFences finds every fenced block with correct line numbers", () => {
  const text = ["intro", "```", "line a", "line b", "```", "middle", "```js", "code()", "```", "end"].join("\n");
  const fences = extractFences(text);
  assert.equal(fences.length, 2);
  assert.equal(fences[0].lang, "");
  assert.deepEqual(fences[0].contentLines, ["line a", "line b"]);
  assert.equal(fences[0].fenceStartLine, 2);
  assert.equal(fences[0].contentStartLine, 3);
  assert.equal(fences[1].lang, "js");
  assert.deepEqual(fences[1].contentLines, ["code()"]);
});

test("extractFences handles an unterminated fence by taking everything to EOF", () => {
  const text = "before\n```\nunterminated content\nmore";
  const fences = extractFences(text);
  assert.equal(fences.length, 1);
  assert.deepEqual(fences[0].contentLines, ["unterminated content", "more"]);
});

test("looksLikeDiagramHeader accepts single-letter-token headers only", () => {
  assert.equal(looksLikeDiagramHeader("A B C D E"), true);
  assert.equal(looksLikeDiagramHeader("    A B C"), true);
  assert.equal(looksLikeDiagramHeader("ko_regime : simple_ko"), false);
  assert.equal(looksLikeDiagramHeader("ruleset.chinese.ko_regime = positional_superko"), false);
  assert.equal(looksLikeDiagramHeader("A"), false); // needs >=2 tokens
  assert.equal(looksLikeDiagramHeader(""), false);
});

test("looksLikeExpectedBlock requires the first non-blank line to be exactly 'expected:'", () => {
  const fences = extractFences("```\nexpected:\n  id: R1\n```");
  assert.equal(looksLikeExpectedBlock(fences[0]), true);
  const other = extractFences("```\nnot expected: here\n```");
  assert.equal(looksLikeExpectedBlock(other[0]), false);
});
