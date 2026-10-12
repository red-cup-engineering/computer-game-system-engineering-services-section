import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createAnalysisSession } from "../src/go-engine.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const STUB = join(HERE, "stub-engine.mjs");

function spawnStub() {
  return spawn(process.execPath, [STUB, "analysis"], { stdio: ["pipe", "pipe", "inherit"] });
}

test("analysis session round-trips one query, matched by id", async () => {
  const child = spawnStub();
  const session = createAnalysisSession(child);
  try {
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
  } finally {
    session.close();
    child.kill();
  }
});

test("analysis session assigns an id when the caller omits one", async () => {
  const child = spawnStub();
  const session = createAnalysisSession(child);
  try {
    const response = await session.query({ moves: [], rules: "chinese", komi: 6.5 });
    assert.equal(typeof response.id, "string");
    assert.match(response.id, /^go-engine-\d+$/);
  } finally {
    session.close();
    child.kill();
  }
});

test("analysis session runs two concurrent queries and resolves each to its own id", async () => {
  const child = spawnStub();
  const session = createAnalysisSession(child);
  try {
    const [a, b] = await Promise.all([session.query({ id: "a" }), session.query({ id: "b" })]);
    assert.equal(a.id, "a");
    assert.equal(b.id, "b");
  } finally {
    session.close();
    child.kill();
  }
});
