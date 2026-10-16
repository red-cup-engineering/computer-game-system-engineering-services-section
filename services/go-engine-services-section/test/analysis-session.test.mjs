import assert from "node:assert/strict";
import test from "node:test";
import { withStubSession } from "./helpers/stub-session.mjs";
import { createAnalysisSession } from "../src/go-engine.mjs";

test("analysis session round-trips one query, matched by id", async () => {
  await withStubSession("analysis", createAnalysisSession, async (session) => {
    const response = await session.query({
      id: "q1",
      moves: [["B", "D4"]],
      rules: "chinese",
      komi: 7.5,
      boardXSize: 5,
      boardYSize: 5,
      analyzeTurns: [1],
      includeOwnership: true,
    });
    assert.equal(response.id, "q1");
    assert.equal(response.rootInfo.boardXSize, 5);
    assert.equal(response.rootInfo.boardYSize, 5);
    assert.deepEqual(response.ownership, [0.9, -0.9, 0.05, 0.05]);
    assert.deepEqual(response.ownershipStdev, [0.01, 0.01, 0.01, 0.5]);
    assert.equal(response.moveInfos[0].move, "D4");
  });
});

test("analysis session assigns an id when the caller omits one", async () => {
  await withStubSession("analysis", createAnalysisSession, async (session) => {
    const response = await session.query({ moves: [], rules: "chinese", komi: 6.5 });
    assert.equal(typeof response.id, "string");
    assert.match(response.id, /^go-engine-\d+$/);
  });
});

test("analysis session runs two concurrent queries and resolves each to its own id", async () => {
  await withStubSession("analysis", createAnalysisSession, async (session) => {
    const [a, b] = await Promise.all([session.query({ id: "a" }), session.query({ id: "b" })]);
    assert.equal(a.id, "a");
    assert.equal(b.id, "b");
  });
});
