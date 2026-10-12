// End-to-end LSP test: spawns the REAL `scripts/server.mjs` as a child
// process and speaks REAL Content-Length-framed JSON-RPC over its
// stdin/stdout -- no fake in-process harness. initialize -> capabilities
// -> didOpen -> publishDiagnostics -> hover -> didClose -> shutdown -> exit.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const BIN = resolve(HERE, "..", "scripts", "server.mjs");

/** A tiny real LSP client over a child process's stdio, real Content-Length framing both ways. */
function makeClient() {
  const child = spawn(process.execPath, [BIN], { stdio: ["pipe", "pipe", "pipe"] });
  const stderrChunks = [];
  child.stderr.on("data", (c) => stderrChunks.push(c));

  let buffer = Buffer.alloc(0);
  const pendingMessages = [];
  const waiters = [];

  child.stdout.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (true) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) return;
      const header = buffer.slice(0, headerEnd).toString("utf8");
      const m = /Content-Length:\s*(\d+)/i.exec(header);
      if (!m) return;
      const length = Number(m[1]);
      const bodyStart = headerEnd + 4;
      if (buffer.length < bodyStart + length) return;
      const body = buffer.slice(bodyStart, bodyStart + length).toString("utf8");
      buffer = buffer.slice(bodyStart + length);
      const msg = JSON.parse(body);
      if (waiters.length > 0) waiters.shift()(msg);
      else pendingMessages.push(msg);
    }
  });

  function send(message) {
    const body = Buffer.from(JSON.stringify(message), "utf8");
    child.stdin.write(`Content-Length: ${body.length}\r\n\r\n`);
    child.stdin.write(body);
  }

  function nextMessage(timeoutMs = 5000) {
    if (pendingMessages.length > 0) return Promise.resolve(pendingMessages.shift());
    return new Promise((resolve_, reject) => {
      const timer = setTimeout(() => reject(new Error(`timed out waiting for a message; stderr so far: ${Buffer.concat(stderrChunks).toString("utf8")}`)), timeoutMs);
      waiters.push((msg) => {
        clearTimeout(timer);
        resolve_(msg);
      });
    });
  }

  let nextId = 1;
  function request(method, params) {
    const id = nextId++;
    send({ jsonrpc: "2.0", id, method, params });
    return id;
  }
  function notify(method, params) {
    send({ jsonrpc: "2.0", method, params });
  }

  return { child, send, request, notify, nextMessage, stderrText: () => Buffer.concat(stderrChunks).toString("utf8") };
}

async function requestAndAwait(client, method, params) {
  const id = client.request(method, params);
  const msg = await client.nextMessage();
  assert.equal(msg.id, id, `expected a response to id ${id}, got ${JSON.stringify(msg)}`);
  return msg;
}

test("initialize -> declared capabilities match SPEC.md exactly (textDocumentSync: 1, hoverProvider: true, no completion/codeAction/formatting/rename)", async () => {
  const client = makeClient();
  try {
    const resp = await requestAndAwait(client, "initialize", { processId: null, rootUri: null, capabilities: {} });
    assert.deepEqual(resp.result, { capabilities: { textDocumentSync: 1, hoverProvider: true } });
    client.notify("initialized", {});
  } finally {
    client.child.kill();
  }
});

test("didOpen a malformed diagram document -> a real publishDiagnostics notification arrives with a WQ001 diagnostic", async () => {
  const client = makeClient();
  try {
    await requestAndAwait(client, "initialize", { processId: null, rootUri: null, capabilities: {} });
    const uri = pathToFileURL(resolve(HERE, "fixtures", "fake.md")).href;
    const text = ["```", "    A B C D E", "  1 . . . . .", "  2 . . X .", "```", ""].join("\n");
    client.notify("textDocument/didOpen", { textDocument: { uri, languageId: "markdown", version: 1, text } });
    const notif = await client.nextMessage();
    assert.equal(notif.method, "textDocument/publishDiagnostics");
    assert.equal(notif.params.uri, uri);
    assert.ok(notif.params.diagnostics.some((d) => d.code === "WQ001"), JSON.stringify(notif.params.diagnostics));
    const d = notif.params.diagnostics.find((d) => d.code === "WQ001");
    assert.equal(d.severity, 1); // LSP error
    assert.ok(d.range && typeof d.range.start.line === "number");
  } finally {
    client.child.kill();
  }
});

