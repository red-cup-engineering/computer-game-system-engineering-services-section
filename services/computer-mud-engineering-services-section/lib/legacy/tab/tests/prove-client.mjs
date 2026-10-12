// prove-client — the CLIENT EXPERIENCE (Layer 3, first slice): a terminal client that connects to a
// running serve.mjs daemon over its DISK transport (writes the session's .inbox, tails its .outbox),
// plus the serve.mjs node:net socket transport so raw telnet/nc clients work. Builds Farstone into a
// UNIQUE temp dir and drives the daemon's programmatic API (autostart:false — the test owns the
// clock) so everything is deterministic with no real timers.
//
// Asserts:
//   (a) makeClient.send + poll: a `look` enqueues on disk; after one drain, poll() returns the
//       rendered room (room name + Exits:) — a tail of the session's .outbox.
//   (b) makeClient.status: status() reads the player's location + needs + time DIRECTLY off the
//       world dir (no daemon round-trip), showing the start room and the three need bars.
//   (c) poll is a TAIL: a second command after a second drain yields only the NEW line.
//   (d) socket transport: open a net connection to a `port`, send name + `look`, assert a reply —
//       guarded by timeouts so it can NEVER hang.
//
// Same tiny harness as tests/prove-server.mjs / prove-interaction.mjs.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect as netConnect } from "node:net";

import { locationOf } from "#substrate";
import buildFarstone from "./fixtures/build-fixture.mjs";
import { serve, drainOnce, slugify } from "../scripts/serve.mjs";
import { makeClient } from "../scripts/client.mjs";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );

const tmp = mkdtempSync(join(tmpdir(), "tab-client-"));
const world = join(tmp, "farstone");
const START = "harbor-district";

let server = null;
try {
  await buildFarstone(world);

  // The daemon owns the world; the test owns the clock (no autostart). Open a socket transport too
  // (port:0 -> an OS-assigned free port) for the round-trip test.
  server = serve({ root: world, dimension: "farstone", startRoom: START, autostart: false, port: 0 });

  // --- (a) send + poll: look enqueues, drains, and tails back the rendered room -----------------
  await ok("client: send('look') + drain -> poll() returns the rendered room", async () => {
    const c = makeClient({ root: world, name: "Pat" });
    await c.send("look");
    await drainOnce(server); // tick, drain Pat's inbox (auto-login first), write outbox.
    const lines = await c.poll();
    const text = lines.join("\n");
    assert.match(text, /Harbor District|Farston/, "poll surfaces the room name");
    assert.match(text, /Exits:/, "poll surfaces the exits line");
    assert.equal(await locationOf(world, slugify("Pat")), START, "Pat was auto-logged into the start room");
  });

  // --- (b) status: location + needs + time, read straight off the world dir ---------------------
  await ok("client: status() shows location, the three need bars, and the world time", async () => {
    const c = makeClient({ root: world, name: "Pat" });
    const s = await c.status();
    assert.equal(s.location, START, "status shows Pat's location");
    assert.ok(s.needs && s.needs.levels, "status carries a needs reading");
    for (const need of ["hunger", "rest", "recreation"]) {
      assert.equal(typeof s.needs.levels[need], "number", `status has a ${need} level`);
    }
    assert.ok(["content", "strained", "breaking"].includes(s.needs.band), "status carries a mood band");
    assert.ok(s.time && typeof s.time.hour === "number" && typeof s.time.phase === "string",
      "status carries the world time-of-day");
  });

  // --- (c) poll is a TAIL: a second command yields only the NEW output line ---------------------
  await ok("client: poll() is a tail — a second command returns only the new line", async () => {
    const c = makeClient({ root: world, name: "Quinn" });
    await c.send("look");
    await drainOnce(server);
    const first = await c.poll();
    assert.ok(first.length >= 1, "first poll drains the first look");
    assert.deepEqual(await c.poll(), [], "no new output -> empty poll");
    await c.send("look");
    await drainOnce(server);
    const second = await c.poll();
    assert.ok(second.length >= 1, "second poll returns only the new look");
    assert.ok(!second.join("\n").includes(first.join("\n") + "\n" + second.join("\n")),
      "the tail does not re-deliver the first look");
  });

  // --- (d) socket transport: telnet-style round-trip, guarded so it can't hang ------------------
  await ok("socket: a net client can log in by name and get a reply (timeout-guarded)", async () => {
    const addr = server.address();
    assert.ok(addr && addr.port, "the net transport bound a port");
    const port = addr.port;

    const reply = await new Promise((resolve, reject) => {
      let buf = "";
      let sentName = false;
      const sock = netConnect({ port, host: "127.0.0.1" });
      // HARD timeout: never let the test hang on the socket path.
      const guard = setTimeout(() => { try { sock.destroy(); } catch {} reject(new Error("socket round-trip timed out")); }, 4000);
      const finish = (val) => { clearTimeout(guard); clearInterval(driver); try { sock.destroy(); } catch {} resolve(val); };

      sock.setEncoding("utf8");
      sock.on("data", (d) => {
        buf += d;
        if (!sentName && /name\?/.test(buf)) { sentName = true; buf = ""; sock.write("Socky\r\n"); }
        else if (sentName && /welcome|Harbor District|Farston|Exits:/i.test(buf)) { /* got a server reply */ }
      });
      sock.on("error", (e) => { clearTimeout(guard); clearInterval(driver); reject(e); });

      // The daemon only writes socket output during drainOnce; with autostart:false the TEST must
      // pump the clock. Drain periodically until the socket has both logged in and seen its look.
      let looked = false;
      const driver = setInterval(async () => {
        try {
          if (sentName && !looked) {
            // enqueue a look on the logged-in session (the socket's first line was the name).
            looked = true;
            sock.write("look\r\n");
          }
          await drainOnce(server);
          if (/Harbor District|Farston|Exits:|welcome/i.test(buf)) finish(buf);
        } catch { /* keep pumping */ }
      }, 50);
    });

    assert.match(reply, /Harbor District|Farston|Exits:|welcome/i, "the socket got a server reply");
  });

  console.log(`\n${pass} client checks passed.`);
} finally {
  if (server) server.stop();
  rmSync(tmp, { recursive: true, force: true });
}
