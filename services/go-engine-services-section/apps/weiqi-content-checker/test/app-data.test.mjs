import { test } from "node:test";
import assert from "node:assert/strict";
import { checkTsumegoSchema, checkTsumegoLegality, checkLessonsSchema, checkLessonBoards } from "../src/app-data.mjs";
import { loadKernel } from "../src/kernel.mjs";

const kernel = await loadKernel();

function baseProblem(overrides = {}) {
  return {
    id: "p1",
    set: "capture",
    title: "T",
    size: 7,
    toPlay: "black",
    stones: [
      { pt: "C4", color: "black" },
      { pt: "D3", color: "black" },
      { pt: "D5", color: "black" },
      { pt: "D4", color: "white" },
    ],
    goal: "g",
    accept: ["E4"],
    lines: { E4: [] },
    ...overrides,
  };
}

test("WQ050 -- schema-invalid tsumego problem, spec's own minimal trigger (a lines key not in accept)", () => {
  const json = { problems: [baseProblem({ lines: { E4: [], F9: [] } })] };
  const diagnostics = checkTsumegoSchema(json, "tsumego.json", kernel);
  const wq050 = diagnostics.filter((d) => d.code === "WQ050");
  assert.equal(wq050.length, 1);
  assert.match(wq050[0].message, /F9/);
});

test("WQ050 -- no problems array at all", () => {
  const diagnostics = checkTsumegoSchema({}, "tsumego.json", kernel);
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].code, "WQ050");
});

test("WQ050 -- a schema-valid problem produces no diagnostics", () => {
  const json = { problems: [baseProblem()] };
  assert.deepEqual(checkTsumegoSchema(json, "tsumego.json", kernel), []);
});

test("WQ051 -- an accepted move that is no longer a capture, spec's own minimal trigger shape", () => {
  // Give White's D4 stone a second liberty (E4 left open, but ALSO add a
  // white stone elsewhere so the position is otherwise plausible) --
  // simplest concrete break: change accept to a point that captures
  // nothing and isn't otherwise legal-but-pointless; here we make accept
  // name a move that is flatly illegal (occupied).
  const json = { problems: [baseProblem({ accept: ["D4"], lines: { D4: [] } })] }; // D4 is already occupied by White
  const diagnostics = checkTsumegoLegality(json, "tsumego.json", kernel);
  const wq051 = diagnostics.filter((d) => d.code === "WQ051");
  assert.equal(wq051.length, 1);
  assert.match(wq051[0].message, /D4/);
});

test("WQ051 -- 'pass' is always legal and never flagged", () => {
  const json = { problems: [baseProblem({ toPlay: "black", stones: [{ pt: "A2", color: "black" }, { pt: "B1", color: "white" }], accept: ["pass"], lines: { pass: [] } })] };
  assert.deepEqual(checkTsumegoLegality(json, "tsumego.json", kernel), []);
});

test("WQ051 does not fire for a genuinely legal accepted move", () => {
  const json = { problems: [baseProblem()] }; // E4 legally captures White's D4 -- real capture-atari shape.
  assert.deepEqual(checkTsumegoLegality(json, "tsumego.json", kernel), []);
});

test("WQ052 -- an illegal reply in a lines[] continuation, spec's own minimal trigger shape (replying onto an occupied point)", () => {
  const json = {
    problems: [
      baseProblem({
        accept: ["E4"],
        lines: { E4: [{ move: "F1", reply: "F1" }] }, // reply re-plays the SAME point White just played: occupied.
      }),
    ],
  };
  const diagnostics = checkTsumegoLegality(json, "tsumego.json", kernel);
  const wq052 = diagnostics.filter((d) => d.code === "WQ052");
  assert.equal(wq052.length, 1);
  assert.match(wq052[0].message, /occupied/);
});

test("WQ052 does not fire for a legal continuation", () => {
  const json = { problems: [baseProblem({ accept: ["E4"], lines: { E4: [{ move: "F1", reply: "F2" }] } })] };
  assert.deepEqual(
    checkTsumegoLegality(json, "tsumego.json", kernel).filter((d) => d.code === "WQ052"),
    [],
  );
});

test("WQ053 -- a lesson's next: pointing at a nonexistent slug, spec's own minimal trigger", () => {
  const json = [{ slug: "a", title: "A", steps: [{ kind: "read", text: "x" }], next: "no-such-lesson" }];
  const diagnostics = checkLessonsSchema(json, "lessons.json", kernel);
  const wq053 = diagnostics.filter((d) => d.code === "WQ053");
  assert.equal(wq053.length, 1);
  assert.match(wq053[0].message, /no-such-lesson/);
});

