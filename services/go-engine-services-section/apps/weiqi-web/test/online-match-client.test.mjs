import assert from "node:assert/strict";
import test from "node:test";
import { commandRequest, describeResult, onlineMatchUrl, serverView } from "../public/js/online-match-client.mjs";

test("an invite keeps an opaque capability in the fragment, outside HTTP requests", () => {
  const url = new URL(onlineMatchUrl({ matchId: "m", principal: "p", capability: "secret", color: "white" }, "https://weiqi.561.group/online.html"));
  assert.equal(url.pathname, "/online.html");
  assert.equal(url.search, "");
  assert.match(url.hash, /capability=secret/);
});

test("the browser command envelope carries no rules result", () => {
  assert.deepEqual(commandRequest({ principal: "p", capability: "c", revision: 2, command: { kind: "pass" }, idempotencyKey: "i" }), { headers: { authorization: "Bearer c", "content-type": "application/json" }, body: { principal: "p", expectedRevision: 2, command: { kind: "pass" }, idempotencyKey: "i" } });
});

test("the board view is admitted only from a server session checkpoint", () => {
  assert.equal(serverView({ ok: true, revision: 0, session: { state: { toMove: 1 } } }, "black").yourTurn, true);
  assert.equal(serverView({ ok: false }, "black"), null);
});

test("a finished checkpoint ends both players' turns and carries the server's count", () => {
  const result = { mode: "area", komi: 7.5, margin: "White by 7.5", blackScore: 1, whiteScore: 8.5, blackPrisoners: 0, whitePrisoners: 0 };
  const view = serverView({ ok: true, result, session: { state: { toMove: 1, mainPhaseEnded: true, passStreak: 2 } } }, "black");
  assert.equal(view.finished, true);
  assert.equal(view.yourTurn, false);
  assert.equal(view.result, result);
  assert.match(describeResult(result), /Game over: White by 7\.5\. Area count/);
  assert.match(describeResult(null), /Game over/);
  const open = serverView({ ok: true, revision: 0, session: { state: { toMove: 1, mainPhaseEnded: false } } }, "black");
  assert.equal(open.finished, false);
  assert.equal(open.result, null);
});

test("browser carries server CAS revision even when unsettled Go board version is older", () => {
  const v=serverView({ok:true,revision:5,session:{version:4,
    state:{toMove:2,mainPhaseEnded:false}}},"white");
  const sent=commandRequest({principal:"white",capability:"c",revision:v.revision,
    command:{kind:"settle",dead:[]},idempotencyKey:"reply"});
  assert.equal(sent.body.expectedRevision,5);
  assert.equal(Object.hasOwn(sent.body,"expectedVersion"),false);
});
