// serve — the SERVER (Layer 3, first slice): a runtime daemon that owns the tick and serves
// many sessions against one world. The daemon is the SOLE world-writer; sessions never touch the
// log. They enqueue input on disk (`.inbox/<session>.jsonl`, one command per line); the loop,
// under a busy-guard so a tick and an input-drain never overlap, does one cycle:
//
//   (1) ticking({ root, dimension })            — one autonomous advance (the world acts on itself)
//   (2) drain every .inbox/<session>.jsonl      — each line is one command; the daemon binds the
//       session to its player actor and runs makeSession.handle(line). Drain order is FIXED
//       (sessions in sorted-name order; lines in file order) and each input is assigned the next
//       value of a SERVER-WIDE monotonic counter, so concurrent sessions' moves are totally
//       ordered within the tick — deterministically and identically on replay (the order is a
//       function of the on-disk queue, not of wall-clock arrival).
//   (3) write each session's output line(s) to .outbox/<session>.log
//
// Sessions never write the world directly — only the daemon, draining, appends. That keeps replay
// exact: the only nondeterministic input (packet arrival) is frozen into the drain order ONCE, at
// drain time, and the world rows it produces are tick-anchored (makeSession stamps moves
// `tick:<N>/play:<seq>`, sorting AFTER this tick's ambient/decay writes and BEFORE the next tick).
//
// First cut uses a DISK transport (zero-dep, replay-inspectable) — NOT sockets yet. Login is
// name-only: a session names itself -> a slugified actor id; resume-or-create on disk. Accounts/
// auth as data are left as a hook (see `account`).
//
//   node scripts/serve.mjs <world> [--interval MS] [--start <room>] [--dimension <dim>]
//
// Programmatic API (drive it without the CLI / real timers, for tests):
//   const server = serve({ root, dimension, interval, startRoom, autostart:false })
//   connect(server, "alice")              -> ensures the session's player exists/located (login)
//   send(server, "alice", "look")          -> enqueues one command line on disk
//   await drainOnce(server)                -> run exactly ONE cycle (tick + drain + outbox)
//   server.stop()                          -> stop the timer loop (if autostarted)

