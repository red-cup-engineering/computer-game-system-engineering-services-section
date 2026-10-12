// Family (b) -- diagram-vs-expected: consistency, recomputed via the
// kernel: WQ010-WQ014, WQ019. Also drives WQ003 (catalogued under Family a,
// but by definition needs both a diagram and an expected: block's
// coordinate-bearing claims to evaluate -- see diagram.mjs's coordInRange).
//
// Normative source: regression-positions.md's own "Each position carries
// an id... and an expected: block" contract, recomputed (not merely
// parsed) against @red-cup-engineering/weiqi-engine (SPEC.md Family b).
//
// Scope decision, stated once here rather than re-derived per rule: this
// module checks only the expected: block's own FLAT top-level keys (one
// indent level under `expected:`). R11's `area_scoring:`/`territory_scoring:`
// sub-blocks nest their score keys one level deeper AND describe a position
// (Black plays an extra stone at A3) that no diagram in the corpus encodes
// -- attempting to recompute those nested claims against R9's raw diagram
// would be a false mismatch, not a real one, since the position they
// describe was never re-diagrammed. Every other rule in this family's own
// SPEC.md minimal-trigger example uses a flat top-level key, so this is a
// literal reading of the catalog, not a workaround; documented again in
// the package README's Family (b) scope note.

import { makeDiagnostic } from "./diagnostic.mjs";
import { coordInRange, REGRESSION_POSITIONS_SOURCE } from "./diagram.mjs";

const RULESETS_SOURCE = "content/text/documents/articles/teaching-articles/references/rulesets.md";
const KERNEL_EVENTS_SOURCE = "@red-cup-engineering/weiqi-engine/src/events.mts";

function leadingSpaces(line) {
  const m = /^(\s*)/.exec(line);
  return m[1].length;
}

/**
 * Purpose-built parser for this corpus's `expected:` block convention --
 * NOT a general YAML parser (this package is zero-dependency and has no
 * YAML library to reach for). Handles exactly the shapes read directly out
 * of regression-positions.md during implementation: flat `key: value`
 * scalars, `key: >` folded block scalars, and nested mappings (whose
 * children are skipped rather than flattened -- see the module-level scope
 * note above).
 *
 * @param {import("./markdown.mjs").Fence} fence
 * @returns {{keys: Map<string, {value: string|null, line: number, kind: "scalar"|"block"|"nested"}>, rawText: string}}
 */
