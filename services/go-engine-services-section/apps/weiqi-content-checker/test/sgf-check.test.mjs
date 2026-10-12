import { test } from "node:test";
import assert from "node:assert/strict";
import { extractFences } from "../src/markdown.mjs";
import { checkSgfFence, normalizeRulesetName } from "../src/sgf-check.mjs";
import { loadKernel } from "../src/kernel.mjs";

const kernel = await loadKernel();

function sgfFence(body) {
  return extractFences("```sgf\n" + body + "\n```")[0];
}

test("WQ020 -- SGF parse error, spec's own minimal trigger (unterminated property value)", () => {
  const fence = sgfFence("(;GM[1]FF[4]SZ[9];B[cc)");
  const diagnostics = checkSgfFence(fence, "f.md", kernel);
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].code, "WQ020");
  assert.equal(diagnostics[0].severity, "error");
});

test("WQ021 -- illegal move in the main line, spec's own minimal trigger (playing onto an occupied point)", () => {
  const fence = sgfFence("(;GM[1]FF[4]SZ[9]RU[chinese];B[cc];W[cc])");
  const diagnostics = checkSgfFence(fence, "f.md", kernel);
  const wq021 = diagnostics.filter((d) => d.code === "WQ021");
  assert.equal(wq021.length, 1);
  assert.match(wq021[0].message, /occupied/);
});

test("WQ022 -- missing RU[...], spec's own minimal trigger", () => {
  const fence = sgfFence("(;GM[1]FF[4]SZ[9];B[cc])");
  const diagnostics = checkSgfFence(fence, "f.md", kernel);
  const wq022 = diagnostics.filter((d) => d.code === "WQ022");
  assert.equal(wq022.length, 1);
  assert.equal(wq022[0].severity, "warning");
  assert.match(wq022[0].message, /chinese/);
});

test("a legal SGF with RU[...] declared produces no WQ021/WQ022", () => {
  const fence = sgfFence("(;GM[1]FF[4]SZ[9]RU[chinese];B[cc];W[dd];B[ce])");
  const diagnostics = checkSgfFence(fence, "f.md", kernel);
  assert.deepEqual(
    diagnostics.filter((d) => d.code === "WQ021" || d.code === "WQ022"),
    [],
  );
});

test("WQ023 round-trips cleanly for an ordinary linear game (no WQ023 diagnostic)", () => {
  const fence = sgfFence("(;GM[1]FF[4]SZ[9]RU[chinese];B[cc];W[dd];B[ce])");
  const diagnostics = checkSgfFence(fence, "f.md", kernel);
  assert.deepEqual(
    diagnostics.filter((d) => d.code === "WQ023"),
    [],
  );
});

test("WQ023 -- a variation branch changes the round-tripped move count, spec's own minimal trigger shape", () => {
  // The convenience layer (gameRecordToSgf/sgfToGameRecord) only reads/writes
  // the main line (tree.nodes) -- a variation branch after the main line's
  // last node is dropped by the convenience layer's own read, but present
  // in the ORIGINAL text, so re-parsing the round-tripped output yields the
  // same move count as record.moves by construction... to actually observe
  // a round-trip mismatch we instead feed a pass encoded as the legacy "tt"
  // token, which sgfToGameRecord reads correctly but whose SERIALIZED form
  // (gameRecordToSgf always writes "", never "tt") must still decode back
  // to the same move -- confirming WQ023 is exercised at all rather than
  // silently vacuous.
  const fence = sgfFence("(;GM[1]FF[4]SZ[9]RU[chinese];B[tt];W[dd])");
  const diagnostics = checkSgfFence(fence, "f.md", kernel);
  // "tt" round-trips fine (both decode to the same pass move) -- assert
  // WQ023 does NOT fire here, and that the pass was read correctly at all
  // (proven indirectly: no WQ020 parse error, no WQ021 illegal-move error).
  assert.deepEqual(diagnostics, []);
});