import { appendFile, readFile, readdir, mkdir, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { argv, exit } from "node:process";

import { locationOf, onAppend, useRuntime, dropRuntime } from "#substrate";
import { loadRuntime } from "#runtime";
import doing from "#doing";
import ticking from "#ticking";
import perceive from "#perceiving";
import wrapTelnet from "#telnet";
import { makeSession } from "./play.mjs";
import { slugify as slugifyText } from "../../../../../../../../../computer-data-engineering-services-section/services/computer-content-engineering-services-section/services/computer-text-content-engineering-services-section/src/slugify-text.mjs";

const DIMENSION = "farstone";

// slugify — a session name -> a stable, filesystem- and id-safe actor id. Lowercase, non-alnum
// runs collapse to a single dash, trimmed. Deterministic so the same name always resumes the
// same actor on reconnect (reconnection is resume, not a new actor).
export function slugify(name) {
  return slugifyText(String(name)) || "anon";
}

const inboxDir = (root) => join(root, ".inbox");
const outboxDir = (root) => join(root, ".outbox");
const inboxPath = (root, session) => join(inboxDir(root), `${session}.jsonl`);
const outboxPath = (root, session) => join(outboxDir(root), `${session}.log`);

// serve — construct the daemon. Returns a control handle. With `autostart` (the default for the
// CLI) it runs a setInterval loop; tests pass `autostart:false` and drive `drainOnce` by hand so
// the simulation is deterministic with no real timers.
export function serve({ root, dimension = DIMENSION, interval = 200, startRoom = "harbor-district", autostart = true, port, onEvent } = {}) {
  if (!root) throw new TypeError("serve: root is required");

  // Per-session state, keyed by session id (the slug). `actor` is the bound player; `session` is
  // its makeSession core. The daemon owns these — a session is a producer of inbox lines only.
  const sessions = new Map();
  let busy = false;          // the busy-guard: a tick and a drain never overlap.
  let order = 0;             // SERVER-WIDE monotonic counter: every drained input gets the next.
  let timer = null;
  let netServer = null;      // the optional node:net line-server (only when `port` is set).
  // sinks — session id -> Set of output SINKS bound to that session. A sink is `{ kind, send(lines),
  // raw? }`: the drain mirrors each session's output lines to every attached sink (in addition to its
  // .outbox), so a live transport (raw telnet, or a browser's SSE stream) sees its replies as they
  // happen. The disk log stays the source of truth; sinks are a read-only mirror. TCP and the web
  // both attach here — a sink is the generalization of "a socket".
  const sinks = new Map();
  // onEvent — an optional firehose callback. Each cycle the daemon collects EVERY row appended (the
  // tick's ambient/npc rows AND the rows the drained player commands produced) and hands them to
  // onEvent({ tick, rows }) — a domain-agnostic stream the web server projects into structured world
  // events (say/move/trade/…). Pure observation; it never touches the log, so replay is unaffected.

  const server = { root, dimension, startRoom, sessions, stop };

  // Runtime acceleration: the daemon registers an in-memory materialized view of the world (derived;
  // the on-disk log stays authoritative) so the hot reads — settle/containedBy/locationOf, which the
  // tick and perception hammer every cycle — hit RAM instead of re-reading the log. Without it a
  // single tick costs SECONDS on a real world; with it, milliseconds (the same view `run.mjs` uses).
  // Loaded once, lazily, behind a cached promise so logins and the tick share one registration; the
  // view honors every settle opt (observer/witness/functional) so the deep systems read correctly.
  let runtimeP = null;
  function ensureRuntime() {
    if (!runtimeP) runtimeP = (async () => { try { useRuntime(root, await loadRuntime(root)); } catch { /* fall back to the disk path */ } })();
    return runtimeP;
  }

  function bind(sessionId) {
    let entry = sessions.get(sessionId);
    if (!entry) {
      const actor = sessionId; // the slug IS the actor id (login produced it).
      // `here`/`seen` carry the session's PERCEPTION delta state (who it last saw co-located, and
      // the last tick it perceived through) — see the perception step in drainOnce. `here:null`
      // marks a session that has never perceived: its first cycle seeds state without dumping
      // backlog (a fresh login starts clean, not mid-conversation).
      entry = { actor, session: makeSession({ root, actor }), here: null, seen: 0 };
      sessions.set(sessionId, entry);
    }
    return entry;
  }

  // login — resume-or-create the session's player. If the actor already has a location on disk,
  // resume it as-is; otherwise create it: naming + located-in startRoom + mover:session +
  // kind:player. Accounts/auth as data are minimal here (name only); `account` is the hook for a
  // later hashed-secret cell. All seed writes are stamped `login:<N>` (a pre-tick seed stamp, so
  // they sort before any tick row, exactly like build-farstone's `seed:<N>`).
  async function login(name, account) {
    await ensureRuntime(); // register the accelerator before the first write, so the view sees it
    const sessionId = slugify(name);
    const actor = sessionId;
    const existing = await locationOf(root, actor);
    if (!existing) {
      let s = 0;
      const t = () => `login:${sessionId}:${String(++s).padStart(6, "0")}`;
      await doing({ root, subject: actor, predicate: "kind", object: "player", t: t() });
      await doing({ root, subject: actor, predicate: "naming", object: name, t: t() });
      await doing({ root, subject: actor, predicate: "mover", object: "session", t: t() });
      await doing({ root, subject: actor, predicate: "located-in", object: startRoom, t: t() });
      // Hook: account data as a cell on the actor's own log (name only this cut).
      if (account && account.secret) {
        await doing({ root, subject: actor, predicate: "secret", object: account.secret, t: t() });
      }
    }
    bind(sessionId);
    return sessionId;
  }

  // enqueue — append one command line to the session's inbox (the transport). A session is a
  // producer; this is all it ever does to the world's directory. One JSON-escaped line per command
  // so a command can carry whitespace/newlines safely.
  async function enqueue(sessionId, line) {
    const f = inboxPath(root, sessionId);
    await mkdir(inboxDir(root), { recursive: true });
    await appendFile(f, JSON.stringify(line) + "\n");
  }

  // readInbox — read + CLEAR a session's inbox atomically-enough for the single-writer loop:
  // read the lines, then truncate the file (we hold the busy-guard, so no producer interleaves a
  // partial line — appends are whole-line and the truncate happens between cycles). Returns the
  // parsed command lines in file order.
  async function readInbox(sessionId) {
    const f = inboxPath(root, sessionId);
    if (!existsSync(f)) return [];
    const raw = await readFile(f, "utf8");
    await writeFile(f, ""); // drained: clear so the next cycle doesn't re-run these.
    return raw.split("\n").filter(Boolean).map((l) => JSON.parse(l));
  }

  // sessionFiles — every session with a pending inbox on disk, in SORTED name order. Sorting is
  // the server-wide order's outer key: the drain visits sessions in a fixed, replay-stable order
  // regardless of which connected first. Includes both bound sessions and any inbox files found on
  // disk (so a crash-recovered daemon picks up queues it didn't create in-process).
  async function sessionFiles() {
    const ids = new Set([...sessions.keys()]);
    if (existsSync(inboxDir(root))) {
      for (const n of await readdir(inboxDir(root))) {
        if (n.endsWith(".jsonl")) ids.add(n.slice(0, -".jsonl".length));
      }
    }
    return [...ids].sort();
  }

  // drainOnce — ONE cycle, under the busy-guard. (1) tick; (2) drain all inboxes in fixed order,
  // running each command through its session's handler (the daemon is the writer — handle()'s
  // appends ARE the world write); (3) append outputs to each session's outbox. Returns a small
  // record of what happened (useful for tests).
  async function drainOnce() {
    if (busy) return { skipped: true };
    busy = true;
    await ensureRuntime(); // the in-memory view is what makes a tick milliseconds, not seconds
    // Collect every row appended this cycle (tick + player commands) for the firehose, only when a
    // watcher is attached (zero cost otherwise).
    const collected = [];
    const off = onEvent ? onAppend(root, (row) => collected.push(row)) : null;
    try {
      // (1) the autonomous advance — the world acts on itself before serving input.
      const { tick } = await ticking({ root, dimension });

      // (2) drain. Visit sessions in sorted order; within a session, lines in file order. Each
      // input takes the next server-wide counter value, so the WHOLE batch this tick has a single
      // total order — logged implicitly as the order rows are appended at their tick-anchored t.
      const outputs = new Map(); // sessionId -> [out lines]   (command results + heard speech)
      const senses = new Map();  // sessionId -> [sense lines] (the ambient sensory backdrop)
      const drained = [];
      for (const sessionId of await sessionFiles()) {
        // Auto-login: a session that enqueued on disk without an explicit login (e.g. the CLI
        // path) still needs its player resume-or-created before its commands can run.
        if (!sessions.has(sessionId) || !(await locationOf(root, sessionId))) await login(sessionId);
        const entry = bind(sessionId);
        const lines = await readInbox(sessionId);
        const outs = [];
        for (const line of lines) {
          const seq = ++order; // SERVER-WIDE monotonic counter.
          let out;
          try {
            out = await entry.session.handle(line);
          } catch (e) {
            out = `error: ${e.message}`;
          }
          if (out === "__quit__") {
            out = "Bye.";
            sessions.delete(sessionId);
          }
          drained.push({ session: sessionId, order: seq, line, out });
          if (out) outs.push(out);
        }
        if (outs.length) outputs.set(sessionId, outs);
      }

      // (2b) PERCEPTION — every bound session perceives what newly happened in its place this cycle
      // (other players' speech, arrivals/departures, blows, the weather turning), appended to its
      // output AFTER command results so a player sees its own echo first, then the world react. A
      // session's first perception only SEEDS its delta state (no backlog dump); thereafter it is a
      // live stream. Computed once per cycle, deterministically (a function of the trace + window).
      for (const [sessionId, entry] of sessions) {
        if (!(await locationOf(root, sessionId))) continue;
        const first = entry.here === null;
        const { tagged, hereNow, throughTick } = await perceive({ root, observer: sessionId, prevHere: entry.here, sinceTick: entry.seen, nowTick: tick, dimension });
        entry.here = hereNow;
        entry.seen = throughTick;
        if (first || !tagged.length) continue;
        // Speech is conversation → the main OUT log; movement/harm/weather is the sensory backdrop →
        // the SENSE channel (a rich client side-panels it; raw telnet sees both inline).
        const speech = tagged.filter((e) => e.kind === "speech").map((e) => e.line);
        const ambient = tagged.filter((e) => e.kind !== "speech").map((e) => e.line);
        if (speech.length) { const a = outputs.get(sessionId) ?? []; a.push(...speech); outputs.set(sessionId, a); }
        if (ambient.length) { const a = senses.get(sessionId) ?? []; a.push(...ambient); senses.set(sessionId, a); }
      }

      // (3) outbox — append each session's output lines (with a prompt-ish separator) to its log.
      // When a socket transport is active, ALSO mirror the lines to every socket bound to the
      // session, so raw telnet/nc clients see their replies live (the disk log stays authoritative).
      const recipients = new Set([...outputs.keys(), ...senses.keys()]);
      for (const sessionId of recipients) {
        const outs = outputs.get(sessionId);
        const sens = senses.get(sessionId);
        const bound = sinks.get(sessionId);
        if (outs && outs.length) {
          await mkdir(outboxDir(root), { recursive: true });
          await appendFile(outboxPath(root, sessionId), outs.join("\n") + "\n"); // the OUT channel is the authoritative transcript
          if (bound) for (const sink of bound) { try { sink.send(outs, "out"); } catch { /* dead sink: cleaned on close */ } }
        }
        if (sens && sens.length && bound) for (const sink of bound) { try { sink.send(sens, "sense"); } catch { /* dead */ } }
      }

      // (4) firehose — hand this cycle's rows to the optional watcher (the web server projects them
      // into structured world events). Pure observation; a throwing watcher never breaks the world.
      if (onEvent) { try { onEvent({ tick, rows: collected }); } catch { /* a watcher must not break the world */ } }

      return { tick, drained };
    } finally {
      if (off) off();
      busy = false;
    }
  }

  function start() {
    if (timer) return;
    timer = setInterval(() => { drainOnce().catch(() => { /* keep the world breathing */ }); }, interval);
    if (typeof timer.unref === "function") timer.unref();
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    if (netServer) { try { netServer.close(); } catch { /* already closing */ } netServer = null; }
    for (const set of sinks.values()) for (const s of set) { try { s.raw?.destroy?.(); } catch { /* gone */ } }
    sinks.clear();
    dropRuntime(root); runtimeP = null; // release the in-memory view (the disk log is authoritative)
  }

  // attach — bind an output SINK to a session id (login produced it). A sink is `{ kind, send(lines),
  // raw? }` — TCP wraps a socket write, the web wraps an SSE response write. The drain mirrors this
  // session's output to every sink in the set; close detaches.
  function attach(sessionId, sink) {
    let set = sinks.get(sessionId);
    if (!set) { set = new Set(); sinks.set(sessionId, set); }
    set.add(sink);
  }
  function detach(sessionId, sink) {
    const set = sinks.get(sessionId);
    if (set) { set.delete(sink); if (set.size === 0) sinks.delete(sessionId); }
  }

  // snapshotState — a session's structured situation (room/exits/people/things/inventory/vitals) for
  // a rich client, via the session's makeSession.snapshot(). Null if the session is unknown.
  async function snapshotState(sessionId) {
    const entry = sessions.get(sessionId);
    if (!entry) return null;
    return entry.session.snapshot();
  }

  // listen — the optional node:net line-server transport. Each socket is a session: the FIRST line
  // is the login name (-> connect -> resume-or-create + a slug), every subsequent line is enqueued
  // to the SAME disk drain queue as the disk transport (so socket and disk inputs share one total
  // order, drained identically). Output is mirrored to the socket in step (3) of drainOnce. A raw
  // `telnet localhost <port>` / `nc localhost <port>` works: connect, type a name, then play.
  function listen(p) {
    if (netServer) return;
    netServer = createServer((sock) => {
      let sessionId = null;
      // Wrap the raw socket in the telnet protocol layer (`#telnet`): IAC option negotiation, MCCP2
      // compression, MXP, and GMCP/MSDP out-of-band data. A modern MUD client (Mudlet, TinTin++) gets
      // the full treatment; a bare `telnet`/`nc` still works — every option degrades to plain text.
      const tel = wrapTelnet(sock);
      tel.negotiate();
      // The TCP sink mirrors the daemon's output to this client through telnet (so MCCP/MXP apply).
      // GMCP/MSDP-aware clients ALSO get the session's structured vitals/room as out-of-band JSON —
      // a status gauge that updates as the world ticks, alongside the text. (Channel arg ignored:
      // raw telnet shows speech + senses inline.)
      const sink = {
        kind: "tcp",
        send: (lines) => {
          for (const l of lines) tel.sendLine(l);
          if (sessionId && (tel.supports.gmcp || tel.supports.msdp)) {
            snapshotState(sessionId).then((sn) => {
              if (!sn) return;
              if (tel.supports.gmcp) {
                tel.sendGMCP("Char.Vitals", sn.vitals ?? {});
                if (sn.room) tel.sendGMCP("Room.Info", { name: sn.room.name, exits: sn.room.exits });
              }
              if (tel.supports.msdp) tel.sendMSDP({ ROOM_NAME: sn.room?.name ?? "", HUNGER: String(sn.vitals?.needs?.hunger ?? "") });
            }).catch(() => { /* transient */ });
          }
        },
        raw: sock,
      };
      tel.sendLine("name?");
      tel.onLine((raw) => {
        const line = String(raw).trim();
        if (sessionId === "__pending__") return; // login in flight — drop input until it resolves
        if (sessionId === null) {
          if (!line) { tel.sendLine("name?"); return; }
          // Claim the slot BEFORE the async login so a fast second line (a client that pipes
          // name+command) doesn't get treated as a second login while the first resolves.
          sessionId = "__pending__";
          login(line).then((id) => {
            sessionId = id;
            attach(sessionId, sink);
            tel.sendLine(`welcome, ${line} (session ${sessionId}). type 'look'.`);
          }).catch((e) => { sessionId = null; try { tel.sendLine(`login failed: ${e.message}`); } catch { /* gone */ } });
          return;
        }
        // a play line: enqueue on the same disk queue the daemon drains.
        if (line.length) enqueue(sessionId, line).catch(() => { /* transient; client retries */ });
      });
      const cleanup = () => { if (sessionId) detach(sessionId, sink); try { tel.close(); } catch { /* gone */ } };
      sock.on("close", cleanup);
      sock.on("error", cleanup);
    });
    netServer.listen(p);
    if (typeof netServer.unref === "function") netServer.unref();
  }

  if (autostart) start();
  if (port != null) listen(port);

  // Attach the per-server operations so the free functions below can drive THIS server.
  server.login = login;
  server.enqueue = enqueue;
  server.drainOnce = drainOnce;
  server.start = start;
  server.listen = listen;                                  // open the net transport after the fact.
  server.address = () => (netServer ? netServer.address() : null); // the bound port (for tests).
  server.attach = attach;                                  // bind an output sink (TCP or SSE) to a session.
  server.detach = detach;
  server.snapshotState = snapshotState;                    // structured situation for a rich client.
  server.sinks = sinks;
  server.outboxPath = (sessionId) => outboxPath(root, sessionId);
  server.inboxPath = (sessionId) => inboxPath(root, sessionId);
  return server;
}

// --- thin programmatic API (so tests can drive a server without the CLI) ----------------------

// connect — log a session in (resume-or-create its player). Returns the session id (slug).
export async function connect(server, name, account) {
  return server.login(name, account);
}

// send — enqueue one command line for a session (must be a slug or a name; we slugify to be safe).
export async function send(server, name, line) {
  return server.enqueue(slugify(name), line);
}

// drainOnce — run exactly one server cycle (tick + drain + outbox).
export async function drainOnce(server) {
  return server.drainOnce();
}

// readOutbox — convenience for tests/clients: the current contents of a session's outbox log.
export async function readOutbox(server, name) {
  const f = server.outboxPath(slugify(name));
  if (!existsSync(f)) return "";
  return readFile(f, "utf8");
}

// --- CLI --------------------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = argv.slice(2);
  const root = args.find((a) => !a.startsWith("--"));
  if (!root) {
    console.error("usage: node scripts/serve.mjs <world> [--interval MS] [--start <room>] [--dimension <dim>] [--port N]");
    exit(2);
  }
  const flag = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
  const interval = Number(flag("--interval", "200"));
  const startRoom = flag("--start", "harbor-district");
  const dimension = flag("--dimension", DIMENSION);
  const portFlag = flag("--port", null);
  const port = portFlag != null ? Number(portFlag) : undefined;

  const server = serve({ root, dimension, interval, startRoom, autostart: true, port });
  console.log(`tab server up on ${root} (dimension=${dimension}, interval=${interval}ms, start=${startRoom})`);
  console.log(`  enqueue:  echo '"look"' >> ${join(root, ".inbox", "<session>.jsonl")}`);
  console.log(`  output:   tail -f ${join(root, ".outbox", "<session>.log")}`);
  console.log(`  (login a session by enqueuing on its inbox; the daemon resume-or-creates it.)`);
  if (port != null) console.log(`  telnet:   telnet localhost ${port}   (type a name, then play)`);
  process.on("SIGINT", () => { server.stop(); console.log("\ntab server down."); exit(0); });
}
