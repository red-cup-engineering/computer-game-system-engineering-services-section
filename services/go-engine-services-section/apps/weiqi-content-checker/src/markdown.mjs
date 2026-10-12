import { readMarkdownSource } from "@red-cup-engineering/markdown-engineering-services-section/read-markdown-structure";

/**
 * The verification rules consume domain fence records projected from the shared
 * Markdown source reading. Line numbers stay relative to the editor document.
 * @typedef {Object} Fence
 * @property {string} lang
 * @property {string} content
 * @property {string[]} contentLines
 * @property {number} fenceStartLine - 1-indexed opening line.
 * @property {number} contentStartLine - 1-indexed first content line.
 */
export function extractFences(text, { source = readMarkdownSource(text) } = {}) {
  return source.codeRanges.filter(({ type }) => type === "fenced-code").map((range) => {
    const body = source.text.slice(range.contentStart, range.contentEnd);
    const content = body.endsWith("\n") ? body.slice(0, -1) : body;
    return {
      lang: range.info,
      content,
      contentLines: body === "" ? [] : content.split("\n"),
      fenceStartLine: range.startLine,
      contentStartLine: range.startLine + 1,
    };
  });
}

/** True if `line`'s non-whitespace tokens are all single ASCII letters -- the shape of a diagram's column-letter header row (e.g. "A B C D E"). */
export function looksLikeDiagramHeader(line) {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return false;
  return tokens.every((t) => /^[A-Za-z]$/.test(t));
}

/** True if the fence's first non-blank line is literally "expected:". */
export function looksLikeExpectedBlock(fence) {
  const firstLine = fence.contentLines.find((l) => l.trim().length > 0);
  return firstLine !== undefined && firstLine.trim() === "expected:";
}
