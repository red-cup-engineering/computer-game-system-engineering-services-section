// Family (f) -- app-data validation (tsumego.json, lessons.json):
// WQ050-WQ054. Read-only: weiqi-lsp never authors or edits these files
// (SPEC.md Family f / the constitution's Non-ownership clause).
//
// Deviation, documented once here: neither tsumego.json nor lessons.json
// carries a `ruleset` field (confirmed by reading both files' live shape
// in full), and SPEC.md's own WQ051/WQ052/WQ054 text does not name one
// either. Every legality check in this family therefore runs under a
// fixed "chinese" ruleset default -- the same fallback WQ022 already uses
// for an SGF block with no declared RU[...] -- chosen because none of the
// twelve current tsumego problems or four current lessons turns on a
// suicide-legality or ko-regime distinction between rulesets (verified by
// reading every problem/lesson's stones and accepted moves during
// implementation); a future problem that DID depend on such a distinction
// would need SPEC.md amended to add a ruleset field before this default
// could still be trusted.

import { makeDiagnostic } from "./diagnostic.mjs";

const TSUMEGO_SOURCE = "apps/weiqi-web/public/data/tsumego-foundations.json";
const LESSONS_SOURCE = "apps/weiqi-web/public/data/lesson-*.json";
const DEFAULT_RULESET = "chinese";

function isValidCoord(pt, size, kernel) {
  if (typeof pt !== "string") return false;
  try {
    kernel.coordToPoint(size, size, pt);
    return true;
  } catch {
    return false;
  }
}

/**
 * WQ050: schema-validate every entry in tsumego.json's problems[].
 * @param {any} json
 * @param {string} file
 * @param {typeof import("../../../../weiqi-engine/src/index.mjs")} kernel
 * @returns {import("./diagnostic.mjs").Diagnostic[]}
 */
export function checkTsumegoSchema(json, file, kernel) {
  const diagnostics = [];
  if (!json || !Array.isArray(json.problems)) {
    diagnostics.push(
      makeDiagnostic({
        code: "WQ050",
        severity: "error",
        file,
        message: `tsumego.json has no top-level "problems" array.`,
        source: TSUMEGO_SOURCE,
      }),
    );
    return diagnostics;
  }
  json.problems.forEach((p, idx) => {
    const where = typeof p?.id === "string" ? p.id : `problems[${idx}]`;
    const errs = [];
    if (typeof p?.id !== "string") errs.push("id must be a string");
    if (typeof p?.set !== "string") errs.push("set must be a string");
    if (typeof p?.title !== "string") errs.push("title must be a string");
    const size = p?.size;
    if (!Number.isInteger(size) || size <= 0) errs.push("size must be a positive integer");
    if (p?.toPlay !== "black" && p?.toPlay !== "white") errs.push(`toPlay must be "black" or "white", got ${JSON.stringify(p?.toPlay)}`);
    if (!Array.isArray(p?.stones)) {
      errs.push("stones must be an array");
    } else if (Number.isInteger(size) && size > 0) {
      p.stones.forEach((s, i) => {
        if (!s || (s.color !== "black" && s.color !== "white")) errs.push(`stones[${i}].color must be "black"/"white"`);
        if (!isValidCoord(s?.pt, size, kernel)) errs.push(`stones[${i}].pt ${JSON.stringify(s?.pt)} is not a valid coordinate for size ${size}`);
      });
    }
    if (typeof p?.goal !== "string") errs.push("goal must be a string");
    const accept = p?.accept;
    if (!Array.isArray(accept) || accept.length === 0) {
      errs.push("accept must be a non-empty array");
    } else if (Number.isInteger(size) && size > 0) {
      accept.forEach((mv, i) => {
        if (mv !== "pass" && !isValidCoord(mv, size, kernel)) errs.push(`accept[${i}] ${JSON.stringify(mv)} is not "pass" or a valid coordinate for size ${size}`);
      });
    }
    if (p?.lines !== undefined && typeof p.lines === "object" && p.lines !== null) {
      for (const key of Object.keys(p.lines)) {
        if (!Array.isArray(accept) || !accept.includes(key)) errs.push(`lines key ${JSON.stringify(key)} does not appear in accept`);
      }
    } else {
      errs.push("lines must be an object");
    }
    if (errs.length > 0) {
      diagnostics.push(
        makeDiagnostic({
          code: "WQ050",
          severity: "error",
          file,
          message: `Problem "${where}": ${errs.join("; ")}.`,
          source: TSUMEGO_SOURCE,
        }),
      );
    }
  });
  return diagnostics;
}

