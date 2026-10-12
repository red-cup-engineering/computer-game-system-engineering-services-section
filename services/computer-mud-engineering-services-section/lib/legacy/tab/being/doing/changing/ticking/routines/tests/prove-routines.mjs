// prove-routines — ROUTINES: NPCs keep a daily schedule, so the world gets a rhythm. Builds a tiny
// map by hand in a UNIQUE /tmp dir (no Farstone, no examples), wires a few areas with `exit-*` cells
// both ways, posts an NPC's sparse `routine:<hour>` schedule, and drives the routine morphisms
// directly — asserting: the schedule reads back; the cyclic active-hour lookup (greatest hour ≤ now,
// wrapping past midnight to the last posting); one deterministic BFS hop toward the active
// destination; an NPC already AT its destination is not moved; an NPC with NO routine is untouched.
// The hour is set explicitly via the `hour?` param so the test is deterministic without real ticks.
//
// Same tiny harness as prove-comms.mjs. Standalone: run `node tests/prove-routines.mjs`.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import doing from "#doing";
import { locationOf } from "#substrate";

import tickRoutines, { scheduleOf, destinationFor, atDestination } from "../scripts/routine.mjs";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );

const tmp = mkdtempSync(join(tmpdir(), "tab-routines-"));
const world = join(tmp, "w");

const set = (e, a, v, t) => doing({ root: world, subject: e, predicate: a, object: v, t });

try {
  // A small map, four areas in a line, each `exit-*` wired BOTH ways:
  //   home-area <-w/e-> lane-area <-w/e-> square-area <-w/e-> market-area
  await set("home-area", "exit-east", "lane-area", "seed:000001");
  await set("lane-area", "exit-west", "home-area", "seed:000002");
  await set("lane-area", "exit-east", "square-area", "seed:000003");
  await set("square-area", "exit-west", "lane-area", "seed:000004");
  await set("square-area", "exit-east", "market-area", "seed:000005");
  await set("market-area", "exit-west", "square-area", "seed:000006");

  // The baker: a mover with a sparse schedule — market at 9, home at 18. Starts at home.
  await set("baker", "naming", "baker", "seed:000100");
  await set("baker", "mover", "tick", "seed:000101");
  await set("baker", "located-in", "home-area", "seed:000102");
  await set("baker", "routine:9", "market-area", "seed:000103");
  await set("baker", "routine:18", "home-area", "seed:000104");

  // A drifter: a mover with NO routine. Stands in the square; must never be moved by routines.
  await set("drifter", "naming", "drifter", "seed:000200");
  await set("drifter", "mover", "tick", "seed:000201");
  await set("drifter", "located-in", "square-area", "seed:000202");

  // --- scheduleOf: the sparse routine map reads back ---------------------------------------
  await ok("scheduleOf returns the NPC's sparse {hour → area} map", async () => {
    const sched = await scheduleOf(world, "baker");
    assert.deepEqual(sched, { 9: "market-area", 18: "home-area" });
    assert.deepEqual(await scheduleOf(world, "drifter"), {}, "no routine cells → empty map");
  });

  // --- destinationFor: the cyclic active-hour rule -----------------------------------------
  await ok("destinationFor resolves the active posting (greatest hour ≤ now)", async () => {
    assert.equal(await destinationFor(world, "baker", 9), "market-area", "at 9, the 9 posting");
    assert.equal(await destinationFor(world, "baker", 12), "market-area", "hour 12 → the 9 entry");
    assert.equal(await destinationFor(world, "baker", 18), "home-area", "at 18, the 18 posting");
    assert.equal(await destinationFor(world, "baker", 20), "home-area", "hour 20 → the 18 entry");
  });

  await ok("destinationFor wraps past midnight to the last posting of the day", async () => {
    assert.equal(await destinationFor(world, "baker", 2), "home-area", "hour 2 wraps to the 18 entry");
    assert.equal(await destinationFor(world, "baker", 0), "home-area", "midnight wraps to the 18 entry");
  });

  await ok("destinationFor is null for an NPC with no routine", async () => {
    assert.equal(await destinationFor(world, "drifter", 9), null);
  });

  // --- tickRoutines: one deterministic hop toward the active destination -------------------
  await ok("at hour 9 the baker steps one hop from home toward the market", async () => {
    assert.equal(await locationOf(world, "baker"), "home-area", "starts at home");
    const { moved } = await tickRoutines(world, "tick:000001", 9);
    const step = moved.find((m) => m.id === "baker");
    assert.ok(step, "the baker is in the moved log");
    assert.equal(step.toward, "market-area", "heading for the market");
    assert.equal(step.hop, "lane-area", "first hop on the shortest path home→…→market is lane-area");
    assert.equal(await locationOf(world, "baker"), "lane-area", "located-in advanced one hop");
  });

  await ok("a second tick advances the baker another hop along the path", async () => {
    const { moved } = await tickRoutines(world, "tick:000002", 9);
    assert.ok(moved.some((m) => m.id === "baker" && m.hop === "square-area"));
    assert.equal(await locationOf(world, "baker"), "square-area", "lane → square");
  });

  // --- already at destination: not moved ---------------------------------------------------
  await ok("an NPC already at its active destination is not moved", async () => {
    // Walk the baker the final hop, then tick again at hour 9 — it should stay put.
    await tickRoutines(world, "tick:000003", 9); // square → market
    assert.equal(await locationOf(world, "baker"), "market-area", "now at the market");
    assert.equal(await atDestination(world, "baker", 9), true, "atDestination is true");
    const { moved } = await tickRoutines(world, "tick:000004", 9);
    assert.ok(!moved.some((m) => m.id === "baker"), "no move when already at the destination");
    assert.equal(await locationOf(world, "baker"), "market-area", "unchanged");
  });

  // --- no routine: untouched ---------------------------------------------------------------
  await ok("an NPC with no routine is never moved by routines", async () => {
    assert.equal(await atDestination(world, "drifter", 9), false, "no destination → atDestination false");
    const { moved } = await tickRoutines(world, "tick:000005", 9);
    assert.ok(!moved.some((m) => m.id === "drifter"), "the drifter is never in the moved log");
    assert.equal(await locationOf(world, "drifter"), "square-area", "the drifter stays where it stood");
  });

  console.log(`\n${pass} routine checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
