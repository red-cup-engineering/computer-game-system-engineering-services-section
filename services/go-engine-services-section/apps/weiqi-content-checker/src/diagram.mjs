// Family (a) -- diagram parse and position legality: WQ001-WQ005.
// Normative source: regression-positions.md "Diagram format" +
// weiqi-kernel's board.mts coordinate/geometry model (SPEC.md Family a).

import { makeDiagnostic } from "./diagnostic.mjs";
import { looksLikeDiagramHeader } from "./markdown.mjs";
import { deriveColumnLetters } from "./kernel.mjs";

const REGRESSION_POSITIONS_SOURCE = "content/text/documents/articles/teaching-articles/references/regression-positions.md";
const VALID_SYMBOLS = new Set(["X", "O", ".", "*"]);

/**
 * @typedef {Object} ParsedDiagram
 * @property {number} width
 * @property {number} height
 * @property {Uint8Array} cells   - EMPTY/BLACK/WHITE per kernel's board.mts constants.
 * @property {number[]} markedPoints - points marked '*' (empty points of interest).
 * @property {boolean} shapeOk    - false if any WQ001 row-length mismatch occurred.
 * @property {number} fenceStartLine
 */

function splitRowLine(line) {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  const [rowNumberToken, ...symbols] = tokens;
  return { rowNumberToken, symbols };
}

/** Locate the 1-indexed column of the nth (0-indexed) whitespace-separated token in `line`. */
function columnOfToken(line, tokenIndex) {
  const re = /\S+/g;
  let idx = 0;
  let m;
  while ((m = re.exec(line)) !== null) {
    if (idx === tokenIndex) return m.index + 1;
    idx += 1;
  }
  return 1;
}

/**
 * Is this fence a diagram (per its header row shape), as opposed to an
 * `expected:` block or an unrelated plain fence? Diagram candidacy is
 * decided purely by the first content line's shape -- verified against the
 * full corpus (see the implementation digest) to produce zero false
 * positives outside regression-positions.md's own diagram fences.
 *
 * @param {import("./markdown.mjs").Fence} fence
 */
export function isDiagramFence(fence) {
  if (fence.lang !== "") return false;
  const firstLine = fence.contentLines.find((l) => l.trim().length > 0);
  return firstLine !== undefined && looksLikeDiagramHeader(firstLine);
}

/**
 * Run WQ001, WQ002, WQ005 against one diagram fence, and build the parsed
 * cell grid WQ004 (and Family b) needs.
 *
 * @param {import("./markdown.mjs").Fence} fence
 * @param {string} file
 * @param {typeof import("../../../../weiqi-engine/src/index.mjs")} kernel
 * @returns {{diagnostics: import("./diagnostic.mjs").Diagnostic[], diagram: ParsedDiagram}}
 */
