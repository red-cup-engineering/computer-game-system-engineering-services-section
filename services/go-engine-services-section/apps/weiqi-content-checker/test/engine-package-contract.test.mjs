import assert from "node:assert/strict";
import test from "node:test";

import * as engine from "@red-cup-engineering/weiqi-engine";
import * as match from "@red-cup-engineering/weiqi-engine/match";

test("the installed public engine exposes the shared versioned replay and match contract", () => {
  assert.equal(typeof engine.createWeiqiGameSession, "function");
  assert.equal(typeof engine.materializeWeiqiGame, "function");
  assert.equal(typeof match.createWeiqiMatch, "function");
  assert.equal(typeof match.verifyWeiqiMatch, "function");
  assert.equal(typeof match.admitWeiqiMatchCommand, "function");
});
