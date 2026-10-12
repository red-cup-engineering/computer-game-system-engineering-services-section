// web — TAB's INTERNAL WEB SERVER (a subsystem, not a separate package). A MUD is an app, not a
// website, so TAB ships its own zero-dependency HTTP layer: it serves a browser client, takes
// commands over POST, and streams the world back over Server-Sent Events. It is simply a THIRD
// transport on the existing single-writer daemon (`serve.mjs`), alongside disk and TCP:
//
//   browser  --POST /input-->  the same disk inbox the daemon drains  --tick/drain-->  world
//   browser  <--SSE /stream--  the session's output + perception (an attached output SINK)
//   anyone   <--SSE /events--  a structured world-event FIREHOSE (the daemon's onEvent rows,
//                              projected by #events) — the door to trading bots, dashboards, MCP.
//
// Because the browser only ENQUEUES to the same queue the daemon drains, the single-writer invariant
// holds and packet arrival is frozen into drain order exactly like TCP — replay stays byte-for-byte.
// SSE is a read-only mirror; it cannot perturb the world. Zero deps: node:http / fs / crypto only.
//
//   node scripts/web.mjs <world> [--http 8080] [--port 4000] [--start <room>] [--interval MS]
//
// Programmatic (for tests): const server = webServe({ root, httpPort, autostart:false }); then drive
// server.drainOnce() by hand and talk HTTP to server.httpAddress().

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { argv, exit } from "node:process";

import { serve } from "./serve.mjs";
import worldEvents from "#events";

const HERE = dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = join(HERE, "webclient");
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".png": "image/png",
};

// renderRoom — a text room render for the SSE `out` channel on connect (the client also receives the
// structured `state`, but a connecting player should immediately SEE the room as prose too).
function renderRoom(snap) {
  const r = snap?.room;
  if (!r) return "You are nowhere in particular.";
  const lines = [r.name];
  if (r.description) lines.push(r.description);
  if (snap.things?.length) lines.push("You see: " + snap.things.map((t) => t.name).join(", ") + ".");
  if (snap.people?.length) lines.push("Also here: " + snap.people.map((p) => p.name).join(", ") + ".");
  lines.push("Exits: " + (r.exits.join(", ") || "none") + ".");
  return lines.join("\n");
}