function schemaValidEnoughForLegality(p, kernel) {
  return (
    typeof p?.id === "string" &&
    Number.isInteger(p?.size) &&
    p.size > 0 &&
    (p.toPlay === "black" || p.toPlay === "white") &&
    Array.isArray(p.stones) &&
    p.stones.every((s) => s && (s.color === "black" || s.color === "white") && isValidCoord(s.pt, p.size, kernel)) &&
    Array.isArray(p.accept) &&
    p.accept.length > 0 &&
    p.accept.every((mv) => mv === "pass" || isValidCoord(mv, p.size, kernel))
  );
}

function buildStartingPosition(p, kernel) {
  const cells = new Uint8Array(p.size * p.size);
  for (const s of p.stones) {
    const pt = kernel.coordToPoint(p.size, p.size, s.pt);
    cells[pt] = s.color === "black" ? kernel.BLACK : kernel.WHITE;
  }
  const toMove = p.toPlay === "black" ? kernel.BLACK : kernel.WHITE;
  return kernel.createPositionFromCells(p.size, p.size, cells, toMove, 0, 0);
}

/**
 * WQ051/WQ052: every accepted move is legal from the problem's starting
 * position, and every {move, reply} continuation under lines[] replays
 * legally in turn. Only evaluated for problems that already pass WQ050's
 * schema check (a schema-invalid problem has nothing safe to build a
 * position from).
 *
 * @param {any} json
 * @param {string} file
 * @param {typeof import("../../../../weiqi-engine/src/index.mjs")} kernel
 * @returns {import("./diagnostic.mjs").Diagnostic[]}
 */
export function checkTsumegoLegality(json, file, kernel) {
  const diagnostics = [];
  if (!json || !Array.isArray(json.problems)) return diagnostics;
  for (const p of json.problems) {
    if (!schemaValidEnoughForLegality(p, kernel)) continue;
    const startPosition = buildStartingPosition(p, kernel);

    for (const mv of p.accept) {
      if (mv === "pass") continue; // always legal, per SPEC.md WQ051.
      const game = new kernel.Game(p.size, DEFAULT_RULESET, startPosition);
      if (!game.isLegal(mv)) {
        diagnostics.push(
          makeDiagnostic({
            code: "WQ051",
            severity: "error",
            file,
            message: `Problem "${p.id}": accepted move "${mv}" is illegal from the declared starting position under ruleset.${DEFAULT_RULESET}.`,
            source: TSUMEGO_SOURCE,
          }),
        );
      }
    }

    const lines = p.lines && typeof p.lines === "object" ? p.lines : {};
    for (const acceptedMove of Object.keys(lines)) {
      if (!p.accept.includes(acceptedMove)) continue; // already reported by WQ050.
      const continuations = Array.isArray(lines[acceptedMove]) ? lines[acceptedMove] : [];
      for (const cont of continuations) {
        const game = new kernel.Game(p.size, DEFAULT_RULESET, startPosition);
        const steps = [acceptedMove, cont?.move, cont?.reply].filter((s) => typeof s === "string");
        let ok = true;
        for (const [i, mv] of steps.entries()) {
          const outcome = game.play(mv);
          if (!outcome.ok) {
            diagnostics.push(
              makeDiagnostic({
                code: "WQ052",
                severity: "error",
                file,
                message: `Problem "${p.id}": lines["${acceptedMove}"] continuation step ${i + 1} ("${mv}") is illegal (${outcome.reason}) under ruleset.${DEFAULT_RULESET}.`,
                source: TSUMEGO_SOURCE,
              }),
            );
            ok = false;
            break;
          }
        }
        if (!ok) continue;
      }
    }
  }
  return diagnostics;
}