test("WQ053 -- duplicate slugs across the file", () => {
  const json = [
    { slug: "a", title: "A", steps: [{ kind: "read", text: "x" }] },
    { slug: "a", title: "A2", steps: [{ kind: "read", text: "y" }] },
  ];
  const diagnostics = checkLessonsSchema(json, "lessons.json", kernel);
  assert.equal(diagnostics.filter((d) => d.code === "WQ053").length, 2);
});

test("WQ053 -- a well-formed lessons.json produces no diagnostics", () => {
  const json = [
    { slug: "a", title: "A", steps: [{ kind: "read", text: "x" }], next: "b" },
    { slug: "b", title: "B", steps: [{ kind: "exercise", text: "x", exercise: { prompt: "p", answerText: "a" } }] },
  ];
  assert.deepEqual(checkLessonsSchema(json, "lessons.json", kernel), []);
});

test("WQ054 -- an illegal sequence move in a board step", () => {
  const json = [
    {
      slug: "a",
      title: "A",
      steps: [{ kind: "board", board: { size: 9, stones: [], sequence: [{ move: "E5" }, { move: "E5" }] } }],
    },
  ];
  const diagnostics = checkLessonBoards(json, "lessons.json", kernel);
  const wq054 = diagnostics.filter((d) => d.code === "WQ054");
  assert.equal(wq054.length, 1);
  assert.match(wq054[0].message, /occupied/);
});

test("WQ054 -- replayed sequence's final position does not match declared board.stones", () => {
  const json = [
    {
      slug: "a",
      title: "A",
      steps: [{ kind: "board", board: { size: 9, stones: [{ pt: "E5", color: "white" }], sequence: [{ move: "E5" }] } }],
    },
  ];
  const diagnostics = checkLessonBoards(json, "lessons.json", kernel);
  const wq054 = diagnostics.filter((d) => d.code === "WQ054");
  assert.equal(wq054.length, 1);
  assert.match(wq054[0].message, /does not produce/);
});

test("WQ054 -- weiqi-overview's real capture sequence replays cleanly and matches its declared board.stones", () => {
  const json = [
    {
      slug: "weiqi-overview",
      title: "T",
      steps: [
        {
          kind: "board",
          board: {
            size: 9,
            stones: [
              { pt: "D5", color: "white" },
              { pt: "F5", color: "white" },
              { pt: "E4", color: "white" },
              { pt: "E6", color: "white" },
            ],
            sequence: [
              { move: "E5" },
              { move: "D5" },
              { move: "pass" },
              { move: "F5" },
              { move: "pass" },
              { move: "E4" },
              { move: "pass" },
              { move: "E6" },
            ],
          },
        },
      ],
    },
  ];
  assert.deepEqual(checkLessonBoards(json, "lessons.json", kernel), []);
});

test("WQ054 -- a static board step (no sequence) with a zero-liberty group", () => {
  // A White stone at B2 boxed in by an unconditionally-zero-liberty Black
  // ring on a literal 3x3 board: on a STATIC diagram (no captures ever
  // resolved) both groups end up with zero liberties -- see diagram.test.mjs's
  // matching WQ004 case for why this is 2 diagnostics, not 1.
  const json = [
    {
      slug: "a",
      title: "A",
      steps: [
        {
          kind: "board",
          board: {
            size: 3,
            stones: [
              { pt: "A1", color: "black" },
              { pt: "B1", color: "black" },
              { pt: "C1", color: "black" },
              { pt: "A2", color: "black" },
              { pt: "B2", color: "white" },
              { pt: "C2", color: "black" },
              { pt: "A3", color: "black" },
              { pt: "B3", color: "black" },
              { pt: "C3", color: "black" },
            ],
          },
        },
      ],
    },
  ];
  const diagnostics = checkLessonBoards(json, "lessons.json", kernel);
  assert.equal(diagnostics.filter((d) => d.code === "WQ054").length, 2);
});

test("WQ054 -- a static board step that is a legal position (living-groups-and-eyes' real shape) produces no diagnostics", () => {
  const json = [
    {
      slug: "living-groups-and-eyes",
      title: "T",
      steps: [
        {
          kind: "board",
          board: {
            size: 9,
            stones: [
              { pt: "A2", color: "black" },
              { pt: "B1", color: "black" },
              { pt: "B2", color: "black" },
              { pt: "C2", color: "black" },
              { pt: "D1", color: "black" },
              { pt: "D2", color: "black" },
              { pt: "A3", color: "white" },
              { pt: "B3", color: "white" },
              { pt: "C3", color: "white" },
              { pt: "D3", color: "white" },
              { pt: "E1", color: "white" },
              { pt: "E2", color: "white" },
              { pt: "E3", color: "white" },
            ],
          },
        },
      ],
    },
  ];
  assert.deepEqual(checkLessonBoards(json, "lessons.json", kernel), []);
});
