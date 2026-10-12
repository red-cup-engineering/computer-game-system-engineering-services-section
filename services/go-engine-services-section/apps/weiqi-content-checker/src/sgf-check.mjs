// Family (c) -- SGF blocks parse and replay legally: WQ020-WQ023, plus
// WQ024 (RU[...] present but unrecognized even after normalization -- an
// addition beyond SPEC.md's own catalog; see the README's Deviations
// section for why).
// Normative source: weiqi-kernel's sgf.mts parse/serialize contract and the
// Weiqi Kernel Constitution's own SGF refusal condition (SPEC.md Family c).
//
// Scope note carried from SPEC.md itself: no file in this corpus currently
// contains a fenced ```sgf block, so this module ships untested against
// real content -- it is exercised here only by synthetic fixtures built
// directly from the rule catalog's own minimal triggers. See the package
// README's "Deferred" section.

import { makeDiagnostic } from "./diagnostic.mjs";

const SGF_SOURCE = "@red-cup-engineering/weiqi-engine/src/sgf.mts";
const KERNEL_CONSTITUTION_SOURCE =
  "content/text/documents/articles/notes/weiqi-kernel-constitution.md";
const RULESETS_SOURCE = "content/text/documents/articles/teaching-articles/references/rulesets.md";

// SGF FF4 defines five PREDEFINED RU[...] spellings (see the SGF property
// spec's RU entry) that don't literally match this kernel's own
// lowercase-no-space ruleset keys -- "NZ" for New Zealand rules, "GOE" for
// the Ing (Ing Chang-ki) rules -- and real Go software's RU casing varies
// freely regardless (RU[Chinese] is at least as common in the wild as
// RU[chinese]). Case/whitespace and these standard aliases are folded here
// so a differently-cased or standard-FF4-spelled ruleset name a real SGF
// file actually uses never gets treated as unknown.
const FF4_RULESET_ALIASES = {
  aga: "aga",
  goe: "ing",
  japanese: "japanese",
  nz: "newzealand",
  chinese: "chinese",
};

/**
 * Resolve a raw `RU[...]` value to one of this kernel's own ruleset keys,
 * case-insensitively and trimmed, first against the kernel's own key
 * spellings (so `RU[Chinese]`/`RU[CHINESE]`/`RU[ chinese ]` all resolve
 * identically to `RU[chinese]`) and then against the standard SGF FF4
 * aliases above. Returns `null` for a value that resolves to neither --
 * a genuinely unknown ruleset, not a masking case/alias mismatch.
 *
 * @param {string} raw
 * @param {typeof import("../../../../weiqi-engine/src/index.mjs")} kernel
 * @returns {string|null}
 */
export function normalizeRulesetName(raw, kernel) {
  const lower = raw.trim().toLowerCase();
  if (lower in kernel.RULESETS) return lower;
  if (lower in FF4_RULESET_ALIASES) return FF4_RULESET_ALIASES[lower];
  return null;
}

function movesEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].color !== b[i].color || a[i].point !== b[i].point) return false;
  }
  return true;
}

/**
 * @param {import("./markdown.mjs").Fence} fence
 * @param {string} file
 * @param {typeof import("../../../../weiqi-engine/src/index.mjs")} kernel
 * @returns {import("./diagnostic.mjs").Diagnostic[]}
 */