/**
 * WQ053: schema-validate every entry in lessons.json.
 * @param {any} json
 * @param {string} file
 * @param {typeof import("../../../../weiqi-engine/src/index.mjs")} kernel
 * @returns {import("./diagnostic.mjs").Diagnostic[]}
 */
export function checkLessonsSchema(json, file, kernel) {
  const diagnostics = [];
  if (!Array.isArray(json)) {
    diagnostics.push(
      makeDiagnostic({
        code: "WQ053",
        severity: "error",
        file,
        message: `lessons.json's top level is not an array.`,
        source: LESSONS_SOURCE,
      }),
    );
    return diagnostics;
  }
  const slugCounts = new Map();
  for (const lesson of json) {
    if (typeof lesson?.slug === "string") slugCounts.set(lesson.slug, (slugCounts.get(lesson.slug) ?? 0) + 1);
  }
  const allSlugs = new Set(slugCounts.keys());

  json.forEach((lesson, idx) => {
    const where = typeof lesson?.slug === "string" ? lesson.slug : `lessons[${idx}]`;
    const errs = [];
    if (typeof lesson?.slug !== "string") {
      errs.push("slug must be a string");
    } else if (slugCounts.get(lesson.slug) > 1) {
      errs.push(`slug "${lesson.slug}" is not unique across the file`);
    }
    if (typeof lesson?.title !== "string") errs.push("title must be a string");
    if (!Array.isArray(lesson?.steps) || lesson.steps.length === 0) {
      errs.push("steps must be a non-empty array");
    } else {
      lesson.steps.forEach((step, i) => {
        if (!["read", "board", "exercise"].includes(step?.kind)) {
          errs.push(`steps[${i}].kind must be "read"/"board"/"exercise", got ${JSON.stringify(step?.kind)}`);
        }
        if (step?.kind === "board") {
          const b = step.board;
          if (!b || !Number.isInteger(b.size) || b.size <= 0) {
            errs.push(`steps[${i}].board.size must be a positive integer`);
          } else if (!Array.isArray(b.stones)) {
            errs.push(`steps[${i}].board.stones must be an array`);
          } else {
            b.stones.forEach((s, si) => {
              if (!s || (s.color !== "black" && s.color !== "white")) errs.push(`steps[${i}].board.stones[${si}].color must be "black"/"white"`);
              if (!isValidCoord(s?.pt, b.size, kernel)) errs.push(`steps[${i}].board.stones[${si}].pt ${JSON.stringify(s?.pt)} invalid for size ${b.size}`);
            });
          }
        }
        if (step?.kind === "exercise") {
          const e = step.exercise;
          if (!e || typeof e.prompt !== "string") errs.push(`steps[${i}].exercise.prompt must be a string`);
          if (!e || typeof e.answerText !== "string") errs.push(`steps[${i}].exercise.answerText must be a string`);
        }
      });
    }
    if (lesson?.next !== undefined) {
      if (typeof lesson.next !== "string" || !allSlugs.has(lesson.next)) {
        errs.push(`next ${JSON.stringify(lesson.next)} does not match any slug in the file`);
      }
    }
    if (errs.length > 0) {
      diagnostics.push(
        makeDiagnostic({
          code: "WQ053",
          severity: "error",
          file,
          message: `Lesson "${where}": ${errs.join("; ")}.`,
          source: LESSONS_SOURCE,
        }),
      );
    }
  });
  return diagnostics;
}

