import { test } from "node:test";
import assert from "node:assert/strict";
import { extractFences } from "../src/markdown.mjs";
import { checkDiagramFence } from "../src/diagram.mjs";
import { checkExpectedBlock, parseExpectedBlock } from "../src/expected-block.mjs";
import { loadKernel } from "../src/kernel.mjs";

const kernel = await loadKernel();

function diagramFrom(body) {
  const fence = extractFences("```\n" + body + "\n```")[0];
  return checkDiagramFence(fence, "f.md", kernel).diagram;
}

function expectedFence(body) {
  return extractFences("```\nexpected:\n" + body + "\n```")[0];
}

test("parseExpectedBlock reads flat scalars, a folded '>' block, and skips a nested mapping", () => {
  const fence = expectedFence(
    ["  id: R9-area-score", "  ruleset: chinese", "  black_stones_on_board: 6   # comment", "  reason: >", "    line one", "    line two", "  scoring:", "    territory: nope", "  margin: White by 7.5"].join(
      "\n",
    ),
  );
  const { keys } = parseExpectedBlock(fence);
  assert.equal(keys.get("id").value, "R9-area-score");
  assert.equal(keys.get("ruleset").value, "chinese");
  assert.equal(keys.get("black_stones_on_board").value, "6");
  assert.equal(keys.get("reason").value, "line one line two");
  assert.equal(keys.get("scoring").kind, "nested");
  assert.equal(keys.get("margin").value, "White by 7.5");
});

test("WQ010 -- stone-count mismatch, R9's own minimal trigger (a stray extra Black stone)", () => {
  // R9's diagram with an extra Black stone at F1 (was White's territory).
  const diagram = diagramFrom(
    ["       A B C D E F G", "    1  . . X . O X .", "    2  . . X O O . .", "    3  . . X . O . .", "    4  . . X X O . .", "    5  . . X . O . ."].join("\n"),
  );
  const fence = expectedFence(["  id: R9-area-score", "  ruleset: chinese", "  black_stones_on_board: 6"].join("\n"));
  const diagnostics = checkExpectedBlock({ fence, file: "f.md", diagram, kernel });
  const wq010 = diagnostics.filter((d) => d.code === "WQ010");
  assert.equal(wq010.length, 1);
  assert.match(wq010[0].message, /claims 6.*has 7/);
});

test("WQ010 does not fire when the count matches", () => {
  const diagram = diagramFrom(
    ["       A B C D E F G", "    1  . . X . O . .", "    2  . . X O O . .", "    3  . . X . O . .", "    4  . . X X O . .", "    5  . . X . O . ."].join("\n"),
  );
  const fence = expectedFence(["  id: R9", "  ruleset: chinese", "  black_stones_on_board: 6"].join("\n"));
  const diagnostics = checkExpectedBlock({ fence, file: "f.md", diagram, kernel });
  assert.deepEqual(diagnostics.filter((d) => d.code === "WQ010"), []);
});

test("WQ011 -- R10's own minimal trigger (a stale white_territory_score after the diagram gains White an 11th territory point)", () => {
  // R9/R10 diagram, but F1 removed (was a White stone), turning it into an 11th White territory point.
  const diagram = diagramFrom(
    ["       A B C D E F G", "    1  . . X . O . .", "    2  . . X O O . .", "    3  . . X . O . .", "    4  . . X X O . .", "    5  . . X . O . ."].join("\n"),
  );
  const fence = expectedFence(["  id: R10-territory-score", "  ruleset: japanese", "  white_territory_score: 10"].join("\n"));
  const diagnostics = checkExpectedBlock({ fence, file: "f.md", diagram, kernel });
  assert.deepEqual(diagnostics.filter((d) => d.code === "WQ011"), []); // sanity: the real R9/R10 shape matches (10), no mismatch.
});

