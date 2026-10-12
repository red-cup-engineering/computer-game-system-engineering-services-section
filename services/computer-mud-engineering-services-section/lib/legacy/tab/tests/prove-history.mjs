// prove-history — history() (the geometric record, finite-voidmath F8), bypassRelation (the
// bypass declarations collected from the trace, mirroring has-converse), and historyOf (the
// substrate read). Builds Farstone into a UNIQUE temp dir, drives `doing` onto fresh entities
// with predicate/object names whose SORTED fiber positions are known, declares `bypasses` rows
// (exactly as declareConverse files has-converse: a base row keyed at the predicate), and
// asserts the entangled pairs and their gaps. Same tiny harness as prove-interaction.mjs.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import doing from "#doing";
import { settle, rowsFor, append } from "#substrate";
import history, { bypassRelation, historyOf } from "../being/history/scripts/history.mjs";
import buildFarstone from "./fixtures/build-fixture.mjs";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );

const tmp = mkdtempSync(join(tmpdir(), "tab-hist-"));
const world = join(tmp, "farstone");

// A cell named (predicate, "x"). The fiber sorts by `predicate+" "+object`, so with object "x"
// everywhere the order is alphabetical on predicate.
const say = (subject, predicate, t) => doing({ root: world, subject, predicate, object: "x", t });

// declareBypass — file a (P bypasses Q) declaration on `subject`'s log as a conformant base row
// {e:P, a:"bypasses", v:Q}. Mirrors declareConverse, which files {e:p,a:"has-converse",v:q}; the
// orientation lives at the predicate, so e=P (not the subject). bypassRelation reads it back.
const declareBypass = (subject, p, q, t) => append(world, subject, { e: p, a: "bypasses", v: q, t });

try {
  await buildFarstone(world);

  // glass-orb: four non-functional cells. Sorted fiber: alpha x (0), beta x (1), delta x (2),
  // gamma x (3). Declare alpha bypasses gamma (indices 0 and 3 → non-adjacent, gap 3).
  await say("glass-orb", "alpha", "seed:700001");
  await say("glass-orb", "beta", "seed:700002");
  await say("glass-orb", "delta", "seed:700003");
  await say("glass-orb", "gamma", "seed:700004");
  await declareBypass("glass-orb", "alpha", "gamma", "seed:700005");

  await ok("bypassRelation collects {a:'bypasses'} rows into P -> {Q...} (asymmetric)", async () => {
    const bypass = bypassRelation(await rowsFor(world, "glass-orb"));
    assert.ok(bypass.get("alpha")?.has("gamma"), "alpha bypasses gamma");
    assert.equal(bypass.get("gamma"), undefined, "asymmetric: gamma does not bypass alpha");
  });

  await ok("history(thing, bypass) emits the non-adjacent entangled pair with gap = j - i", async () => {
    const thing = await settle(world, "glass-orb");
    const preds = thing.fiber.map((c) => c.predicate);
    assert.deepEqual(preds, ["alpha", "beta", "delta", "gamma"], "fiber order is deterministic");
    const bypass = bypassRelation(await rowsFor(world, "glass-orb"));
    const h = history(thing, bypass);
    assert.equal(h.entity, "glass-orb");
    assert.equal(h.entangled.length, 1, "exactly one entangled pair");
    const pair = h.entangled[0];
    assert.equal(pair.a.predicate, "alpha");
    assert.equal(pair.b.predicate, "gamma");
    assert.equal(pair.gap, 3, "alpha(0)⋯gamma(3) has gap 3");
  });

  await ok("historyOf settles + reads bypass off the same trace and returns the pair", async () => {
    const h = await historyOf(world, "glass-orb");
    assert.equal(h.entangled.length, 1);
    assert.equal(h.entangled[0].gap, 3, "historyOf yields the alpha⋯gamma pair at gap 3");
  });

  await ok("a world entity with NO bypasses rows yields zero entangled pairs", async () => {
    await say("plain-stone", "alpha", "seed:710001");
    await say("plain-stone", "gamma", "seed:710002");
    const h = await historyOf(world, "plain-stone");
    assert.equal(h.entangled.length, 0, "nothing composed ⇒ no geometric history");
  });

  await ok("an ADJACENT bypass pair (gap 1) is NOT entangled", async () => {
    // alpha(0) and beta(1) are adjacent. Declaring alpha bypasses beta must yield nothing.
    await say("near-twin", "alpha", "seed:720001");
    await say("near-twin", "beta", "seed:720002");
    await declareBypass("near-twin", "alpha", "beta", "seed:720003");
    const h = await historyOf(world, "near-twin");
    assert.equal(h.entangled.length, 0, "gap 1 is adjacency, not entanglement (Thing F8.1)");
  });

  console.log(`\n${pass} history checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