export function checkSgfFence(fence, file, kernel) {
  const diagnostics = [];
  const at = { line: fence.contentStartLine, column: 1 };

  let record;
  try {
    kernel.parseSgfCollection(fence.content); // WQ020: must parse as well-formed SGF at all.
    record = kernel.sgfToGameRecord(fence.content);
  } catch (err) {
    diagnostics.push(
      makeDiagnostic({
        code: "WQ020",
        severity: "error",
        file,
        message: `SGF block does not parse: ${err instanceof Error ? err.message : String(err)}`,
        source: SGF_SOURCE,
        start: at,
      }),
    );
    return diagnostics;
  }

  // WQ022: missing RU[...] -- not fatal to replay (falls back to chinese),
  // but an undeclared ruleset means legality was checked against an
  // assumption the SGF text itself never states.
  if (!record.ruleset) {
    diagnostics.push(
      makeDiagnostic({
        code: "WQ022",
        severity: "warning",
        file,
        message: `SGF block declares no RU[...] property; replay falls back to ruleset "chinese", an assumption the document itself never states.`,
        source: SGF_SOURCE,
        start: at,
      }),
    );
  }

  // WQ024: RU[...] is present but does not resolve to any ruleset this
  // kernel knows, even after normalizing case/whitespace and the standard
  // SGF FF4 aliases (see normalizeRulesetName above) -- a genuinely
  // unrecognized value, not a case/alias mismatch (RU[Chinese] resolves
  // silently; RU[Chineese] does not). This is its OWN diagnostic, separate
  // from WQ022, so it can never be confused with the "no RU at all" case:
  // replay still runs (under the same "chinese" fallback WQ022 uses) so a
  // real illegal move in the main line is never masked behind this
  // warning -- exactly what previously happened when getRuleset() threw on
  // a differently-cased RU value and swallowed the WQ021 finding.
  let rulesetName = "chinese";
  if (record.ruleset) {
    const normalized = normalizeRulesetName(record.ruleset, kernel);
    if (normalized) {
      rulesetName = normalized;
    } else {
      diagnostics.push(
        makeDiagnostic({
          code: "WQ024",
          severity: "warning",
          file,
          message: `SGF block's RU[${record.ruleset}] does not resolve to a known ruleset (known: ${Object.keys(kernel.RULESETS).join(", ")}, plus the standard SGF FF4 aliases AGA/GOE/Japanese/NZ/Chinese); replay falls back to ruleset "chinese" so a real illegal move is still caught.`,
          source: RULESETS_SOURCE,
          start: at,
        }),
      );
    }
  }

  // WQ021: every move in the main line must be legal, in order.
  try {
    const game = new kernel.Game(record.size, rulesetName);
    for (const [i, mv] of record.moves.entries()) {
      const moveStr = mv.point === "pass" ? "pass" : kernel.pointToCoord(record.size, mv.point);
      const outcome = game.play(moveStr);
      if (!outcome.ok) {
        diagnostics.push(
          makeDiagnostic({
            code: "WQ021",
            severity: "error",
            file,
            message: `SGF main line move ${i + 1} ("${moveStr}") is illegal: ${outcome.reason}.`,
            source: "@red-cup-engineering/weiqi-engine/src/game.mts",
            start: at,
          }),
        );
        break;
      }
    }
  } catch (err) {
    diagnostics.push(
      makeDiagnostic({
        code: "WQ021",
        severity: "error",
        file,
        message: `SGF main line could not be replayed: ${err instanceof Error ? err.message : String(err)}`,
        source: "@red-cup-engineering/weiqi-engine/src/game.mts",
        start: at,
      }),
    );
  }

  // WQ023: round-trip fidelity, independent of whether replay succeeded --
  // the kernel constitution requires the round-trip guarantee of the SGF
  // layer itself, not only of legal games.
  try {
    const reserialized = kernel.gameRecordToSgf(record);
    const reparsed = kernel.sgfToGameRecord(reserialized);
    if (!movesEqual(record.moves, reparsed.moves)) {
      diagnostics.push(
        makeDiagnostic({
          code: "WQ023",
          severity: "error",
          file,
          message: `SGF round-trip changed the encoded move sequence: ${record.moves.length} move(s) in, ${reparsed.moves.length} move(s) out after gameRecordToSgf(sgfToGameRecord(text)).`,
          source: KERNEL_CONSTITUTION_SOURCE,
          start: at,
        }),
      );
    }
  } catch (err) {
    diagnostics.push(
      makeDiagnostic({
        code: "WQ023",
        severity: "error",
        file,
        message: `SGF round-trip failed: ${err instanceof Error ? err.message : String(err)}`,
        source: KERNEL_CONSTITUTION_SOURCE,
        start: at,
      }),
    );
  }

  return diagnostics;
}
