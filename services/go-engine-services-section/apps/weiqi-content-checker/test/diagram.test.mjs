import { test } from "node:test";
import assert from "node:assert/strict";
import { extractFences } from "../src/markdown.mjs";
import { isDiagramFence, checkDiagramFence, checkZeroLibertyGroups, coordInRange } from "../src/diagram.mjs";
import { loadKernel } from "../src/kernel.mjs";

const kernel = await loadKernel();

function fenceFrom(body) {
  return extractFences("```\n" + body + "\n```")[0];
}

test("isDiagramFence recognizes a real diagram and rejects an expected: block or a code fence", () => {
  assert.equal(isDiagramFence(fenceFrom("    A B C D E\n  1 . . . . .")), true);
  assert.equal(isDiagramFence(fenceFrom("expected:\n  id: R1")), false);
  assert.equal(isDiagramFence(extractFences("```js\nconst x = 1;\n```")[0]), false);
});

test("WQ001 -- a row with fewer symbols than the header declares columns", () => {
  const fence = fenceFrom("    A B C D E\n  1 . . . . .\n  2 . . X .");
  const { diagnostics, diagram } = checkDiagramFence(fence, "f.md", kernel);
  const wq001 = diagnostics.filter((d) => d.code === "WQ001");
  assert.equal(wq001.length, 1);
  assert.equal(wq001[0].severity, "error");
  assert.equal(diagram.shapeOk, false);
});

test("WQ002 -- an unrecognized diagram symbol", () => {
  const fence = fenceFrom("    A B C\n  1 . . .\n  2 . x .");
  const { diagnostics } = checkDiagramFence(fence, "f.md", kernel);
  const wq002 = diagnostics.filter((d) => d.code === "WQ002");
  assert.equal(wq002.length, 1);
  assert.match(wq002[0].message, /"x"/);
});

test("WQ002 -- a '?' symbol is also unrecognized", () => {
  const fence = fenceFrom("    A B\n  1 . ?");
  const { diagnostics } = checkDiagramFence(fence, "f.md", kernel);
  assert.equal(diagnostics.filter((d) => d.code === "WQ002").length, 1);
});

test("WQ004 -- a Black or White group with zero liberties in a settled diagram", () => {
  // R4's ring, but B2 (the ring's only liberty) is filled by White: on
  // this STATIC diagram (no move applied, no captures resolved) both the
  // Black ring (its only interior neighbor is now occupied, not empty)
  // and the lone White stone (surrounded on all four sides) end up with
  // zero liberties -- an unreachable, mutually-impossible position, and
  // WQ004 must flag BOTH groups, not silently pick one.
  const fence = fenceFrom("    A B C\n  1 X X X\n  2 X O X\n  3 X X X");
  const { diagram } = checkDiagramFence(fence, "f.md", kernel);
  const diagnostics = checkZeroLibertyGroups(diagram, "f.md", kernel);
  assert.equal(diagnostics.length, 2);
  assert.ok(diagnostics.every((d) => d.code === "WQ004"));
  assert.ok(diagnostics.some((d) => /Black group/.test(d.message)));
  assert.ok(diagnostics.some((d) => /White group/.test(d.message)));
});

test("WQ004 does not fire on a legitimate liberty>0 position", () => {
  const fence = fenceFrom("    A B C\n  1 X X X\n  2 X * X\n  3 X X X"); // R4 as-drawn, B2 still empty
  const { diagram } = checkDiagramFence(fence, "f.md", kernel);
  assert.deepEqual(checkZeroLibertyGroups(diagram, "f.md", kernel), []);
});

test("WQ005 -- a 9-column header that fails to skip I", () => {
  const fence = fenceFrom("       A B C D E F G H I\n    1  . . . . . . . . .");
  const { diagnostics } = checkDiagramFence(fence, "f.md", kernel);
  const wq005 = diagnostics.filter((d) => d.code === "WQ005");
  assert.equal(wq005.length, 1);
  assert.match(wq005[0].message, /J/); // expected header names J, not I, as the 9th letter
});

test("WQ005 does not fire on a correctly skip-I 9-column header (R13's real header)", () => {
  const fence = fenceFrom("       A B C D E F G H J\n    1  . . . . . . . . .");
  const { diagnostics } = checkDiagramFence(fence, "f.md", kernel);
  assert.deepEqual(
    diagnostics.filter((d) => d.code === "WQ005"),
    [],
  );
});

test("non-square diagrams (width != height) are not themselves an error (R9's 7x5 shape)", () => {
  const fence = fenceFrom(
    "       A B C D E F G\n    1  . . X . O . .\n    2  . . X O O . .\n    3  . . X . O . .\n    4  . . X X O . .\n    5  . . X . O . .",
  );
  const { diagnostics, diagram } = checkDiagramFence(fence, "f.md", kernel);
  assert.deepEqual(diagnostics, []);
  assert.equal(diagram.width, 7);
  assert.equal(diagram.height, 5);
});

test("coordInRange: WQ003's own minimal trigger (D2 on a 3-wide diagram)", () => {
  const fence = fenceFrom("    A B C\n  1 . . .\n  2 . . .\n  3 . . .");
  const { diagram } = checkDiagramFence(fence, "f.md", kernel);
  assert.equal(coordInRange("B2", diagram, kernel), true);
  assert.equal(coordInRange("D2", diagram, kernel), false);
});