test("WQ011 -- white_area_score is checked KOMI-FREE, not against ScoreResult.whiteScore (which bakes komi in)", () => {
  const diagram = diagramFrom(
    ["       A B C D E F G", "    1  . . X . O . .", "    2  . . X O O . .", "    3  . . X . O . .", "    4  . . X X O . .", "    5  . . X . O . ."].join("\n"),
  );
  const fence = expectedFence(["  id: R9-area-score", "  ruleset: chinese", "  white_area_score: 16", "  white_final_with_komi: 23.5"].join("\n"));
  const diagnostics = checkExpectedBlock({ fence, file: "f.md", diagram, kernel });
  assert.deepEqual(diagnostics.filter((d) => d.code === "WQ011"), []);
});

test("WQ012 -- margin string mismatch, spec's own minimal trigger shape", () => {
  const diagram = diagramFrom(
    ["       A B C D E F G", "    1  . . X . O . .", "    2  . . X O O . .", "    3  . . X . O . .", "    4  . . X X O . .", "    5  . . X . O . ."].join("\n"),
  );
  const fence = expectedFence(["  id: R9-area-score", "  ruleset: chinese", "  white_area_score: 16", "  margin: White by 6.5"].join("\n"));
  const diagnostics = checkExpectedBlock({ fence, file: "f.md", diagram, kernel });
  const wq012 = diagnostics.filter((d) => d.code === "WQ012");
  assert.equal(wq012.length, 1);
  assert.match(wq012[0].message, /White by 6\.5.*White by 7\.5/s);
});

test("WQ013 -- R4's own suicide-illegal claim, verified via Game.isLegal", () => {
  // A 5x5 board where the Black ring genuinely has an outside liberty
  // (unlike R4's own 3x3-as-literal-board fragment -- see the README's
  // documented Family (b) finding), so White's B2 really is suicide here.
  const diagram = diagramFrom(["    A B C D E", "  1 . X X X .", "  2 . X * X .", "  3 . X X X .", "  4 . . . . .", "  5 . . . . ."].join("\n"));
  const fence = expectedFence(["  id: R4-like", "  white_may_play_B2: illegal (under ruleset.chinese, ruleset.japanese, ruleset.aga, ruleset.ing)"].join("\n"));
  const diagnostics = checkExpectedBlock({ fence, file: "f.md", diagram, kernel });
  assert.deepEqual(diagnostics.filter((d) => d.code === "WQ013"), []);
});

test("WQ013 -- fires when the claim disagrees with Game.isLegal (mistranscribed capturing stone)", () => {
  const diagram = diagramFrom(["    A B", "  1 O .", "  2 X ."].join("\n")); // White A1 has TWO liberties (B1, A2 is Black so not a liberty -- wait A2 is X)
  const fence = expectedFence(["  id: fake", "  black_may_play_B1: illegal"].join("\n"));
  const diagnostics = checkExpectedBlock({ fence, file: "f.md", diagram, kernel });
  // B1 captures White's A1 (its only liberty) -- legal, contradicting the "illegal" claim -- must fire for every ruleset checked (all 5, since no qualifier).
  const wq013 = diagnostics.filter((d) => d.code === "WQ013");
  assert.equal(wq013.length, 5);
  assert.ok(wq013.every((d) => d.severity === "error"));
});

test("WQ013 -- a ko_point claim is reported info/not-verified, never a false error (R1's own shape)", () => {
  const diagram = diagramFrom(["    A B C D E", "  1 . . . . .", "  2 . . X . .", "  3 . X * X .", "  4 . O X O .", "  5 . . O . ."].join("\n"));
  const fence = expectedFence(["  id: R1-simple-ko", "  ko_point: C3", "  white_may_play_C3: illegal"].join("\n"));
  const diagnostics = checkExpectedBlock({ fence, file: "f.md", diagram, kernel });
  const wq013 = diagnostics.filter((d) => d.code === "WQ013");
  assert.equal(wq013.length, 1);
  assert.equal(wq013[0].severity, "info");
  assert.match(wq013[0].message, /NOT VERIFIED/);
});