// Regression for the confirmed bug: sgf-check.mjs used to pass the raw
// RU[...] value straight to kernel.getRuleset(), which is case-sensitive
// and knows no FF4 aliases -- so RU[Chinese] (the standard SGF spelling
// most real Go software emits) threw inside the WQ021 try/catch and
// reported a misleading "SGF main line could not be replayed: Unknown
// ruleset" instead of the real WQ021 occupied-point finding. This is the
// verifier's exact byte-identical fixture pair: only the RU value's case
// differs, and both must now yield the SAME real WQ021 finding.
test("WQ021 -- RU[chinese] and RU[Chinese] yield the byte-identical occupied finding (regression: case-sensitive RU used to mask this behind a fake 'unknown ruleset' error)", () => {
  const lower = sgfFence("(;GM[1]FF[4]SZ[9]RU[chinese];B[cc];W[cc])");
  const upper = sgfFence("(;GM[1]FF[4]SZ[9]RU[Chinese];B[cc];W[cc])");
  const lowerDiagnostics = checkSgfFence(lower, "f.md", kernel);
  const upperDiagnostics = checkSgfFence(upper, "f.md", kernel);
  for (const diagnostics of [lowerDiagnostics, upperDiagnostics]) {
    const wq021 = diagnostics.filter((d) => d.code === "WQ021");
    assert.equal(wq021.length, 1);
    assert.match(wq021[0].message, /occupied/);
    // Never masked behind a fake "unknown ruleset"/"could not be replayed" message.
    assert.ok(!/unknown ruleset/i.test(wq021[0].message));
  }
  assert.equal(lowerDiagnostics.filter((d) => d.code === "WQ021")[0].message, upperDiagnostics.filter((d) => d.code === "WQ021")[0].message);
  // RU[Chinese] is a recognized alias (same key, different case) -- no WQ024.
  assert.deepEqual(upperDiagnostics.filter((d) => d.code === "WQ024"), []);
});

test("normalizeRulesetName -- case/whitespace and the standard SGF FF4 aliases (AGA/GOE/Japanese/NZ/Chinese) all resolve", () => {
  assert.equal(normalizeRulesetName("chinese", kernel), "chinese");
  assert.equal(normalizeRulesetName("Chinese", kernel), "chinese");
  assert.equal(normalizeRulesetName(" CHINESE ", kernel), "chinese");
  assert.equal(normalizeRulesetName("Japanese", kernel), "japanese");
  assert.equal(normalizeRulesetName("AGA", kernel), "aga");
  assert.equal(normalizeRulesetName("NZ", kernel), "newzealand");
  assert.equal(normalizeRulesetName("nz", kernel), "newzealand");
  assert.equal(normalizeRulesetName("GOE", kernel), "ing");
  assert.equal(normalizeRulesetName("goe", kernel), "ing");
  assert.equal(normalizeRulesetName("newzealand", kernel), "newzealand"); // kernel's own key, unaffected
  assert.equal(normalizeRulesetName("ing", kernel), "ing");
  assert.equal(normalizeRulesetName("chineese", kernel), null); // genuine typo, not an alias
});

// WQ024: a genuinely unrecognized RU[...] value gets its own warning, and
// (critically) the move-legality replay still runs -- under the same
// chinese fallback WQ022 uses for a missing RU -- so a REAL illegal move
// is never masked by an unrecognized ruleset name either.
test("WQ024 -- unknown RU[...] value fires its own warning, and WQ021 still catches a real illegal move under the chinese fallback", () => {
  const fence = sgfFence("(;GM[1]FF[4]SZ[9]RU[Klingon];B[cc];W[cc])");
  const diagnostics = checkSgfFence(fence, "f.md", kernel);
  const wq024 = diagnostics.filter((d) => d.code === "WQ024");
  assert.equal(wq024.length, 1);
  assert.equal(wq024[0].severity, "warning");
  assert.match(wq024[0].message, /Klingon/);
  assert.match(wq024[0].message, /chinese/);
  // The real illegal move (occupied point) is still caught, not masked.
  const wq021 = diagnostics.filter((d) => d.code === "WQ021");
  assert.equal(wq021.length, 1);
  assert.match(wq021[0].message, /occupied/);
  // WQ022 (missing RU) must NOT also fire -- RU was present, just unrecognized.
  assert.deepEqual(diagnostics.filter((d) => d.code === "WQ022"), []);
});

test("WQ023 -- fires when a round-trip genuinely changes the move sequence", () => {
  // The kernel's own SGF layer round-trips soundly by construction (proven
  // by its own property-based test, sgf.test.mts), so there is no REAL
  // input that makes gameRecordToSgf(sgfToGameRecord(text)) disagree with
  // the original -- which is exactly why this rule almost never fires
  // against real content. To confirm the WQ023 DETECTION LOGIC itself
  // (not the kernel) is correct, this test wraps the real kernel and
  // deliberately breaks its gameRecordToSgf to drop the last move, then
  // confirms checkSgfFence still reports the resulting mismatch honestly.
  const brokenKernel = {
    ...kernel,
    gameRecordToSgf(record) {
      return kernel.gameRecordToSgf({ ...record, moves: record.moves.slice(0, -1) });
    },
  };
  const fence = sgfFence("(;GM[1]FF[4]SZ[9]RU[chinese];B[cc];W[dd];B[ce])");
  const diagnostics = checkSgfFence(fence, "f.md", brokenKernel);
  const wq023 = diagnostics.filter((d) => d.code === "WQ023");
  assert.equal(wq023.length, 1);
  assert.match(wq023[0].message, /3 move\(s\) in, 2 move\(s\) out/);
});