test("didChange re-runs the full catalog against the new full text (textDocumentSync: Full)", async () => {
  const client = makeClient();
  try {
    await requestAndAwait(client, "initialize", { processId: null, rootUri: null, capabilities: {} });
    const uri = pathToFileURL(resolve(HERE, "fixtures", "fake2.md")).href;
    client.notify("textDocument/didOpen", { textDocument: { uri, languageId: "markdown", version: 1, text: "no diagram here\n" } });
    const first = await client.nextMessage();
    // No frontmatter on this buffer means WQ044 legitimately fires (every
    // family still runs); what this test actually checks is that no
    // diagram-related code appears yet.
    assert.deepEqual(
      first.params.diagnostics.filter((d) => d.code === "WQ001" || d.code === "WQ002"),
      [],
    );

    const badText = ["```", "    A B", "  1 x ?", "```", ""].join("\n");
    client.notify("textDocument/didChange", { textDocument: { uri, version: 2 }, contentChanges: [{ text: badText }] });
    const second = await client.nextMessage();
    assert.equal(second.method, "textDocument/publishDiagnostics");
    assert.ok(second.params.diagnostics.filter((d) => d.code === "WQ002").length === 2, JSON.stringify(second.params.diagnostics));
  } finally {
    client.child.kill();
  }
});

test("didClose clears diagnostics with an empty array", async () => {
  const client = makeClient();
  try {
    await requestAndAwait(client, "initialize", { processId: null, rootUri: null, capabilities: {} });
    const uri = pathToFileURL(resolve(HERE, "fixtures", "fake3.md")).href;
    client.notify("textDocument/didOpen", { textDocument: { uri, languageId: "markdown", version: 1, text: "See [x](./nope.md).\n" } });
    const opened = await client.nextMessage();
    assert.ok(opened.params.diagnostics.length > 0);

    client.notify("textDocument/didClose", { textDocument: { uri } });
    const closed = await client.nextMessage();
    assert.equal(closed.method, "textDocument/publishDiagnostics");
    assert.equal(closed.params.uri, uri);
    assert.deepEqual(closed.params.diagnostics, []);
  } finally {
    client.child.kill();
  }
});

test("hover on an occupied diagram point reports mechanical facts only -- never a life-and-death verdict", async () => {
  const client = makeClient();
  try {
    await requestAndAwait(client, "initialize", { processId: null, rootUri: null, capabilities: {} });
    const uri = pathToFileURL(resolve(HERE, "fixtures", "fake4.md")).href;
    // R6's seki shape: fence starts at line 0 ("```"), header at line 1, row A at line 2.
    const text = ["```", "    A B C", "  1 X . O", "  2 X . O", "```", ""].join("\n");
    client.notify("textDocument/didOpen", { textDocument: { uri, languageId: "markdown", version: 1, text } });
    await client.nextMessage(); // publishDiagnostics for didOpen

    // Row "  1 X . O" is line index 2 (0-indexed); "X" (Black at A1) sits
    // right after the row-number token -- character offset 4 in that line.
    const resp = await requestAndAwait(client, "textDocument/hover", { uri, position: { line: 2, character: 4 } });
    assert.ok(resp.result, "expected a hover result over an occupied point");
    assert.match(resp.result.contents.value, /Black group/);
    assert.match(resp.result.contents.value, /2 liberty/);
    assert.doesNotMatch(resp.result.contents.value.toLowerCase(), /seki|dead|alive|life.and.death/);
  } finally {
    client.child.kill();
  }
});

