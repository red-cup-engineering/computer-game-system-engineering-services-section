// prove-server — the SERVER (Layer 3, first slice): a runtime daemon that owns the tick and
// serves many sessions against one world via a disk .inbox/.outbox transport. Builds Farstone
// into a UNIQUE temp dir and drives the daemon's programmatic API (connect / send / drainOnce)
// with NO real timers, so two sessions can be simulated deterministically.
//
// Asserts:
//   (a) two sessions are created/bound and located in the start room;
//   (b) a `look` produces output in each session's .outbox;
//   (c) two players moving in the SAME cycle both settle, with a total deterministic order
//       (no lost move, replay-stable);
//   (d) the daemon is the SOLE writer — every session-driven row's `t` carries the tick-anchored
//       prefix (tick:NNNNNN/play:...);
//   (e) crash-recovery: stop and re-serve on the same root, the tick continues from disk.
//
// Same tiny harness as tests/prove-interaction.mjs.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { locationOf, rowsFor } from "#substrate";
import ticking from "#ticking";
import buildFarstone from "./fixtures/build-fixture.mjs";
import { serve, connect, send, drainOnce, readOutbox, slugify } from "../scripts/serve.mjs";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );

const tmp = mkdtempSync(join(tmpdir(), "tab-server-"));
const world = join(tmp, "farstone");
const START = "harbor-district";

// rows whose t is anchored to a tick this run produced (the daemon's writes look like
// `tick:NNNNNN/play:...` — play.mjs stamps player moves that way).
const isTickAnchored = (t) => /^tick:\d{6}\//.test(t);

