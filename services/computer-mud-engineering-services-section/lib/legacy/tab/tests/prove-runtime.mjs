// prove-runtime — THE INVARIANT TEST for the in-memory materialized view (EPIC A runtime core).
//
// The runtime is DERIVED, never authoritative: the on-disk EAVT logs are the source of truth.
// Its one job is REPLAY-EQUIVALENCE — for every subject, `runtime.settle(e)` must deepEqual the
// substrate reference `await settle(root, e)`, and `containedBy`/`locationOf` must match too,
// both at load AND after incremental `apply` of newly-appended rows. Plus determinism, plus a
// bench proving the in-memory view is at least as fast as re-reading the world from disk.
//
// Same tiny harness as prove-interaction.mjs. Builds Farstone into a UNIQUE /tmp dir.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { settle, locationOf, containedBy, subjects } from "#substrate";
import doing from "#doing";
import changing from "#changing";
import buildFarstone from "./fixtures/build-fixture.mjs";
import { loadRuntime, restore } from "../scripts/_runtime.mjs";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.stack || e.message}`); process.exitCode = 1; },
  );

const tmp = mkdtempSync(join(tmpdir(), "tab-runtime-"));
const world = join(tmp, "farstone");

// applyDoing — drive a real append AND keep the runtime live, mirroring EXACTLY what landed on
// disk: the base row always, plus the reified (rowId,'enacted-by',agent) row when an agent is
// given (the substrate/doing writes both). This is the apply(row) wiring contract for doing/tick.
async function applyDoing(rt, args, fn = doing) {
  const { row, id } = await fn(args);
  rt.apply(row);
  // The reified attribution is filed (by the substrate) under the BASE subject's log, so we
  // anchor it there explicitly — the documented apply(reifiedRow, baseSubject) contract.
  if (args.agent !== undefined) rt.apply({ e: id, a: "enacted-by", v: args.agent, t: args.t }, args.subject);
  return { row, id };
}

try {
  await buildFarstone(world);

  // (a) INVARIANT: every subject settles identically to the substrate reference. -------------
  await ok("(a) runtime.settle deepEquals substrate.settle for EVERY subject", async () => {
    const rt = await loadRuntime(world);
    const subs = await subjects(world);
    assert.ok(subs.length > 0, "world should have subjects");
    // runtime.subjects() must agree with the substrate's subject set.
    assert.deepEqual(rt.subjects(), subs);
    for (const e of subs) {
      const ref = await settle(world, e);
      assert.deepEqual(rt.settle(e), ref, `settle mismatch for ${e}`);
    }
  });

  // (a') INVARIANT under non-default opts: observer frontier + witness must also match. ------
  await ok("(a') runtime.settle matches substrate under observer/witness/functional opts", async () => {
    const rt = await loadRuntime(world);
    for (const e of await subjects(world)) {
      assert.deepEqual(rt.settle(e, { witness: true }), await settle(world, e, { witness: true }),
        `witness settle mismatch for ${e}`);
      assert.deepEqual(rt.settle(e, { observer: "you" }), await settle(world, e, { observer: "you" }),
        `observer settle mismatch for ${e}`);
    }
  });

  // (b) location reads match the substrate for several entities. ------------------------------
  await ok("(b) runtime.containedBy / locationOf match substrate", async () => {
    const rt = await loadRuntime(world);
    for (const e of await subjects(world)) {
      assert.equal(rt.locationOf(e), await locationOf(world, e), `locationOf mismatch for ${e}`);
      assert.deepEqual(rt.containedBy(e), await containedBy(world, e), `containedBy mismatch for ${e}`);
    }
  });

  // (c) INCREMENTAL correctness: append NEW rows to disk AND runtime.apply, then re-verify. ---
  await ok("(c) after disk appends + runtime.apply, settle/location STILL match substrate", async () => {
    const rt = await loadRuntime(world);
    let t = 0;
    // `tick:` sorts AFTER `seed:` lexically (the substrate orders t as strings), so these moves
    // actually supersede the seeded state — exercising functional supersession through apply.
    const stamp = () => `tick:${String(++t).padStart(6, "0")}`;

    // A player perceives (attributed cut), a functional change (move), a relational re-file,
    // and a plain doing — exercising dual-filing + reification + supersession through apply.
    await applyDoing(rt, { root: world, subject: "you", predicate: "kind", object: "player", t: stamp() });
    await applyDoing(rt, { root: world, agent: "you", subject: "a-clam-rake", predicate: "naming", object: "a clam rake", t: stamp() });
    await applyDoing(rt, { root: world, subject: "you", predicate: "located-in", object: "the-marsh", t: stamp() }, changing);
    await applyDoing(rt, { root: world, subject: "you", predicate: "located-in", object: "farston-harbor", t: stamp() }, changing);
    await applyDoing(rt, { root: world, agent: "you", subject: "a-coil-of-net", predicate: "located-in", object: "you", t: stamp() }, changing);

    for (const e of await subjects(world)) {
      assert.deepEqual(rt.settle(e), await settle(world, e), `post-apply settle mismatch for ${e}`);
      assert.equal(rt.locationOf(e), await locationOf(world, e), `post-apply locationOf mismatch for ${e}`);
      assert.deepEqual(rt.containedBy(e), await containedBy(world, e), `post-apply containedBy mismatch for ${e}`);
    }
    // Spot-check the moved entity and the dual-filed relations landed right.
    assert.equal(rt.locationOf("you"), "farston-harbor");
    assert.ok(rt.containedBy("you").includes("a-coil-of-net"));
    assert.ok(rt.containedBy("farston-harbor").includes("you"));
  });

  // (c') refresh() absorbs out-of-band disk appends a runtime did NOT apply. -------------------
  await ok("(c') refresh() resyncs rows appended out-of-band (no apply)", async () => {
    const rt = await loadRuntime(world);
    const before = rt.locationOf("you");
    // append straight to disk; do NOT call apply — the runtime is stale until refresh. `tick:`
    // sorts after `seed:`/the prior `tick:` moves, so this becomes the latest located-in.
    await changing({ root: world, subject: "you", predicate: "located-in", object: "the-marsh", t: "tick:990001" });
    assert.equal(rt.locationOf("you"), before, "stale until refresh");
    const absorbed = await rt.refresh();
    assert.ok(absorbed >= 1, "refresh should absorb the new row");
    assert.equal(rt.locationOf("you"), "the-marsh");
    assert.equal(rt.locationOf("you"), await locationOf(world, "you"));
    assert.deepEqual(rt.settle("you"), await settle(world, "you"));
  });

  // (d) DETERMINISM: two runtimes from the same world produce identical settles. ---------------
  await ok("(d) two runtimes from the same world settle identically (and == snapshot/restore)", async () => {
    const a = await loadRuntime(world);
    const b = await loadRuntime(world);
    const c = restore(a.snapshot());
    for (const e of await subjects(world)) {
      assert.deepEqual(a.settle(e), b.settle(e), `nondeterministic settle for ${e}`);
      assert.deepEqual(a.settle(e), c.settle(e), `snapshot/restore settle drift for ${e}`);
      assert.deepEqual(a.containedBy(e), c.containedBy(e), `snapshot/restore containedBy drift for ${e}`);
    }
  });

  // (e) BENCH: runtime.settle vs substrate.settle across all entities. ------------------------
  await ok("(e) bench: runtime settle is at least as fast as substrate settle", async () => {
    const rt = await loadRuntime(world);
    const subs = await subjects(world);
    const ROUNDS = 50;

    // warm the runtime cache once (the realistic steady state), then time cached reads.
    for (const e of subs) rt.settle(e);

    const t0 = process.hrtime.bigint();
    for (let i = 0; i < ROUNDS; i++) for (const e of subs) rt.settle(e);
    const t1 = process.hrtime.bigint();

    const s0 = process.hrtime.bigint();
    for (let i = 0; i < ROUNDS; i++) for (const e of subs) await settle(world, e);
    const s1 = process.hrtime.bigint();

    const rtMs = Number(t1 - t0) / 1e6;
    const subMs = Number(s1 - s0) / 1e6;
    const calls = ROUNDS * subs.length;
    console.log(`        bench: ${calls} settles over ${subs.length} subjects x ${ROUNDS} rounds`);
    console.log(`        runtime  : ${rtMs.toFixed(2)} ms  (${(rtMs / calls * 1000).toFixed(2)} us/call)`);
    console.log(`        substrate: ${subMs.toFixed(2)} ms  (${(subMs / calls * 1000).toFixed(2)} us/call)`);
    console.log(`        speedup  : ${(subMs / rtMs).toFixed(1)}x`);
    assert.ok(rtMs <= subMs, `runtime (${rtMs.toFixed(2)}ms) should be <= substrate (${subMs.toFixed(2)}ms)`);
  });

  console.log(`\n${pass} runtime checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
