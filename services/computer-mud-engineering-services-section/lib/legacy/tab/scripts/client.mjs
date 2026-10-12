// client — the CLIENT EXPERIENCE (Layer 3, first slice): a real terminal client that connects to a
// *separately running* `serve.mjs` daemon over its DISK transport. The client is a PRODUCER of
// inbox lines and a CONSUMER of outbox lines — it never writes the world. It writes commands to the
// session's `.inbox/<session>.jsonl` (exactly the wire the daemon drains) and TAILS the session's
// `.outbox/<session>.log`, rendering each new line into a scrollback area. Between refreshes it
// reads the world dir DIRECTLY (read-only) via `#substrate`/`#needing`/`#timing` to paint a STATUS
// LINE: the player's location, its needs (hunger/rest/recreation bars), its mood band, and the
// world's time-of-day. No new deps — node core (fs, readline) + raw ANSI.
//
//   node scripts/client.mjs <world> --name <player> [--port N]
//
// `--port` is accepted for symmetry with the socket transport but the disk transport is the path
// the client drives; a future socket-mode client is deferred (see report).
//
// Headless core (so a test can drive it with no TTY):
//   const c = makeClient({ root, name })
//   await c.send("look")        — enqueue one command on the session's inbox (login-creates first)
//   await c.poll()              — return the NEW outbox lines since the last poll (tail)
//   await c.status()            — { location, needs, time } read directly off the world dir

