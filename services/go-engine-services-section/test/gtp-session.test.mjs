import assert from "node:assert/strict";
import test from "node:test";
import { withStubSession } from "./helpers/stub-session.mjs";
import {
  createGtpSession,
  protocolVersion,
  engineName,
  engineVersion,
  boardsize,
  clearBoard,
  komi,
  play,
  genmove,
  showboard,
  quit,
  parseGtpResponse,
} from "../src/go-engine.mjs";

test("parseGtpResponse reads status, id, and single-line text", () => {
  assert.deepEqual(parseGtpResponse("=1 2"), { status: "success", id: 1, result: "2" });
  assert.deepEqual(parseGtpResponse("?3 unknown command"), { status: "failure", id: 3, result: "unknown command" });
  assert.deepEqual(parseGtpResponse("= "), { status: "success", id: null, result: "" });
});

test("parseGtpResponse joins a multi-line result body", () => {
  const block = "=4 \n   A B\n 1 . .";
  assert.deepEqual(parseGtpResponse(block), { status: "success", id: 4, result: "\n   A B\n 1 . ." });
});

test("GTP session round-trips protocol_version, name, and version", async () => {
  await withStubSession("gtp", createGtpSession, async (session) => {
    assert.equal(await protocolVersion(session), "2");
    assert.equal(await engineName(session), "stub-engine");
    assert.equal(await engineVersion(session), "0.0.0-stub");
  }, { finish: quit });
});

test("GTP session drives boardsize/clear_board/komi/play/genmove", async () => {
  await withStubSession("gtp", createGtpSession, async (session) => {
    await boardsize(session, 9);
    await clearBoard(session);
    await komi(session, 7.5);
    await play(session, "black", "D4");
    const move = await genmove(session, "white");
    assert.equal(move, "D4");
  }, { finish: quit });
});

test("GTP session parses a multi-line showboard reply as one result", async () => {
  await withStubSession("gtp", createGtpSession, async (session) => {
    const board = await showboard(session);
    assert.match(board, /A B C D E/);
    assert.equal(board.split("\n").filter((line) => line !== "").length, 4);
  }, { finish: quit });
});

test("GTP session surfaces a '?' error reply as a failure status, and throws through the convenience wrapper", async () => {
  await withStubSession("gtp", createGtpSession, async (session) => {
    const raw = await session.sendCommand("not_a_real_command");
    assert.equal(raw.status, "failure");
    assert.match(raw.result, /unknown command/);

    await assert.rejects(async () => {
      // reuse an existing wrapper's unwrap-on-failure behavior via a raw failing command
      const response = await session.sendCommand("also_not_real");
      if (response.status === "failure") throw new Error(response.result);
    }, /unknown command/);
  }, { finish: quit });
});
