// run-spine-tests — the thin spine, end to end. Builds Farstone into a temp dir, then checks:
// the EAVT row algebra, dual filing, the bilattice fold (incl. ⊤), retraction, observing/look,
// the Umwelt projection, the self-running tick (incl. the autonomous ⊤), functional
// supersession, and crash-recovery determinism. No framework; node:assert + a tiny counter.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { rowId, assertRow, dedupe } from "#eavt-row";
import being from "#being";
import doing, { retract } from "#doing";
import { look } from "#observing";
import observing from "#observing";
import ticking from "#ticking";
import { settle, containedBy, locationOf, allRows } from "#substrate";
import buildFarstone from "./fixtures/build-fixture.mjs";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );

const tmp = mkdtempSync(join(tmpdir(), "tab-"));
const world = join(tmp, "farstone");

try {
  await buildFarstone(world);

  // --- EAVT row algebra ---------------------------------------------------------------
  await ok("rowId is canonical & stable", async () => {
    const a = { e: "x", a: "naming", v: "X", t: "t1" };
    const b = { t: "t1", v: "X", a: "naming", e: "x" }; // same row, keys reordered
    assert.equal(rowId(a), rowId(b));
  });
  await ok("assertRow rejects non-EAVT rows", async () => {
    assert.throws(() => assertRow({ e: "x", a: "y", v: 1 }), TypeError); // missing t
    assert.throws(() => assertRow({ e: "x", a: "y", v: 1, t: "t", extra: 1 }), TypeError);
  });
  await ok("dedupe is a content-addressed G-Set", async () => {
    const r = { e: "x", a: "naming", v: "X", t: "t1" };
    assert.equal(dedupe([r, { ...r }, r]).length, 1);
  });

  // --- being folds the bilattice; converse → ⊤ ----------------------------------------
  await ok("being folds rows to a settled fiber", async () => {
    const thing = being("x", [{ e: "x", a: "naming", v: "X", t: "t1" }]);
    assert.equal(thing.entity, "x");
    assert.equal(thing.fiber[0].value.glyph, "t");
  });
  await ok("a cell and its converse settle to ⊤", async () => {
    const rows = [
      { e: "within-window", a: "has-converse", v: "overdue", t: "t0" },
      { e: "p", a: "within-window", v: "permit", t: "t1" },
      { e: "p", a: "overdue", v: "permit", t: "t2" },
    ];
    const cell = being("p", rows).fiber.find((c) => c.predicate === "within-window");
    assert.equal(cell.value.glyph, "⊤");
  });

  // --- dual filing makes relational reads local --------------------------------------
  await ok("dual filing: containedBy reads the place's own log", async () => {
    const here = await containedBy(world, "harbor-district");
    assert.ok(here.includes("a-brass-bell"), "bell should be in the harbor district");
    assert.ok(here.includes("takeshi-aoki"), "harbormaster should be in the harbor district");
  });
  await ok("locationOf reads an entity's latest place", async () => {
    assert.equal(await locationOf(world, "a-clam-rake"), "the-marsh");
  });

  // --- doing / retraction (append-only) ----------------------------------------------
  await ok("retraction drops a cell without mutating history", async () => {
    await doing({ root: world, subject: "a-trail-map", predicate: "marked", object: "summit-route", t: "play:1" });
    let map = await settle(world, "a-trail-map");
    assert.ok(map.fiber.some((c) => c.predicate === "marked"));
    await retract({ root: world, subject: "a-trail-map", predicate: "marked", t: "play:2" });
    map = await settle(world, "a-trail-map");
    assert.ok(!map.fiber.some((c) => c.predicate === "marked"), "marked should be retracted");
  });

  // --- observing: look + the Umwelt projection ---------------------------------------
  await ok("look reads name, exits, and contents of a place", async () => {
    const l = await look({ root: world, observer: "you", subject: "harbor-district" });
    assert.equal(l.name, "The Harbor District");
    assert.equal(l.exits.south, "farston-harbor");
    assert.ok(l.contents.includes("a-brass-bell"));
  });
  await ok("observing projects to the observer's Umwelt", async () => {
    // `you` perceives naming/describing/ringing/phase/status — not `kind`.
    const { thing } = await observing({ root: world, observer: "you", subject: "farston-harbor" });
    const preds = new Set(thing.fiber.map((c) => c.predicate));
    assert.ok(preds.has("naming"), "should perceive naming");
    assert.ok(!preds.has("kind"), "should NOT perceive kind (outside its Umwelt)");
  });

  // --- the self-running world ---------------------------------------------------------
  await ok("31 ticks: the world files an autonomous ⊤ on the permit", async () => {
    for (let i = 0; i < 31; i += 1) await ticking({ root: world });
    const permit = await settle(world, "permit-23");
    const cell = permit.fiber.find((c) => c.predicate === "within-window");
    assert.equal(cell.value.glyph, "⊤", "permit should be contradictory past its window");
  });
  await ok("functional supersession: the clock has ONE tick value", async () => {
    const dim = await settle(world, "farstone");
    const ticks = dim.fiber.filter((c) => c.predicate === "tick");
    assert.equal(ticks.length, 1, "only the latest tick survives");
    assert.equal(ticks[0].object, 31);
  });

  // --- crash recovery is determinism over the log ------------------------------------
  await ok("replay is deterministic (rebuild → identical content-addresses)", async () => {
    const a = join(tmp, "a");
    const b = join(tmp, "b");
    await buildFarstone(a);
    await buildFarstone(b);
    const ids = (rows) => dedupe(rows).map(rowId).sort();
    assert.deepEqual(ids(await allRows(a)), ids(await allRows(b)));
  });

  console.log(`\n${pass} checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