export function checkDiagramFence(fence, file, kernel) {
  const diagnostics = [];
  const nonBlank = fence.contentLines.map((l, idx) => ({ l, idx })).filter((e) => e.l.trim().length > 0);
  const headerEntry = nonBlank[0];
  const headerLine = headerEntry.l;
  const headerLineNumber = fence.contentStartLine + headerEntry.idx;
  const headerTokens = headerLine.trim().split(/\s+/).filter(Boolean);
  const width = headerTokens.length;

  // WQ005: header letters must be the sequential skip-I prefix for `width`.
  const expectedLetters = deriveColumnLetters(width, kernel);
  const actualLetters = headerTokens.map((t) => t.toUpperCase());
  const headerMismatch = expectedLetters.some((letter, i) => letter !== actualLetters[i]);
  if (headerMismatch) {
    diagnostics.push(
      makeDiagnostic({
        code: "WQ005",
        severity: "error",
        file,
        message: `Diagram header "${headerTokens.join(" ")}" does not match the expected skip-I column letters "${expectedLetters.join(" ")}" for a ${width}-column diagram.`,
        source: REGRESSION_POSITIONS_SOURCE,
        start: { line: headerLineNumber, column: 1 },
      }),
    );
  }

  const rowEntries = nonBlank.slice(1);
  const height = rowEntries.length;
  const cells = new Uint8Array(width * height);
  const markedPoints = [];
  let shapeOk = true;

  rowEntries.forEach((entry, r) => {
    const rowLineNumber = fence.contentStartLine + entry.idx;
    const { symbols } = splitRowLine(entry.l);
    if (symbols.length !== width) {
      shapeOk = false;
      diagnostics.push(
        makeDiagnostic({
          code: "WQ001",
          severity: "error",
          file,
          message: `Diagram row ${r + 1} has ${symbols.length} symbol(s), but the header declares ${width} column(s).`,
          source: REGRESSION_POSITIONS_SOURCE,
          start: { line: rowLineNumber, column: 1 },
        }),
      );
    }
    symbols.forEach((sym, c) => {
      if (c >= width) return; // already reported as WQ001; don't index out of bounds
      const point = r * width + c;
      if (!VALID_SYMBOLS.has(sym)) {
        diagnostics.push(
          makeDiagnostic({
            code: "WQ002",
            severity: "error",
            file,
            message: `Diagram row ${r + 1} contains unrecognized symbol "${sym}" (valid: X, O, ., *).`,
            source: REGRESSION_POSITIONS_SOURCE,
            // +1 to skip the row-number token itself when locating the column.
            start: { line: rowLineNumber, column: columnOfToken(entry.l, c + 1) },
          }),
        );
        return;
      }
      if (sym === "X") cells[point] = kernel.BLACK;
      else if (sym === "O") cells[point] = kernel.WHITE;
      else if (sym === "*") markedPoints.push(point);
      // "." leaves cells[point] at its EMPTY default (0).
    });
  });

  return {
    diagnostics,
    diagram: { width, height, cells, markedPoints, shapeOk, fenceStartLine: fence.fenceStartLine },
  };
}

/**
 * WQ004: no stone group on the raw diagram may have zero liberties. Skipped
 * (not evaluated) when the diagram's own shape was malformed (WQ001 fired)
 * -- a garbled grid has no meaningful group structure to report on.
 *
 * @param {ParsedDiagram} diagram
 * @param {string} file
 * @param {typeof import("../../../../weiqi-engine/src/index.mjs")} kernel
 * @returns {import("./diagnostic.mjs").Diagnostic[]}
 */
export function checkZeroLibertyGroups(diagram, file, kernel) {
  if (!diagram.shapeOk) return [];
  const { width, height, cells } = diagram;
  const diagnostics = [];
  const seen = new Set();
  for (let point = 0; point < cells.length; point++) {
    if (cells[point] === kernel.EMPTY || seen.has(point)) continue;
    const group = kernel.findGroup(cells, width, height, point);
    for (const s of group.stones) seen.add(s);
    if (group.liberties.size === 0) {
      const colorName = group.color === kernel.BLACK ? "Black" : "White";
      const stoneCoords = group.stones.map((p) => kernel.pointToCoord(width, p)).sort();
      diagnostics.push(
        makeDiagnostic({
          code: "WQ004",
          severity: "error",
          file,
          message: `${colorName} group {${stoneCoords.join(", ")}} has zero liberties in a diagram meant to encode a settled position -- either mistranscribed, or a mid-resolution state that must say so explicitly in prose.`,
          source: REGRESSION_POSITIONS_SOURCE,
        }),
      );
    }
  }
  return diagnostics;
}

/**
 * WQ003: a coordinate resolves within `diagram`'s own width/height. Used by
 * Family (b) while cross-checking an expected: block's keys/values against
 * its paired diagram (WQ003 is catalogued under Family a, but by
 * definition needs both a diagram and a coordinate-bearing claim to check,
 * so its evaluation is driven from src/expected-block.mjs, which calls this
 * helper for every coordinate it extracts).
 *
 * @param {string} coord
 * @param {ParsedDiagram} diagram
 * @param {typeof import("../../../../weiqi-engine/src/index.mjs")} kernel
 * @returns {boolean}
 */
export function coordInRange(coord, diagram, kernel) {
  try {
    kernel.coordToPoint(diagram.width, diagram.height, coord);
    return true;
  } catch {
    return false;
  }
}

export { REGRESSION_POSITIONS_SOURCE };