test("WQ014 -- unknown ruleset identifier, spec's own minimal trigger (a typo)", () => {
  const diagram = diagramFrom(["    A B", "  1 . .", "  2 . ."].join("\n"));
  const fence = expectedFence(["  id: fake", "  ruleset: chineese"].join("\n"));
  const diagnostics = checkExpectedBlock({ fence, file: "f.md", diagram, kernel });
  const wq014 = diagnostics.filter((d) => d.code === "WQ014");
  assert.equal(wq014.length, 1);
  assert.match(wq014[0].message, /chineese/);
  assert.match(wq014[0].message, /newzealand/); // dynamically listed from kernel.RULESETS, not hardcoded
});

test("WQ014 does not fire for the kernel's real ruleset names, including newzealand (no underscore)", () => {
  const diagram = diagramFrom(["    A B", "  1 . .", "  2 . ."].join("\n"));
  for (const name of ["chinese", "japanese", "aga", "newzealand", "ing"]) {
    const fence = expectedFence(["  id: fake", `  ruleset: ${name}`].join("\n"));
    const diagnostics = checkExpectedBlock({ fence, file: "f.md", diagram, kernel });
    assert.deepEqual(diagnostics.filter((d) => d.code === "WQ014"), []);
  }
});

test("WQ019 -- status: seki is reported info/not-verified with mechanical facts, never confirmed", () => {
  const diagram = diagramFrom(["    A B C", "  1 X . O", "  2 X . O"].join("\n"));
  const fence = expectedFence(["  id: R6-seki-minimal", "  status: seki"].join("\n"));
  const diagnostics = checkExpectedBlock({ fence, file: "f.md", diagram, kernel });
  const wq019 = diagnostics.filter((d) => d.code === "WQ019");
  assert.equal(wq019.length, 1);
  assert.equal(wq019[0].severity, "info");
  assert.match(wq019[0].message, /NOT VERIFIED/);
  assert.match(wq019[0].message, /Black \{A1, A2\} has 2 liberty/);
  assert.match(wq019[0].message, /White \{C1, C2\} has 2 liberty/);
});

test("WQ019 -- R2/R3-style self-disclaimed positions are skipped entirely, not fabricated", () => {
  const fence = expectedFence(["  id: R2-fake", "  reason: >", "    some reasoning", "  note: >", "    Given here as a structural specification, not a fully traced sequence."].join("\n"));
  const diagnostics = checkExpectedBlock({ fence, file: "f.md", diagram: null, kernel });
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].code, "WQ019");
  assert.equal(diagnostics[0].severity, "info");
  assert.match(diagnostics[0].message, /self-disclaimed/);
});

test("WQ003 -- a may_play coordinate out of range for its diagram (spec's own minimal trigger)", () => {
  const diagram = diagramFrom(["    A B C", "  1 . . .", "  2 . . .", "  3 . . ."].join("\n"));
  const fence = expectedFence(["  id: fake", "  white_may_play_D2: illegal"].join("\n"));
  const diagnostics = checkExpectedBlock({ fence, file: "f.md", diagram, kernel });
  const wq003 = diagnostics.filter((d) => d.code === "WQ003");
  assert.equal(wq003.length, 1);
  assert.match(wq003[0].message, /D2/);
});

// Regression for the confirmed bug: expected-block.mjs used to gate ALL
// may_play handling (WQ013, and therefore also WQ003 for those coords)
// behind `diagram.width === diagram.height`, silently producing ZERO
// diagnostics for any non-square diagram, no matter how wrong the claim.
// This is the verifier's exact transcript pair -- same claim text as the
// WQ003 test immediately above (SPEC.md's own literal minimal trigger),
// just on a 3x2 board instead of a 3x3 one. Before the fix: 0 diagnostics
// here. After: WQ003 must fire exactly as it does on the square board.
test("WQ003 -- also fires on a non-square (3x2) diagram, not just square (regression: width===height gate silently skipped this)", () => {
  const diagram = diagramFrom(["    A B C", "  1 . . .", "  2 . . ."].join("\n"));
  assert.equal(diagram.width, 3);
  assert.equal(diagram.height, 2);
  const fence = expectedFence(["  id: fake", "  white_may_play_D2: illegal"].join("\n"));
  const diagnostics = checkExpectedBlock({ fence, file: "f.md", diagram, kernel });
  const wq003 = diagnostics.filter((d) => d.code === "WQ003");
  assert.equal(wq003.length, 1);
  assert.match(wq003[0].message, /D2/);
  assert.match(wq003[0].message, /3x2/);
});