try {
  await buildFarstone(world);

  // Build a daemon with NO autostart so the test owns the clock (deterministic, no real timers).
  let server = serve({ root: world, dimension: "farstone", startRoom: START, autostart: false });

  // --- (a) login: two sessions created/bound, located in the start room -----------------------
  await ok("login: two sessions resume-or-create as placed players in the start room", async () => {
    const a = await connect(server, "Alice");
    const b = await connect(server, "Bob");
    assert.equal(a, slugify("Alice"));
    assert.equal(b, slugify("Bob"));
    assert.equal(await locationOf(world, a), START, "alice is in the start room");
    assert.equal(await locationOf(world, b), START, "bob is in the start room");
    assert.ok(server.sessions.has(a) && server.sessions.has(b), "both sessions are bound");
  });

  // --- (b) look produces output in each session's .outbox -------------------------------------
  await ok("look: each session's .outbox carries its own room render", async () => {
    await send(server, "Alice", "look");
    await send(server, "Bob", "look");
    await drainOnce(server); // one cycle: tick, then drain both inboxes, then write outboxes
    const aOut = await readOutbox(server, "Alice");
    const bOut = await readOutbox(server, "Bob");
    assert.match(aOut, /Harbor District|Farston/, "alice sees the room");
    assert.match(bOut, /Harbor District|Farston/, "bob sees the room");
    assert.match(aOut, /Exits:/);
    assert.match(bOut, /Exits:/);
    // outbox files exist on disk (the transport is replay-inspectable).
    assert.ok(existsSync(server.outboxPath(slugify("Alice"))));
    assert.ok(existsSync(server.outboxPath(slugify("Bob"))));
    // inbox was drained (cleared) — no command re-runs next cycle.
    assert.equal(readFileSync(server.inboxPath(slugify("Alice")), "utf8"), "");
  });

  // --- (c) two players move in the SAME cycle: both settle, totally ordered, no lost move ------
  await ok("concurrency: two moves in one cycle both settle (no lost move)", async () => {
    // Alice south -> farston-harbor; Bob north -> downtown-farston. Enqueue BOTH before draining,
    // so they are served in the SAME cycle.
    await send(server, "Alice", "s");
    await send(server, "Bob", "n");
    const cycle = await drainOnce(server);
    assert.equal(await locationOf(world, slugify("Alice")), "farston-harbor", "alice's move settled");
    assert.equal(await locationOf(world, slugify("Bob")), "downtown-farston", "bob's move settled");
    // the daemon assigned a TOTAL, deterministic server-wide order to the batch.
    const orders = cycle.drained.map((d) => d.order);
    assert.deepEqual(orders, [...orders].sort((x, y) => x - y), "orders are monotonic");
    assert.equal(new Set(orders).size, orders.length, "orders are distinct (total order)");
    // sorted-name drain order: alice before bob.
    assert.deepEqual(cycle.drained.map((d) => d.session), [slugify("Alice"), slugify("Bob")]);
  });

  // --- (d) the daemon is the sole writer: session-driven rows are tick-anchored ----------------
  await ok("sole-writer: every session-driven move row carries the tick-anchored t prefix", async () => {
    // alice's only NON-seed/NON-login writes are her moves; each must be tick-anchored.
    const aId = slugify("Alice");
    const moves = (await rowsFor(world, aId)).filter((r) => r.e === aId && r.a === "located-in");
    const driven = moves.filter((r) => !String(r.t).startsWith("login:"));
    assert.ok(driven.length >= 1, "alice has at least one driven move");
    for (const r of driven) {
      assert.ok(isTickAnchored(r.t), `move t should be tick-anchored, got ${r.t}`);
    }
  });

  // --- replay-stability: the same enqueue + drain reproduces the same ordering -----------------
  await ok("replay-stable: a fresh world + same script reproduces the identical batch order", async () => {
    const tmp2 = mkdtempSync(join(tmpdir(), "tab-server-replay-"));
    const world2 = join(tmp2, "farstone");
    try {
      await buildFarstone(world2);
      const s2 = serve({ root: world2, dimension: "farstone", startRoom: START, autostart: false });
      await connect(s2, "Alice");
      await connect(s2, "Bob");
      await send(s2, "Alice", "look");
      await send(s2, "Bob", "look");
      await drainOnce(s2);
      await send(s2, "Alice", "s");
      await send(s2, "Bob", "n");
      const cycle2 = await drainOnce(s2);
      assert.deepEqual(cycle2.drained.map((d) => d.session), [slugify("Alice"), slugify("Bob")]);
      assert.equal(await locationOf(world2, slugify("Alice")), "farston-harbor");
      assert.equal(await locationOf(world2, slugify("Bob")), "downtown-farston");
    } finally {
      rmSync(tmp2, { recursive: true, force: true });
    }
  });

  // --- (e) crash-recovery: stop, re-serve on the same root, the tick continues from disk -------
  await ok("crash-recovery: re-serve on the same root continues the tick + resumes players", async () => {
    // current tick before the crash.
    const tickRows = (await rowsFor(world, "farstone")).filter((r) => r.e === "farstone" && r.a === "tick");
    const before = Math.max(0, ...tickRows.map((r) => Number(r.v)));
    server.stop();

    // a NEW daemon on the SAME disk world (nothing carried in memory across the "crash").
    server = serve({ root: world, dimension: "farstone", startRoom: START, autostart: false });
    // resume an existing player: connect does NOT recreate it (same location on disk).
    const aLocBefore = await locationOf(world, slugify("Alice"));
    await connect(server, "Alice");
    assert.equal(await locationOf(world, slugify("Alice")), aLocBefore, "alice resumed, not reset");

    const cycle = await drainOnce(server); // one cycle on the recovered daemon
    assert.equal(cycle.tick, before + 1, "the tick continued from disk (no reset to 0)");
    const after = Number((await rowsFor(world, "farstone"))
      .filter((r) => r.e === "farstone" && r.a === "tick")
      .reduce((m, r) => (Number(r.v) > m ? Number(r.v) : m), 0));
    assert.equal(after, before + 1, "the durable tick advanced by exactly one");
  });

  // --- bonus: a quit command unbinds the session ----------------------------------------------
  await ok("quit: a session that quits is unbound (and told goodbye)", async () => {
    await connect(server, "Carol");
    await send(server, "Carol", "quit");
    const cycle = await drainOnce(server);
    const rec = cycle.drained.find((d) => d.session === slugify("Carol"));
    assert.equal(rec.out, "Bye.");
    assert.ok(!server.sessions.has(slugify("Carol")), "carol is unbound after quit");
  });

  console.log(`\n${pass} server checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
