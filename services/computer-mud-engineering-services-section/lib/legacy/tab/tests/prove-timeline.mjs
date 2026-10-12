// prove-timeline — the EPIC-H first slice: timeline ops (fork/diff/replay), the story log, and
// the entity inspector. Builds Farstone into a UNIQUE temp dir, advances it, files a few doings
// (a ⊤ cell via a cell + its converse; an injury → death), then proves the superpowers the
// append-only / content-addressed substrate uniquely enables. Same tiny harness as
// tests/prove-interaction.mjs. Run: node tests/prove-timeline.mjs

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import doing, { declareConverse } from "#doing";
import { injure } from "#health";
import ticking from "#ticking";
import buildFarstone from "./fixtures/build-fixture.mjs";

import { fork, diff, replayInto } from "../scripts/timeline.mjs";
import inspect from "../scripts/inspect.mjs";
import storylog from "../being/doing/observing/storylog/scripts/storylog.mjs";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );

const tmp = mkdtempSync(join(tmpdir(), "tab-timeline-"));
const world = join(tmp, "farstone");
const branch = join(tmp, "branch");

try {
  await buildFarstone(world);

  // Advance the world a couple of ticks so there's real motion in the trace.
  await ticking({ root: world });
  await ticking({ root: world });

  // Create a ⊤ cell: a fresh entity holding a predication AND its declared converse.
  await doing({ root: world, subject: "dispute-1", predicate: "kind", object: "matter", t: "seed:800001" });
  await declareConverse(world, "dispute-1", "settled", "contested", "seed:800002");
  await doing({ root: world, subject: "dispute-1", predicate: "settled", object: "the-claim", t: "seed:800003" });
  await doing({ root: world, subject: "dispute-1", predicate: "contested", object: "the-claim", t: "seed:800004" });

  // An injury → death: a mortal torso wound drives alive:false (severity 10 destroys a vital part).
  await doing({ root: world, subject: "victim-1", predicate: "kind", object: "npc", t: "seed:810001" });
  await injure({ root: world, subject: "victim-1", part: "torso", severity: 10, t: "seed:810002" });

  // --- (a) fork produces an IDENTICAL world: diff shows 0 onlyA/onlyB -------------------------
  await ok("fork → diff shows an identical world (onlyA=onlyB=0, shared>0)", async () => {
    await fork(world, branch);
    const d = await diff(world, branch);
    assert.equal(d.onlyA.length, 0, "nothing only in the source");
    assert.equal(d.onlyB.length, 0, "nothing only in the fork");
    assert.ok(d.shared > 0, "the two share their content-addressed rows");
  });

  // --- (b) a NEW doing on the fork: diff shows EXACTLY that row in onlyB ----------------------
  await ok("after a new doing on the fork, diff shows exactly that row in onlyB", async () => {
    const { id } = await doing({ root: branch, subject: "you", predicate: "carrying", object: "a-storm-lantern", t: "seed:820001" });
    const d = await diff(world, branch);
    assert.equal(d.onlyA.length, 0, "the source did not change");
    assert.deepEqual(d.onlyB, [id], "exactly the one new row diverges on the fork");
  });

  // --- (c) storylog surfaces the ⊤-flip event, ranks it, and is deterministic -----------------
  await ok("storylog surfaces the ⊤-flip, ranks it highest, and is deterministic", async () => {
    const log = await storylog(world);
    const top = log.filter((e) => e.kind === "top");
    assert.ok(top.some((e) => e.entity === "dispute-1"), "the ⊤ dispute is in the story log");
    // Ranked: the ⊤ flip outranks any change event present.
    const changes = log.filter((e) => e.kind === "change");
    if (changes.length) {
      assert.ok(top[0].weight > changes[0].weight, "⊤ flips outrank functional changes");
    }
    // Deterministic: same world → byte-identical list.
    const again = await storylog(world);
    assert.deepEqual(again, log, "storylog is deterministic");
    // It also surfaces the death.
    assert.ok(log.some((e) => e.kind === "death" && e.entity === "victim-1"), "the death is surfaced");
  });

  // --- (d) inspect returns the entity's settled fiber + history -------------------------------
  await ok("inspect returns a settled fiber (with witnesses) + history for the ⊤ entity", async () => {
    const out = await inspect(world, "dispute-1");
    assert.equal(out.settled.entity, "dispute-1");
    const cell = out.settled.fiber.find((c) => c.predicate === "settled" && c.object === "the-claim");
    assert.ok(cell, "the settled/contested cell is present");
    assert.equal(cell.value.glyph, "⊤", "it settled to ⊤ (held both ways)");
    assert.ok(cell.witness && cell.witness.pos.length >= 1 && cell.witness.neg.length >= 1,
      "the cell carries thick evidence on both faces");
    assert.ok(Array.isArray(out.history.entangled), "history returns entangled pairs (possibly empty)");
    assert.ok(out.witnesses.some((w) => w.predicate === "settled"), "the flat witness index is populated");
  });

  // --- replayInto: merging the fork back is a conflict-free union (the new row admitted once) --
  await ok("replayInto merges the fork back conflict-free (idempotent G-Set union)", async () => {
    const first = await replayInto(branch, world);
    assert.ok(first.added >= 1, "the fork's new row is admitted");
    const d = await diff(world, branch);
    assert.equal(d.onlyB.length, 0, "after replay nothing is only on the fork");
    const second = await replayInto(branch, world); // idempotent
    assert.equal(second.added, 0, "a second replay adds nothing (G-Set idempotence)");
  });

  console.log(`\n${pass} timeline checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