export function parseExpectedBlock(fence) {
  const lines = fence.contentLines;
  const headerIdx = lines.findIndex((l) => l.trim() === "expected:");
  const keys = new Map();
  if (headerIdx === -1) return { keys, rawText: fence.content };

  let j = headerIdx + 1;
  while (j < lines.length && lines[j].trim() === "") j++;
  if (j >= lines.length) return { keys, rawText: fence.content };
  const baseIndent = leadingSpaces(lines[j]);

  while (j < lines.length) {
    const line = lines[j];
    if (line.trim() === "") {
      j++;
      continue;
    }
    const indent = leadingSpaces(line);
    if (indent < baseIndent) break;
    if (indent > baseIndent) {
      j++;
      continue;
    }
    const m = /^\s*([A-Za-z0-9_]+):[ \t]?(.*)$/.exec(line);
    if (!m) {
      j++;
      continue;
    }
    const key = m[1];
    const rest = m[2];
    const keyLine = fence.contentStartLine + j;

    if (rest === ">" || rest === "|") {
      const chunks = [];
      j++;
      while (j < lines.length && (lines[j].trim() === "" || leadingSpaces(lines[j]) > baseIndent)) {
        if (lines[j].trim() !== "") chunks.push(lines[j].trim());
        j++;
      }
      keys.set(key, { value: chunks.join(" "), line: keyLine, kind: "block" });
      continue;
    }
    if (rest === "") {
      j++;
      while (j < lines.length && (lines[j].trim() === "" || leadingSpaces(lines[j]) > baseIndent)) j++;
      keys.set(key, { value: null, line: keyLine, kind: "nested" });
      continue;
    }
    let value = rest;
    j++;
    while (j < lines.length && lines[j].trim() !== "" && leadingSpaces(lines[j]) > baseIndent) {
      value += " " + lines[j].trim();
      j++;
    }
    value = value.replace(/\s+#.*$/, "").trim();
    value = value.replace(/^"(.*)"$/, "$1");
    keys.set(key, { value, line: keyLine, kind: "scalar" });
  }
  return { keys, rawText: fence.content };
}

function parseListValue(value) {
  const m = /^\[(.*)\]$/.exec(value.trim());
  if (!m) return null;
  return m[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function countStonesOfColor(cells, color) {
  let n = 0;
  for (const c of cells) if (c === color) n += 1;
  return n;
}

/**
 * Mirrors `game.mts`'s own (module-private) `checkKoViolation` for the one
 * history shape this module can ever construct from a static diagram: a
 * FRESH, single-position history (`Game.history = [initial]`, per the
 * ko_point deviation note below -- a diagram is a snapshot, not a game
 * record). `checkKoViolation` is not part of the kernel's public surface
 * (game.mts exports it only under the test-only alias
 * `_checkKoViolationForTests`), so a length-1-history-shaped equivalent is
 * reproduced here rather than reached into privately.
 *
 * For a length-1 history [initial]: simple_ko never fires (it requires
 * history.length >= 2, i.e. an opponent's prior move to recreate);
 * positional_superko fires iff candidate's board arrangement matches
 * initial's; situational_superko fires iff candidate's (arrangement,
 * toMove) pair matches initial's. This is exactly what `checkKoViolation`
 * itself computes when handed a one-entry history -- not an approximation.
 *
 * @param {import("../../../../weiqi-engine/src/position.mjs").Position} initial
 * @param {import("../../../../weiqi-engine/src/position.mjs").Position} candidate
 * @param {string} regime
 * @returns {boolean}
 */
function violatesKoAgainstFreshHistory(initial, candidate, regime) {
  if (regime === "simple_ko") return false;
  if (regime === "positional_superko") return candidate.boardHash === initial.boardHash;
  return candidate.situationalHash === initial.situationalHash; // situational_superko
}

/**
 * Would `color` playing at `coord` be legal on `diagram`, under `ruleset`?
 * Built directly from the kernel's rectangle-capable position/board
 * primitives (`coordToPoint`, `applyStonePlacement`, both `width`x`height`
 * throughout) rather than `game.mts`'s `Game`, whose constructor takes one
 * `size` used for both dimensions and therefore cannot represent a
 * non-square diagram at all (`coordToPoint(this.size, this.size, move)`,
 * `createEmptyPosition(size)`) -- see the README's Deviations section.
 * `applyStonePlacement` plus `violatesKoAgainstFreshHistory` above
 * reproduce `Game.isLegal`'s exact semantics for a diagram-only (no real
 * move history) game, so this is not an approximation of what `Game` would
 * report -- it is what `Game.isLegal` computes, for boards `Game` cannot
 * even construct.
 *
 * @param {import("./diagram.mjs").ParsedDiagram} diagram
 * @param {string} coord
 * @param {number} color
 * @param {import("../../../../weiqi-engine/src/rulesets.mjs").Ruleset} ruleset
 * @param {typeof import("../../../../weiqi-engine/src/index.mjs")} kernel
 * @returns {boolean|null} null if the coordinate does not resolve on this diagram (WQ003 reports that separately).
 */
function isLegalOnDiagram(diagram, coord, color, ruleset, kernel) {
  let point;
  try {
    point = kernel.coordToPoint(diagram.width, diagram.height, coord);
  } catch {
    return null;
  }
  const initial = kernel.createPositionFromCells(diagram.width, diagram.height, diagram.cells, color, 0, 0);
  const placement = kernel.applyStonePlacement(initial, point, ruleset);
  if (!placement.ok) return false;
  return !violatesKoAgainstFreshHistory(initial, placement.position, ruleset.ko_regime);
}

/**
 * @param {Object} args
 * @param {import("./markdown.mjs").Fence} args.fence
 * @param {string} args.file
 * @param {import("./diagram.mjs").ParsedDiagram|null} args.diagram - the diagram this expected: block is paired with (nearest preceding diagram fence in the same file), or null if none has appeared yet.
 * @param {typeof import("../../../../weiqi-engine/src/index.mjs")} args.kernel
 * @returns {import("./diagnostic.mjs").Diagnostic[]}
 */
export function checkExpectedBlock({ fence, file, diagram, kernel }) {
  const parsed = parseExpectedBlock(fence);
  const idEntry = parsed.keys.get("id");
  const id = idEntry?.value ?? "(unlabeled position)";
  const blockLine = fence.contentStartLine;

  // Refusal condition, per the constitution: R2/R3-style self-disclaimed
  // "structural specification" positions are skipped by string match on
  // the note: field's own disclaimer, rather than fabricating a move list.
  if (/structural specification/i.test(parsed.rawText)) {
    return [
      makeDiagnostic({
        code: "WQ019",
        severity: "info",
        file,
        message: `${id}: skipped, self-disclaimed -- its own note: field states it is a "structural specification, not a fully traced sequence." Family (b) legality/score verification does not attempt to fabricate an intervening move list to check it.`,
        source: REGRESSION_POSITIONS_SOURCE,
        start: { line: blockLine, column: 1 },
      }),
    ];
  }

  const diagnostics = [];

  // WQ014: unknown ruleset identifier -- checked by calling getRuleset,
  // never by transcribing the catalog's own prose list (see the digest's
  // flagged new_zealand/newzealand drift; this is exactly why).
  let ruleset = null;
  let rulesetName = null;
  const rulesetEntry = parsed.keys.get("ruleset");
  if (rulesetEntry && rulesetEntry.kind === "scalar") {
    rulesetName = rulesetEntry.value;
    try {
      ruleset = kernel.getRuleset(rulesetName);
    } catch {
      diagnostics.push(
        makeDiagnostic({
          code: "WQ014",
          severity: "error",
          file,
          message: `${id}: unknown ruleset identifier "${rulesetName}" (known: ${Object.keys(kernel.RULESETS).join(", ")}).`,
          source: RULESETS_SOURCE,
          start: { line: rulesetEntry.line, column: 1 },
        }),
      );
    }
  }

  // Coordinates collected for WQ003, evaluated once diagram is known.
  const coordClaims = []; // {coord, line}

  if (diagram) {
    // WQ010: stone-count keys.
    for (const [key, entry] of parsed.keys) {
      const m = /^(black|white)_stones(?:_on_board)?$/.exec(key);
      if (!m || entry.kind !== "scalar") continue;
      const claimed = Number(entry.value);
      if (!Number.isFinite(claimed)) continue;
      const color = m[1] === "black" ? kernel.BLACK : kernel.WHITE;
      const actual = diagram.shapeOk ? countStonesOfColor(diagram.cells, color) : null;
      if (actual !== null && actual !== claimed) {
        diagnostics.push(
          makeDiagnostic({
            code: "WQ010",
            severity: "error",
            file,
            message: `${id}: ${key} claims ${claimed}, but the diagram has ${actual} ${m[1]} stone(s).`,
            source: REGRESSION_POSITIONS_SOURCE,
            start: { line: entry.line, column: 1 },
          }),
        );
      }
    }

    // WQ011/WQ012: territory/area/score/margin, recomputed via scoring.mts.
    if (diagram.shapeOk) {
      const position = kernel.createPositionFromCells(diagram.width, diagram.height, diagram.cells, kernel.BLACK, 0, 0);
      const territory = kernel.computeTerritory(position);

      for (const [key, entry] of parsed.keys) {
        if (entry.kind !== "scalar") continue;
        const tm = /^(black|white)_territory$/.exec(key);
        if (tm) {
          const claimed = Number(entry.value);
          if (!Number.isFinite(claimed)) continue;
          const actual = tm[1] === "black" ? territory.blackTerritory : territory.whiteTerritory;
          if (actual !== claimed) {
            diagnostics.push(
              makeDiagnostic({
                code: "WQ011",
                severity: "error",
                file,
                message: `${id}: ${key} claims ${claimed}, but computeTerritory reports ${actual}.`,
                source: "@red-cup-engineering/weiqi-engine/src/scoring.mts",
                start: { line: entry.line, column: 1 },
              }),
            );
          }
        }
      }

      if (ruleset) {
        const areaResult = kernel.scoreArea(position, ruleset);
        const territoryResult = kernel.scoreTerritory(position, ruleset);
        const hasAreaKeys = parsed.keys.has("black_area_score") || parsed.keys.has("white_area_score");
        const hasTerritoryKeys = parsed.keys.has("black_territory_score") || parsed.keys.has("white_territory_score");
        const mode = hasAreaKeys ? "area" : hasTerritoryKeys ? "territory" : null;
        const modeResult = mode === "area" ? areaResult : mode === "territory" ? territoryResult : null;

        // NOTE: kernel.scoreArea/scoreTerritory bake komi directly into
        // .whiteScore (there is no separate "raw, komi-free" field on
        // ScoreResult) -- but this corpus's own black_area_score/
        // white_area_score/*_territory_score keys are deliberately the
        // KOMI-FREE raw totals (R9: white_area_score: 16, then a SEPARATE
        // white_final_with_komi: 23.5 = 16 + komi). Black's own keys match
        // .blackScore directly since the kernel never adds komi to Black.
        // White's raw totals are reconstructed here from the ScoreResult's
        // own stones/territory(+prisoners) fields rather than subtracting
        // komi back out of .whiteScore, so this never silently drifts if
        // scoring.mts's own formula ever changes.
        const scoreChecks = [
          ["black_area_score", areaResult?.blackScore, "@red-cup-engineering/weiqi-engine/src/scoring.mts"],
          ["white_area_score", areaResult ? areaResult.whiteStones + areaResult.whiteTerritory : undefined, "@red-cup-engineering/weiqi-engine/src/scoring.mts"],
          ["black_territory_score", territoryResult?.blackScore, "@red-cup-engineering/weiqi-engine/src/scoring.mts"],
          [
            "white_territory_score",
            territoryResult ? territoryResult.whiteTerritory + territoryResult.whitePrisoners : undefined,
            "@red-cup-engineering/weiqi-engine/src/scoring.mts",
          ],
        ];
        for (const [key, actual] of scoreChecks) {
          const entry = parsed.keys.get(key);
          if (!entry || entry.kind !== "scalar") continue;
          const claimed = Number(entry.value);
          if (!Number.isFinite(claimed)) continue;
          if (actual !== claimed) {
            diagnostics.push(
              makeDiagnostic({
                code: "WQ011",
                severity: "error",
                file,
                message: `${id}: ${key} claims ${claimed}, but the kernel computes ${actual} under ruleset.${rulesetName}.`,
                source: "@red-cup-engineering/weiqi-engine/src/scoring.mts",
                start: { line: entry.line, column: 1 },
              }),
            );
          }
        }

        if (modeResult) {
          for (const key of ["black_final_with_komi", "white_final_with_komi"]) {
            const entry = parsed.keys.get(key);
            if (!entry || entry.kind !== "scalar") continue;
            const claimed = Number(entry.value);
            if (!Number.isFinite(claimed)) continue;
            const actual = key.startsWith("black") ? modeResult.blackScore : modeResult.whiteScore;
            if (actual !== claimed) {
              diagnostics.push(
                makeDiagnostic({
                  code: "WQ011",
                  severity: "error",
                  file,
                  message: `${id}: ${key} claims ${claimed}, but the kernel computes ${actual} under ruleset.${rulesetName} (${mode} scoring).`,
                  source: "@red-cup-engineering/weiqi-engine/src/scoring.mts",
                  start: { line: entry.line, column: 1 },
                }),
              );
            }
          }

          // WQ012: margin string.
          const marginEntry = parsed.keys.get("margin");
          if (marginEntry && marginEntry.kind === "scalar") {
            if (marginEntry.value !== modeResult.margin) {
              diagnostics.push(
                makeDiagnostic({
                  code: "WQ012",
                  severity: "error",
                  file,
                  message: `${id}: margin claims "${marginEntry.value}", but the kernel computes "${modeResult.margin}" under ruleset.${rulesetName} (${mode} scoring).`,
                  source: "apps/weiqi-kernel/src/scoring.mts",
                  start: { line: marginEntry.line, column: 1 },
                }),
              );
            }
          }
        }
      }
    }

    // WQ013: <color>_may_play_<coord>: legal|illegal, with an optional
    // "(under ruleset.A[, ruleset.B...][ only])" qualifier naming which
    // ruleset(s) the claim applies to. A bare claim with no qualifier is
    // checked against every ruleset the kernel knows (per R1's own prose:
    // "under every ruleset in this corpus, since simple ko is their shared
    // baseline"), read dynamically from kernel.RULESETS rather than a
    // hardcoded list, so a ruleset rename can never silently desync this
    // check from what the kernel actually resolves.
    //
    // Evaluated via isLegalOnDiagram (kernel position/board primitives),
    // not `new kernel.Game(...)`: Game is square-only (one `size` used for
    // both dimensions), so it cannot even be constructed for a non-square
    // diagram -- and this corpus's own regression-positions.md already has
    // several (R6 3x2, R7 4x3, R9 7x5). isLegalOnDiagram computes exactly
    // what Game.isLegal would for a diagram-only (single-position-history)
    // game -- see its own doc comment -- so this covers rectangles without
    // silently skipping them or changing square-diagram results. See the
    // README's Deviations section.
    //
    // Structural scope boundary, not a bug: a `ko_point:` claim (e.g. R1)
    // depends on GAME HISTORY -- simple ko forbids only recreating the
    // position immediately before the opponent's last move (game.mts's
    // checkKoViolation reads history[history.length-2]) -- and a single
    // diagram is a snapshot with no history. "Constructing a Game from the
    // parsed diagram" (SPEC.md's own phrase) necessarily starts that
    // Game's history at length 1, so it can never recreate an earlier
    // position and can therefore never detect a ko violation, no matter
    // how the diagram is read. Fabricating a synthetic one-ply-back
    // position to feed the ko check would be inventing data the diagram
    // does not contain -- exactly what the constitution's refusal
    // conditions forbid ("never guess... on malformed input"), so a
    // ko-governed claim is reported not-verified (mirroring WQ019's own
    // stance) rather than mis-verified.
    const koPointEntry = parsed.keys.get("ko_point");
    if (koPointEntry) {
      diagnostics.push(
        makeDiagnostic({
          code: "WQ013",
          severity: "info",
          file,
          message: `${id}: legality claim(s) gated by ko_point: ${koPointEntry.value} are NOT VERIFIED -- simple-ko/superko legality depends on game history (game.mts's checkKoViolation reads two prior positions back), which a single static diagram cannot encode. Only suicide/occupancy-governed claims are recomputed by this rule.`,
          source: "@red-cup-engineering/weiqi-engine/src/game.mts",
          start: { line: koPointEntry.line, column: 1 },
        }),
      );
      coordClaims.push({ coord: koPointEntry.value, line: koPointEntry.line });
    } else if (diagram.shapeOk) {
      for (const [key, entry] of parsed.keys) {
        const mm = /^(black|white)_may_play_([A-Za-z]+\d+)$/.exec(key);
        if (!mm || entry.kind !== "scalar") continue;
        const [, colorWord, coord] = mm;
        coordClaims.push({ coord, line: entry.line });
        const verdictMatch = /^(legal|illegal)\b/i.exec(entry.value);
        if (!verdictMatch) continue;
        const claimedLegal = verdictMatch[1].toLowerCase() === "legal";
        const rulesetMatches = [...entry.value.matchAll(/ruleset\.(\w+)/g)].map((m) => m[1]);
        const rulesetNames = rulesetMatches.length > 0 ? rulesetMatches : Object.keys(kernel.RULESETS);
        const color = colorWord === "black" ? kernel.BLACK : kernel.WHITE;

        for (const rn of rulesetNames) {
          if (!(rn in kernel.RULESETS)) continue; // unknown ruleset name inside a legality qualifier: WQ014 is scoped to the top-level `ruleset:` key only, not this prose form.
          const ruleset = kernel.getRuleset(rn);
          const actualLegal = isLegalOnDiagram(diagram, coord, color, ruleset, kernel);
          if (actualLegal === null) continue; // coordinate out of range: WQ003 reports this separately.
          if (actualLegal !== claimedLegal) {
            diagnostics.push(
              makeDiagnostic({
                code: "WQ013",
                severity: "error",
                file,
                message: `${id}: ${key} claims ${claimedLegal ? "legal" : "illegal"} under ruleset.${rn}, but the kernel reports playing ${coord} would be ${actualLegal ? "legal" : "illegal"}.`,
                source: "@red-cup-engineering/weiqi-engine/src/game.mts",
                start: { line: entry.line, column: 1 },
              }),
            );
          }
        }
      }
    }

    // WQ019: status: seki|dead claims are never confirmed or denied --
    // report only the mechanical facts findGroup can confirm.
    const statusEntry = parsed.keys.get("status");
    if (statusEntry && statusEntry.kind === "scalar" && diagram.shapeOk) {
      let targetPoints = null;
      const groupKeyEntry = [...parsed.keys.entries()].find(([k]) => /_group$/.test(k));
      if (groupKeyEntry) {
        const [, entry] = groupKeyEntry;
        const list = entry.kind === "scalar" ? parseListValue(entry.value) : null;
        if (list) {
          targetPoints = [];
          for (const coord of list) {
            coordClaims.push({ coord, line: entry.line });
            if (coordInRange(coord, diagram, kernel)) {
              targetPoints.push(kernel.coordToPoint(diagram.width, diagram.height, coord));
            }
          }
        }
      }
      const seen = new Set();
      const facts = [];
      const pointsToScan = targetPoints ?? [...diagram.cells.keys()];
      for (const point of pointsToScan) {
        if (diagram.cells[point] === kernel.EMPTY || seen.has(point)) continue;
        const group = kernel.findGroup(diagram.cells, diagram.width, diagram.height, point);
        for (const s of group.stones) seen.add(s);
        const colorName = group.color === kernel.BLACK ? "Black" : "White";
        const coords = group.stones.map((p) => kernel.pointToCoord(diagram.width, p)).sort();
        facts.push(`${colorName} {${coords.join(", ")}} has ${group.liberties.size} liberty(ies)`);
      }
      diagnostics.push(
        makeDiagnostic({
          code: "WQ019",
          severity: "info",
          file,
          message: `${id}: status: ${statusEntry.value} is NOT VERIFIED -- neither weiqi-lsp nor weiqi-kernel is a life-and-death solver. Mechanical facts confirmed: ${facts.length > 0 ? facts.join("; ") : "(no occupied points to report)"}.`,
          source: KERNEL_EVENTS_SOURCE,
          start: { line: statusEntry.line, column: 1 },
        }),
      );
    }

    // Remaining coordinate-bearing key: points (list). ko_point was already
    // collected above, alongside its WQ013 not-verified diagnostic.
    const pointsEntry = parsed.keys.get("points");
    if (pointsEntry && pointsEntry.kind === "scalar") {
      const list = parseListValue(pointsEntry.value);
      if (list) for (const coord of list) coordClaims.push({ coord, line: pointsEntry.line });
    }

    // WQ003: every collected coordinate must resolve on this diagram.
    for (const { coord, line } of coordClaims) {
      if (!coordInRange(coord, diagram, kernel)) {
        diagnostics.push(
          makeDiagnostic({
            code: "WQ003",
            severity: "error",
            file,
            message: `${id}: coordinate "${coord}" is out of range for this ${diagram.width}x${diagram.height} diagram.`,
            source: REGRESSION_POSITIONS_SOURCE,
            start: { line, column: 1 },
          }),
        );
      }
    }
  }

  return diagnostics;
}
