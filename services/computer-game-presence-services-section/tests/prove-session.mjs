import { test } from "node:test";
import assert from "node:assert/strict";
import { createSession, isSession, sessionKey, listPresent, SESSION_KINDS } from "../src/session.mjs";

test("sessionKey composes gameId:playerId and rejects empty parts", () => {
  assert.equal(sessionKey("qwzspace-demo", "p1"), "qwzspace-demo:p1");
  assert.throws(() => sessionKey("", "p1"), TypeError);
  assert.throws(() => sessionKey("g", ""), TypeError);
});

test("createSession defaults kind to human and displayName to playerId", () => {
  const s = createSession({ gameId: "g1", playerId: "p1" });
  assert.equal(s.kind, SESSION_KINDS.HUMAN);
  assert.equal(s.displayName, "p1");
  assert.equal(s.key, "g1:p1");
  assert(isSession(s));
});

test("createSession accepts agent kind as first-class, not a special case", () => {
  const s = createSession({ gameId: "g1", playerId: "npc-1", kind: "agent", displayName: "Cast NPC" });
  assert.equal(s.kind, "agent");
  assert.equal(s.displayName, "Cast NPC");
});

test("createSession rejects unrecognized kind", () => {
  assert.throws(() => createSession({ gameId: "g1", playerId: "p1", kind: "robot" }), TypeError);
});

test("isSession rejects non-session values", () => {
  assert.equal(isSession(null), false);
  assert.equal(isSession({}), false);
  assert.equal(isSession({ key: "g:p", gameId: "g", playerId: "p", kind: "human" }), true);
});

test("listPresent filters by gameId, preserving order", () => {
  const a = createSession({ gameId: "g1", playerId: "a" });
  const b = createSession({ gameId: "g2", playerId: "b" });
  const c = createSession({ gameId: "g1", playerId: "c" });
  assert.deepEqual(listPresent([a, b, c]), [a, b, c]);
  assert.deepEqual(listPresent([a, b, c], "g1"), [a, c]);
  assert.deepEqual(listPresent([a, b, c], "g3"), []);
});
