import { test } from "node:test";
import assert from "node:assert/strict";
import { createTell, isTell, isCrossGame } from "../src/tell.mjs";

test("createTell shapes a cross-game tell and truncates an oversized body", () => {
  const t = createTell({
    fromGameId: "qwzspace-demo",
    fromPlayerId: "a",
    toGameId: "casino",
    toPlayerId: "b",
    body: "x".repeat(5000),
  });
  assert.equal(t.body.length, 4000);
  assert(isTell(t));
  assert.equal(isCrossGame(t), true);
});

test("createTell rejects missing identity fields", () => {
  assert.throws(() => createTell({ fromGameId: "g", fromPlayerId: "a", toGameId: "g", toPlayerId: "", body: "hi" }), TypeError);
  assert.throws(() => createTell({ fromGameId: "g", fromPlayerId: "a", toGameId: "g", toPlayerId: "b", body: "" }), TypeError);
});

test("isCrossGame is false for a same-game tell", () => {
  const t = createTell({ fromGameId: "g", fromPlayerId: "a", toGameId: "g", toPlayerId: "b", body: "hi" });
  assert.equal(isCrossGame(t), false);
});

test("isTell rejects non-tell values", () => {
  assert.equal(isTell(null), false);
  assert.equal(isTell({}), false);
});