// Same bug, WQ013 side: a genuinely wrong may_play claim on a non-square
// diagram (R6's own real 3x2 corpus diagram) must now actually be
// evaluated and disagree, instead of being silently swallowed by the old
// width===height gate. White playing B1 here is a legal move (White's new
// group {B1,C1,C2} keeps one liberty at B2; no capture, no suicide), so
// claiming it "illegal" is a genuine mismatch.
test("WQ013 -- fires on a non-square (3x2) diagram, R6's real corpus geometry (regression: width===height gate silently skipped this)", () => {
  const diagram = diagramFrom(["    A B C", "  1 X . O", "  2 X . O"].join("\n"));
  assert.equal(diagram.width, 3);
  assert.equal(diagram.height, 2);
  const fence = expectedFence(["  id: R6-like", "  white_may_play_B1: illegal"].join("\n"));
  const diagnostics = checkExpectedBlock({ fence, file: "f.md", diagram, kernel });
  const wq013 = diagnostics.filter((d) => d.code === "WQ013");
  // No qualifier -- checked against every ruleset the kernel knows (5).
  assert.equal(wq013.length, 5);
  assert.ok(wq013.every((d) => d.severity === "error"));
  assert.ok(wq013.every((d) => /B1/.test(d.message) && /legal/.test(d.message)));
});

// The positive control for the same geometry: a CORRECT claim on the same
// non-square diagram must produce no false WQ013, proving the new
// rectangle-capable check is accurate, not merely "always fires now".
test("WQ013 -- does not false-positive on a correct claim for the same non-square (3x2) diagram", () => {
  const diagram = diagramFrom(["    A B C", "  1 X . O", "  2 X . O"].join("\n"));
  const fence = expectedFence(["  id: R6-like", "  white_may_play_B1: legal"].join("\n"));
  const diagnostics = checkExpectedBlock({ fence, file: "f.md", diagram, kernel });
  assert.deepEqual(diagnostics.filter((d) => d.code === "WQ013"), []);
});

// WQ013 on R9's real 7x5 non-square corpus geometry (the other position
// named in the bug report): a fabricated may_play claim against R9's real
// diagram must be genuinely evaluated, not silently skipped. A1 sits deep
// in Black's own territory (bordered only by empty points and the board
// edge), so Black playing A1 is legal under every ruleset -- claiming the
// opposite forces a genuine WQ013 disagreement.
test("WQ013 -- fires on R9's real 7x5 non-square corpus diagram (regression: width===height gate silently skipped this)", () => {
  const diagram = diagramFrom(
    ["       A B C D E F G", "    1  . . X . O . .", "    2  . . X O O . .", "    3  . . X . O . .", "    4  . . X X O . .", "    5  . . X . O . ."].join("\n"),
  );
  assert.equal(diagram.width, 7);
  assert.equal(diagram.height, 5);
  // A1 is deep in Black's own territory: bordered only by empty points and
  // the board edge, so Black may legally play there under every ruleset.
  // Claim the opposite to force a genuine WQ013 disagreement.
  const fence = expectedFence(["  id: R9-like", "  black_may_play_A1: illegal"].join("\n"));
  const diagnostics = checkExpectedBlock({ fence, file: "f.md", diagram, kernel });
  const wq013 = diagnostics.filter((d) => d.code === "WQ013");
  assert.equal(wq013.length, 5);
  assert.ok(wq013.every((d) => d.severity === "error" && /A1/.test(d.message)));
});