// Regression for the confirmed bug: hover used to accept ONLY SPEC.md's
// flat {uri, position} shape -- but the real LSP protocol always sends
// {textDocument: {uri}, position} (the same shape didOpen/didChange/
// didClose already use), so no real editor speaking genuine LSP ever got
// a working hover from this server (real Content-Length stdio frames,
// hand-verified: standard shape -> result: null). Both shapes must now
// yield the identical mechanical-facts-only hover content.
test("hover accepts BOTH the real LSP wire shape (textDocument.uri) and SPEC.md's flat shape (uri), with identical content (regression: only the flat shape used to work)", async () => {
  const client = makeClient();
  try {
    await requestAndAwait(client, "initialize", { processId: null, rootUri: null, capabilities: {} });
    const uri = pathToFileURL(resolve(HERE, "fixtures", "fake6.md")).href;
    const text = ["```", "    A B C", "  1 X . O", "  2 X . O", "```", ""].join("\n");
    client.notify("textDocument/didOpen", { textDocument: { uri, languageId: "markdown", version: 1, text } });
    await client.nextMessage(); // publishDiagnostics for didOpen

    const flatResp = await requestAndAwait(client, "textDocument/hover", { uri, position: { line: 2, character: 4 } });
    const realResp = await requestAndAwait(client, "textDocument/hover", { textDocument: { uri }, position: { line: 2, character: 4 } });

    for (const resp of [flatResp, realResp]) {
      assert.ok(resp.result, "expected a hover result over an occupied point");
      assert.match(resp.result.contents.value, /Black group/);
      assert.match(resp.result.contents.value, /2 liberty/);
      assert.doesNotMatch(resp.result.contents.value.toLowerCase(), /seki|dead|alive|life.and.death/);
    }
    assert.deepEqual(flatResp.result, realResp.result);
  } finally {
    client.child.kill();
  }
});

test("hover on an empty diagram point (or outside any diagram) responds null, never a guess", async () => {
  const client = makeClient();
  try {
    await requestAndAwait(client, "initialize", { processId: null, rootUri: null, capabilities: {} });
    const uri = pathToFileURL(resolve(HERE, "fixtures", "fake5.md")).href;
    const text = ["```", "    A B C", "  1 X . O", "  2 X . O", "```", ""].join("\n");
    client.notify("textDocument/didOpen", { textDocument: { uri, languageId: "markdown", version: 1, text } });
    await client.nextMessage();

    const resp = await requestAndAwait(client, "textDocument/hover", { uri, position: { line: 2, character: 6 } }); // the empty "." between X and O
    assert.equal(resp.result, null);

    const outside = await requestAndAwait(client, "textDocument/hover", { uri, position: { line: 0, character: 0 } });
    assert.equal(outside.result, null);
  } finally {
    client.child.kill();
  }
});

test("shutdown then exit terminates the process cleanly with code 0", async () => {
  const client = makeClient();
  try {
    await requestAndAwait(client, "initialize", { processId: null, rootUri: null, capabilities: {} });
    const shutdownResp = await requestAndAwait(client, "shutdown", null);
    assert.equal(shutdownResp.result, null);

    const exitCode = await new Promise((resolve_) => {
      client.child.on("exit", (code) => resolve_(code));
      client.notify("exit", {});
    });
    assert.equal(exitCode, 0);
  } finally {
    if (!client.child.killed) client.child.kill();
  }
});

test("an unknown method with an id gets a real JSON-RPC method-not-found error response", async () => {
  const client = makeClient();
  try {
    await requestAndAwait(client, "initialize", { processId: null, rootUri: null, capabilities: {} });
    const resp = await requestAndAwait(client, "textDocument/definition", { uri: "file:///nope", position: { line: 0, character: 0 } });
    assert.equal(resp.error.code, -32601);
  } finally {
    client.child.kill();
  }
});