/**
 * WQ054: a "board" step with a `sequence` replays legally and its final
 * position matches board.stones exactly; a "board" step with only static
 * board.stones (no sequence) is itself a legal position (no zero-liberty
 * group), per WQ004's same check applied to app data instead of a
 * markdown diagram.
 *
 * @param {any} json
 * @param {string} file
 * @param {typeof import("../../../../weiqi-engine/src/index.mjs")} kernel
 * @returns {import("./diagnostic.mjs").Diagnostic[]}
 */
export function checkLessonBoards(json, file, kernel) {
  const diagnostics = [];
  if (!Array.isArray(json)) return diagnostics;

  for (const lesson of json) {
    if (!Array.isArray(lesson?.steps)) continue;
    lesson.steps.forEach((step, i) => {
      if (step?.kind !== "board" || !step.board) return;
      const b = step.board;
      if (!Number.isInteger(b.size) || b.size <= 0) return; // already reported by WQ053.
      const label = `Lesson "${lesson.slug}" step ${i}`;

      if (Array.isArray(b.sequence) && b.sequence.length > 0) {
        const game = new kernel.Game(b.size, DEFAULT_RULESET);
        let replayOk = true;
        for (const [j, mv] of b.sequence.entries()) {
          const outcome = game.play(mv?.move);
          if (!outcome.ok) {
            diagnostics.push(
              makeDiagnostic({
                code: "WQ054",
                severity: "error",
                file,
                message: `${label}: sequence move ${j + 1} ("${mv?.move}") is illegal (${outcome.reason}) under ruleset.${DEFAULT_RULESET}.`,
                source: LESSONS_SOURCE,
              }),
            );
            replayOk = false;
            break;
          }
        }
        if (!replayOk) return;

        const expected = new Uint8Array(b.size * b.size);
        let coordOk = true;
        for (const s of Array.isArray(b.stones) ? b.stones : []) {
          if (!isValidCoord(s?.pt, b.size, kernel)) {
            coordOk = false;
            break;
          }
          expected[kernel.coordToPoint(b.size, b.size, s.pt)] = s.color === "black" ? kernel.BLACK : kernel.WHITE;
        }
        if (!coordOk) return; // already reported by WQ053.

        const actual = game.current.board;
        let matches = actual.length === expected.length;
        if (matches) {
          for (let p = 0; p < expected.length; p++) {
            if (actual[p] !== expected[p]) {
              matches = false;
              break;
            }
          }
        }
        if (!matches) {
          diagnostics.push(
            makeDiagnostic({
              code: "WQ054",
              severity: "error",
              file,
              message: `${label}: replaying sequence to completion does not produce the declared board.stones position.`,
              source: LESSONS_SOURCE,
            }),
          );
        }
      } else {
        const cells = new Uint8Array(b.size * b.size);
        let coordOk = true;
        for (const s of Array.isArray(b.stones) ? b.stones : []) {
          if (!isValidCoord(s?.pt, b.size, kernel)) {
            coordOk = false;
            break;
          }
          cells[kernel.coordToPoint(b.size, b.size, s.pt)] = s.color === "black" ? kernel.BLACK : kernel.WHITE;
        }
        if (!coordOk) return; // already reported by WQ053.

        const seen = new Set();
        for (let point = 0; point < cells.length; point++) {
          if (cells[point] === kernel.EMPTY || seen.has(point)) continue;
          const group = kernel.findGroup(cells, b.size, b.size, point);
          for (const s of group.stones) seen.add(s);
          if (group.liberties.size === 0) {
            const colorName = group.color === kernel.BLACK ? "Black" : "White";
            diagnostics.push(
              makeDiagnostic({
                code: "WQ054",
                severity: "error",
                file,
                message: `${label}: static board position has a zero-liberty ${colorName} group -- not itself a legal position.`,
                source: LESSONS_SOURCE,
              }),
            );
          }
        }
      }
    });
  }
  return diagnostics;
}

export { TSUMEGO_SOURCE, LESSONS_SOURCE };
