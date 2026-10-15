import assert from "node:assert/strict";
import test from "node:test";
import { admitStoredMatchCommand, createStoredMatch, describeStoredMatch, storedMatchResult } from "../src/match-service.mjs";

const stored = () => createStoredMatch({
  config: { size: 9, ruleset: "chinese" },
  black: { principal: "black", capability: "black-capability" },
  white: { principal: "white", capability: "white-capability" },
});

test("the effect shell stores only an engine-owned replayable match", () => {
  const accepted = admitStoredMatchCommand(stored(), { principal: "black", capability: "black-capability", idempotencyKey: "b1", expectedRevision: 0, command: { kind: "play", move: "C3" } }, 1);
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.revision, 1);
  assert.equal(accepted.stored.match.log.length, 1);
  assert.deepEqual(accepted.stored.match.session.state.moves, ["C3"]);
});

test("capabilities are required before a principal can append a match command", () => {
  const denied = admitStoredMatchCommand(stored(), { principal: "black", capability: "wrong", idempotencyKey: "b1", expectedRevision: 0, command: { kind: "play", move: "C3" } }, 1);
  assert.deepEqual(denied, { status: 401, body: { ok: false, reason: "unauthorized" } });
});

test("the shell preserves engine version conflict and idempotency semantics", () => {
  const first = admitStoredMatchCommand(stored(), { principal: "black", capability: "black-capability", idempotencyKey: "b1", expectedRevision: 0, command: { kind: "play", move: "C3" } }, 1);
  const duplicate = admitStoredMatchCommand(first.stored, { principal: "black", capability: "black-capability", idempotencyKey: "b1", expectedRevision: 0, command: { kind: "play", move: "C3" } }, 2);
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.body.duplicate, true);
  assert.equal(duplicate.stored.match.log.length, 1);
});

function play(state, principal, move, key) {
  const capability = `${principal}-capability`;
  const command = move === "pass" ? { kind: "pass" } : { kind: "play", move };
  const admitted = admitStoredMatchCommand(state, { principal, capability, idempotencyKey: key, expectedRevision: state.match.revision, command }, 1);
  assert.equal(admitted.status, 200, `${principal} ${move}: ${JSON.stringify(admitted.body)}`);
  return admitted.stored;
}

test("the state view carries no result while the main phase is open", () => {
  const open = play(stored(), "black", "C3", "b1");
  const view = describeStoredMatch(open);
  assert.equal(view.ok, true);
  assert.equal(view.revision, 1);
  assert.equal(view.result, null);
  assert.equal(storedMatchResult(open), null);
});

test("after two passes the state view reports the engine's own area count with every stone alive", () => {
  let state = stored();
  const script = [["black", "C3"], ["white", "G7"], ["black", "pass"], ["white", "pass"]];
  script.forEach(([principal, move], index) => { state = play(state, principal, move, `k${index}`); });
  assert.equal(state.match.session.state.mainPhaseEnded, true);
  const view = describeStoredMatch(state);
  assert.equal(view.result.mode, "area");
  assert.equal(view.result.komi, 7.5);
  assert.equal(view.result.deadStonesAdjudicated, false);
  assert.equal(view.result.blackScore, 1);
  assert.equal(view.result.whiteScore, 1 + 7.5);
  assert.equal(view.result.margin, "White by 7.5");
  assert.equal(view.session, state.match.session);
});

test("a territory ruleset is counted by territory", () => {
  let state = createStoredMatch({
    config: { size: 9, ruleset: "japanese" },
    black: { principal: "black", capability: "black-capability" },
    white: { principal: "white", capability: "white-capability" },
  });
  [["black", "C3"], ["white", "G7"], ["black", "pass"], ["white", "pass"]].forEach(([principal, move], index) => { state = play(state, principal, move, `j${index}`); });
  const result = storedMatchResult(state);
  assert.equal(result.mode, "territory");
  assert.equal(result.komi, 6.5);
  assert.equal(result.margin, "White by 6.5");
});

test("settlement proposal advances host CAS revision before underlying game version", () => {
  let s=stored();
  for(const [principal,move,key] of [["black","C3","a"],["white","G7","b"],
    ["black","pass","c"],["white","pass","d"]])s=play(s,principal,move,key);
  const p=admitStoredMatchCommand(s,{principal:"black",capability:"black-capability",
    idempotencyKey:"proposal",expectedRevision:4,command:{kind:"settle",dead:[]}},7);
  assert.equal(p.status,200);
  assert.equal(p.body.revision,5);
  assert.equal(p.body.sessionVersion,4);
  const view=describeStoredMatch(p.stored);
  assert.equal(view.revision,5);
  assert.equal(view.sessionVersion,4);
  const stale=admitStoredMatchCommand(p.stored,{principal:"white",capability:"white-capability",
    idempotencyKey:"stale",expectedRevision:4,command:{kind:"settle",dead:[]}},8);
  assert.equal(stale.status,409);
  assert.equal(stale.body.actualRevision,5);
  const result=admitStoredMatchCommand(p.stored,{principal:"white",capability:"white-capability",
    idempotencyKey:"agree",expectedRevision:5,command:{kind:"settle",dead:[]}},9);
  assert.equal(result.status,200);
  assert.equal(result.body.revision,6);
  assert.equal(result.body.sessionVersion,5);
});