import { appendFile, readFile, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { argv, stdin, stdout, exit } from "node:process";

import { locationOf, rowsFor } from "#substrate";
import { needsOf } from "#needing";
import clock from "#timing";
import { slugify } from "./serve.mjs";

const DIMENSION = "farstone";

// The session slug is the daemon's, so the client addresses the same session files it drains.
export { slugify };

const inboxDir = (root) => join(root, ".inbox");
const outboxDir = (root) => join(root, ".outbox");
const inboxPath = (root, session) => join(inboxDir(root), `${session}.jsonl`);
const outboxPath = (root, session) => join(outboxDir(root), `${session}.log`);

// currentTick — the world's latest tick integer, read off the dimension's own fiber (same reading
// play.mjs uses). Read-only: the client never advances the world.
async function currentTick(root, dimension = DIMENSION) {
  const rows = (await rowsFor(root, dimension)).filter((r) => r.e === dimension && r.a === "tick");
  let best = 0;
  for (const r of rows) best = Math.max(best, Number(r.v));
  return best;
}

// makeClient — the headless core. Owns the session id (the slug) and a byte offset into the outbox
// so `poll()` returns only NEW lines (a tail). All world reads are read-only.
export function makeClient({ root, name, dimension = DIMENSION } = {}) {
  if (!root) throw new TypeError("makeClient: root is required");
  if (!name) throw new TypeError("makeClient: name is required");
  const session = slugify(name);
  let offset = 0;          // bytes of the outbox already delivered by poll().
  let carry = "";          // a partial last line held back until its newline arrives.

  // send — enqueue one command line on the session's inbox (the disk transport). Identical wire to
  // serve.mjs's `enqueue`: one JSON-escaped line per command, so whitespace/newlines survive. The
  // daemon's auto-login resume-or-creates the player on first drain, so the client need not log in.
  async function send(line) {
    await mkdir(inboxDir(root), { recursive: true });
    await appendFile(inboxPath(root, session), JSON.stringify(String(line)) + "\n");
  }

  // poll — return the NEW outbox lines since the last poll (a byte-offset tail). A trailing partial
  // line (no newline yet) is carried over and not emitted until the daemon finishes writing it.
  async function poll() {
    const f = outboxPath(root, session);
    if (!existsSync(f)) return [];
    const size = (await stat(f)).size;
    if (size < offset) { offset = 0; carry = ""; } // truncated/rotated: re-tail from the top.
    if (size === offset) return [];
    const raw = await readFile(f, "utf8");
    const fresh = carry + raw.slice(offset);
    offset = size;
    const parts = fresh.split("\n");
    carry = parts.pop(); // last element is the partial (or "" if fresh ended on a newline).
    return parts;
  }

  // status — the STATUS LINE data, read DIRECTLY off the world dir (no daemon round-trip):
  //   location : where the player stands (locationOf), or null if not yet placed.
  //   needs    : { levels:{hunger,rest,recreation}, mood, band, pressing } (needsOf), or null.
  //   time     : the world calendar { day, hour, season, phase, year, dayOfSeason } (clock(tick)).
  async function status() {
    const location = await locationOf(root, session);
    const time = clock(await currentTick(root, dimension));
    let needs = null;
    if (location) { try { needs = await needsOf(root, session); } catch { needs = null; } }
    return { location, needs, time };
  }

  return { session, send, poll, status };
}

// --- the TUI (ANSI, zero-dep) -----------------------------------------------------------------

const ESC = "\x1b[";
const RESET = `${ESC}0m`;
const color = (c, s) => `${ESC}${c}m${s}${RESET}`;
const DIM = "2";
const BOLD = "1";
const CYAN = "36";
const YELLOW = "33";
const GREEN = "32";
const RED = "31";

// bar — a fixed-width need meter, e.g. `hunger [#######...] 72`. Colored by how satisfied it is
// (green high, yellow mid, red low). Pure: integer level in, string out.
function bar(label, level, width = 10) {
  const lvl = Math.max(0, Math.min(100, Math.trunc(Number(level))));
  const filled = Math.round((lvl / 100) * width);
  const meter = "#".repeat(filled) + ".".repeat(width - filled);
  const c = lvl >= 60 ? GREEN : lvl >= 30 ? YELLOW : RED;
  return `${label} ${color(c, `[${meter}]`)} ${String(lvl).padStart(3)}`;
}

// statusLine — render the one-line HUD from a status() reading.
function statusLine({ location, needs, time }) {
  const where = color(CYAN, location || "(nowhere)");
  const t = time ? color(DIM, `${time.phase} h${String(time.hour).padStart(2, "0")} ${time.season} d${time.day}`) : "";
  if (!needs) return `${where}   ${t}`;
  const meters = [
    bar("hun", needs.levels.hunger, 8),
    bar("rst", needs.levels.rest, 8),
    bar("rec", needs.levels.recreation, 8),
  ].join("  ");
  const moodC = needs.band === "content" ? GREEN : needs.band === "strained" ? YELLOW : RED;
  const mood = color(moodC, needs.band);
  return `${where}  ${meters}  mood:${mood}  ${t}`;
}

// repaint — clear the screen, print the scrollback, then pin the status line + prompt at the bottom.
// A simple full-redraw TUI (no curses): cheap and deterministic for a tail-driven client.
function repaint(scrollback, status, promptText) {
  stdout.write(`${ESC}2J${ESC}H`); // clear + home
  const rows = (stdout.rows || 24);
  const room = Math.max(1, rows - 3);
  const tail = scrollback.slice(-room);
  stdout.write(tail.join("\n"));
  stdout.write(`\n${ESC}${rows - 1};1H`); // move to second-to-last row
  stdout.write(color(DIM, "─".repeat(Math.max(10, (stdout.columns || 80) - 1))) + "\n");
  stdout.write(statusLine(status) + "\n");
  stdout.write(promptText);
}

// --- CLI --------------------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = argv.slice(2);
  const root = args.find((a) => !a.startsWith("--"));
  const flag = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
  const name = flag("--name", null);
  if (!root || !name) {
    console.error("usage: node scripts/client.mjs <world> --name <player> [--port N]");
    exit(2);
  }
  if (!existsSync(root)) {
    console.error(`client: world "${root}" does not exist (is a serve.mjs daemon running on it?)`);
    exit(2);
  }
  // --port: accepted; the disk transport is what this client drives. (A socket-mode client that
  // speaks the serve.mjs net transport directly is deferred — see report.)
  const refreshMs = Number(flag("--refresh", "250"));
  const client = makeClient({ root, name });
  const promptText = color(BOLD, "> ");
  const scrollback = [color(GREEN, `connected to ${root} as ${name} (session ${client.session}).`),
    color(DIM, "type a command; ctrl-d to quit.")];

  let status = await client.status();
  repaint(scrollback, status, promptText);

  // The render loop: poll the outbox + re-read status on an interval, repaint when anything changed.
  let dirty = false;
  const timer = setInterval(async () => {
    try {
      const fresh = await client.poll();
      if (fresh.length) { scrollback.push(...fresh); dirty = true; }
      status = await client.status();
      // Always repaint the status line (time/needs move on their own under the daemon's ticks).
      repaint(scrollback, status, promptText);
      dirty = false;
    } catch { /* a transient read race against the daemon's write — try again next tick. */ }
  }, refreshMs);
  if (typeof timer.unref === "function") timer.unref();

  // Kick the session into existence so the status line populates (the daemon auto-logins on drain).
  await client.send("look");

  const rl = createInterface({ input: stdin, terminal: false });
  for await (const line of rl) {
    const cmd = line.trim();
    if (cmd === "quit" || cmd === "q") { await client.send("quit"); break; }
    if (cmd) {
      scrollback.push(color(DIM, `> ${cmd}`));
      await client.send(cmd);
    }
    repaint(scrollback, status, promptText);
  }
  clearInterval(timer);
  stdout.write(`\n${color(GREEN, "disconnected.")}\n`);
  exit(0);
}
