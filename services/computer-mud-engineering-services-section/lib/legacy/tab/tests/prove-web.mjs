// prove-web — TAB's INTERNAL WEB SERVER end-to-end, over real HTTP (a node:http client) on an
// ephemeral port, with the daemon's tick driven BY HAND (autostart:false) for determinism. Proves
// the web is just a third transport on the single-writer daemon: a browser logs in, enqueues a
// command, and receives its output + structured state over SSE — and the world-event firehose
// streams structured JSON a bot could trade on. (Polls for SSE frames rather than sleeping a fixed
// time, since the first HTTP frame can lag a few hundred ms; exits explicitly because it holds open
// HTTP sockets the other suites never do.)

import assert from "node:assert/strict";
import http from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import doing from "#doing";
import { webServe } from "#web";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
// waitFor — poll a predicate up to ~1.5s (no Date; a bounded loop), so SSE-timing never flakes.
async function waitFor(pred, tries = 60, gap = 25) {
  for (let i = 0; i < tries; i += 1) { if (pred()) return true; await delay(gap); }
  return pred();
}

function post(base, path, body) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(body ?? {}));
    const req = http.request(base + path, { method: "POST", headers: { "content-type": "application/json", "content-length": data.length } }, (res) => {
      let b = ""; res.on("data", (c) => (b += c)); res.on("end", () => resolve({ status: res.statusCode, json: (() => { try { return JSON.parse(b); } catch { return null; } })() }));
    });
    req.on("error", reject); req.end(data);
  });
}
// sse — open an SSE GET and collect parsed events into a live array (returns { events, close }).
function sse(base, path) {
  const events = [];
  const req = http.get(base + path, (res) => {
    let buf = "";
    res.on("data", (c) => {
      buf += c;
      let i;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
        const ev = { event: "message", data: "" };
        for (const line of chunk.split("\n")) {
          if (line.startsWith("event:")) ev.event = line.slice(6).trim();
          else if (line.startsWith("data:")) ev.data += line.slice(5).trim();
        }
        if (ev.data) events.push(ev);
      }
    });
  });
  req.on("error", () => {});
  return { events, close: () => req.destroy() };
}
const outs = (stream) => stream.events.filter((e) => e.event === "out").map((e) => { try { return JSON.parse(e.data); } catch { return e.data; } });

const tmp = mkdtempSync(join(tmpdir(), "tab-web-"));
const world = join(tmp, "w");
let s = 0;
const set = (e, a, v) => doing({ root: world, subject: e, predicate: a, object: v, t: `seed:${String(++s).padStart(6, "0")}` });

let server;
const open = [];
try {
  await set("hall", "naming", "The Custom House");
  await set("hall", "describing", "a draughty hall of ledgers and tide-tables");
  await set("bo", "kind", "npc"); await set("bo", "naming", "Bo"); await set("bo", "mover", "tick"); await set("bo", "located-in", "hall");

  server = webServe({ root: world, dimension: "harbor", startRoom: "hall", httpPort: 0, autostart: false });
  await new Promise((r) => { if (server.http.listening) r(); else server.http.once("listening", r); });
  const base = `http://localhost:${server.httpAddress().port}`;

  await ok("POST /session resumes-or-creates a player and returns a token", async () => {
    const r = await post(base, "/session", { name: "Ada" });
    assert.equal(r.status, 200);
    assert.equal(r.json.session, "ada");
    assert.ok(typeof r.json.token === "string" && r.json.token.length >= 16);
  });

  await ok("GET /stream delivers the room render + structured state on connect", async () => {
    const { json } = await post(base, "/session", { name: "Ada" });
    const stream = sse(base, `/stream?token=${json.token}`); open.push(stream);
    await waitFor(() => stream.events.some((e) => e.event === "state") && outs(stream).some((l) => /Custom House/.test(l)));
    assert.ok(outs(stream).some((l) => /Custom House/.test(l)), "an out event renders the room");
    const state = stream.events.find((e) => e.event === "state");
    assert.ok(state, "a state event arrives");
    const snap = JSON.parse(state.data);
    assert.equal(snap.room.name, "The Custom House");
    assert.ok(snap.people.some((p) => p.name === "Bo"), "state lists Bo present");
  });

  await ok("POST /input enqueues a command; its output streams back over SSE", async () => {
    const { json } = await post(base, "/session", { name: "Ada" });
    const stream = sse(base, `/stream?token=${json.token}`); open.push(stream);
    await waitFor(() => stream.events.length > 0);
    const r = await post(base, "/input", { token: json.token, line: "say ahoy there" });
    assert.equal(r.status, 202);
    await server.drainOnce();
    await waitFor(() => outs(stream).some((l) => /ahoy there/.test(l)));
    assert.ok(outs(stream).some((l) => /ahoy there/.test(l)), `expected the say echo, got ${JSON.stringify(outs(stream))}`);
  });

  await ok("a bad token is rejected", async () => {
    const r = await post(base, "/input", { token: "nope", line: "look" });
    assert.equal(r.status, 401);
  });

  await ok("GET /events streams a structured world-event for a player's speech (the firehose)", async () => {
    const { json } = await post(base, "/session", { name: "Cole" });
    const wire = sse(base, "/events?topics=chat"); open.push(wire);
    await delay(60);
    await post(base, "/input", { token: json.token, line: "say to the firehose" });
    await server.drainOnce();
    await waitFor(() => wire.events.some((e) => { try { return JSON.parse(e.data).type === "say"; } catch { return false; } }));
    const say = wire.events.map((e) => { try { return JSON.parse(e.data); } catch { return {}; } }).find((ev) => ev.type === "say");
    assert.ok(say, "expected a structured say event on /events");
    assert.ok(/firehose/.test(say.text), "the structured event carries the spoken text");
  });

  console.log(`\n${pass} web checks passed.`);
} finally {
  for (const stream of open) { try { stream.close(); } catch { /* ignore */ } }
  try { server?.stopWeb?.(); } catch { /* ignore */ }
  rmSync(tmp, { recursive: true, force: true });
}
// Exit explicitly: this suite holds open HTTP client sockets, unlike the others.
process.exit(process.exitCode ?? 0);