export function webServe({ root, dimension, interval = 200, startRoom = "harbor-quay", httpPort = 8080, httpHost, port, autostart = true, httpAutostart = true } = {}) {
  if (!root) throw new TypeError("webServe: root is required");
  // `autostart` governs the DAEMON's tick timer (passed to serve); `httpAutostart` governs the HTTP
  // listener. Tests set autostart:false (drive drainOnce by hand) but keep the HTTP server up.
  // `httpHost` binds the listener to one interface — set it to 127.0.0.1 behind a reverse proxy so
  // only the proxy can reach the app (the deploy pattern); undefined binds all interfaces (dev).

  // The firehose: /events subscribers, each { res, topics:Set }. Every cycle the daemon hands us the
  // rows it appended; we project them to structured events (#events) and fan each to the subscribers
  // whose topic filter matches (empty filter = everything). This is the bot/dashboard channel.
  const firehose = new Set();
  const publish = async ({ rows }) => {
    let events = [];
    try { events = await worldEvents(rows, { root }); } catch { events = []; }
    for (const ev of events) {
      for (const sub of firehose) {
        if (sub.topics.size === 0 || sub.topics.has(ev.topic) || sub.topics.has(ev.type)) {
          try { sub.res.write(`event: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`); } catch { /* dead; cleaned on close */ }
        }
      }
    }
  };

  // The daemon does all the real work; we pass it our firehose hook and reuse login/enqueue/attach.
  const server = serve({ root, dimension, interval, startRoom, autostart, port, onEvent: publish });

  // tokens — an in-MEMORY map token -> sessionId. Tokens live in RAM ONLY, never on the EAVT log, so
  // they do not affect determinism or replay. A browser proves identity by carrying its token.
  const tokens = new Map();
  const mintToken = (sessionId) => { const tok = randomBytes(16).toString("hex"); tokens.set(tok, sessionId); return tok; };

  const fileCache = new Map();
  async function serveStatic(res, name) {
    const safe = String(name).replace(/\.\.+/g, "").replace(/^\/+/, "") || "index.html";
    const file = join(CLIENT_DIR, safe);
    if (!file.startsWith(CLIENT_DIR) || !existsSync(file)) { res.writeHead(404); res.end("not found"); return; }
    let body = fileCache.get(file);
    if (!body) { body = await readFile(file); fileCache.set(file, body); }
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  }

  const readBody = (req) => new Promise((resolve) => {
    let b = ""; req.on("data", (c) => { b += c; if (b.length > 1e6) req.destroy(); });
    req.on("end", () => { try { resolve(JSON.parse(b || "{}")); } catch { resolve({}); } });
    req.on("error", () => resolve({}));
  });
  const json = (res, code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
  const sseHead = (res) => res.writeHead(200, {
    "content-type": "text/event-stream", "cache-control": "no-cache",
    connection: "keep-alive", "x-accel-buffering": "no",
  });

  const http = createServer(async (req, res) => {
    let url;
    try { url = new URL(req.url, "http://localhost"); } catch { res.writeHead(400); res.end("bad url"); return; }
    const path = url.pathname;
    try {
      // --- static client -----------------------------------------------------------------------
      if (req.method === "GET" && (path === "/" || path === "/index.html")) return serveStatic(res, "index.html");
      if (req.method === "GET" && /^\/(app\.js|style\.css|favicon\.ico)$/.test(path)) return serveStatic(res, path);

      // --- login: resume-or-create a player, mint a token --------------------------------------
      if (req.method === "POST" && path === "/session") {
        const { name, secret } = await readBody(req);
        if (!name || !String(name).trim()) return json(res, 400, { error: "name required" });
        const sessionId = await server.login(String(name).trim(), secret ? { secret } : undefined);
        return json(res, 200, { session: sessionId, token: mintToken(sessionId) });
      }

      // --- input: enqueue a command on the same disk queue the daemon drains --------------------
      if (req.method === "POST" && path === "/input") {
        const { token, line } = await readBody(req);
        const sessionId = tokens.get(token);
        if (!sessionId) return json(res, 401, { error: "bad token" });
        if (line != null && String(line).length) await server.enqueue(sessionId, String(line));
        return json(res, 202, { ok: true });
      }

      // --- /stream: the session's live output + structured state (SSE) --------------------------
      if (req.method === "GET" && path === "/stream") {
        const sessionId = tokens.get(url.searchParams.get("token"));
        if (!sessionId) { res.writeHead(401); res.end("bad token"); return; }
        sseHead(res); res.write(":ok\n\n");
        const writeEvent = (name, data) => { try { res.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`); } catch { /* dead */ } };
        const pushState = async () => { try { const s = await server.snapshotState(sessionId); if (s) writeEvent("state", s); } catch { /* transient */ } };
        // An SSE output sink: each drained output line becomes an `out` event; then refresh `state`
        // so the panels track what just happened. Registered in the daemon's mirror like a socket.
        const sink = { kind: "sse", send: (lines, channel = "out") => { const ev = channel === "sense" ? "sense" : "out"; for (const l of lines) writeEvent(ev, l); pushState(); } };
        server.attach(sessionId, sink);
        // Initial paint: the room as prose + the structured state.
        const snap = await server.snapshotState(sessionId);
        if (snap) { writeEvent("out", renderRoom(snap)); writeEvent("state", snap); }
        // Keep-alive + a periodic state refresh (vitals decay even when nothing is said). Unref'd so
        // a stray stream never keeps the process alive.
        const ka = setInterval(() => { try { res.write(":ka\n\n"); } catch { /* dead */ } pushState(); }, 8000);
        if (typeof ka.unref === "function") ka.unref();
        const cleanup = () => { clearInterval(ka); server.detach(sessionId, sink); };
        req.on("close", cleanup); req.on("error", cleanup);
        return;
      }

      // --- /events: the structured world-event firehose (SSE), topic-filtered -------------------
      if (req.method === "GET" && path === "/events") {
        sseHead(res); res.write(":ok\n\n");
        const topics = new Set((url.searchParams.get("topics") || "").split(",").map((s) => s.trim()).filter(Boolean));
        const sub = { res, topics };
        firehose.add(sub);
        const ka = setInterval(() => { try { res.write(":ka\n\n"); } catch { /* dead */ } }, 15000);
        if (typeof ka.unref === "function") ka.unref();
        const cleanup = () => { clearInterval(ka); firehose.delete(sub); };
        req.on("close", cleanup); req.on("error", cleanup);
        return;
      }

      res.writeHead(404); res.end("not found");
    } catch (e) {
      try { res.writeHead(500); res.end(String(e?.message ?? e)); } catch { /* response already gone */ }
    }
  });

  // The HTTP server is the daemon's keep-alive: it must stay REF'd so `node scripts/web.mjs` runs
  // forever (the tick timer is unref'd, so without this the process would have nothing to wait on
  // and exit immediately — which 502s behind nginx). Tests close it via stopWeb()/process.exit().
  if (httpAutostart) http.listen(httpPort, httpHost);

  // Web-specific handles on the same server object the daemon returned.
  server.http = http;
  server.httpAddress = () => http.address();
  server.tokens = tokens;
  server.startHttp = (p = httpPort) => http.listen(p);
  server.stopWeb = () => {
    try { http.close(); } catch { /* already closing */ }
    for (const s of firehose) { try { s.res.end(); } catch { /* gone */ } }
    firehose.clear();
    server.stop();
  };
  return server;
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = argv.slice(2);
  const root = args.find((a) => !a.startsWith("--"));
  if (!root) {
    console.error("usage: node scripts/web.mjs <world> [--http 8080] [--host 127.0.0.1] [--port 4000] [--start <room>] [--interval MS]");
    exit(2);
  }
  const flag = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
  const httpPort = Number(flag("--http", "8080"));
  const httpHost = flag("--host", undefined); // bind 127.0.0.1 behind nginx; default all interfaces
  const portFlag = flag("--port", null);
  const port = portFlag != null ? Number(portFlag) : undefined;
  const startRoom = flag("--start", "harbor-quay");
  const interval = Number(flag("--interval", "200"));
  const server = webServe({ root, startRoom, httpPort, httpHost, port, interval, autostart: true });
  console.log(`TAB web server up: http://localhost:${httpPort}  (world ${root}, start ${startRoom})`);
  console.log(`  play:   open http://localhost:${httpPort} in a browser`);
  console.log(`  watch:  curl -N http://localhost:${httpPort}/events?topics=market,combat,chat`);
  if (port != null) console.log(`  telnet: also listening on port ${port}`);
  process.on("SIGINT", () => { server.stopWeb?.(); console.log("\nTAB web down."); exit(0); });
}
