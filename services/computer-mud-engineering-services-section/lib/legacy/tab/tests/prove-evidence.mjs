// prove-evidence — thick evidence (opt-in witnesses). A settled cell can carry the intra-action
// rows that justify each face (Curry–Howard: evidence is a term, the rows that prove it), with
// `aggregate` as the witness-combining join. The thin path stays byte-identical when witness is
// off. Same tiny harness as the other suites.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import being from "#being";
import { aggregate } from "#value";
import { rowId } from "#eavt-row";
import { settle } from "#substrate";
import buildFarstone from "./fixtures/build-fixture.mjs";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );

const tmp = mkdtempSync(join(tmpdir(), "tab-ev-"));
const world = join(tmp, "farstone");

try {
  await buildFarstone(world);

  await ok("witness off → output is byte-identical to the thin fold", async () => {
    const rows = [{ e: "x", a: "naming", v: "X", t: "t1" }];
    assert.deepEqual(being("x", rows), being("x", rows, { witness: false }));
    assert.equal(being("x", rows).fiber[0].witness, undefined);
  });

  await ok("witness on → a cell carries the rowId that justifies it", async () => {
    const r = { e: "x", a: "naming", v: "X", t: "t1" };
    const cell = being("x", [r], { witness: true }).fiber[0];
    assert.deepEqual(cell.witness.pos, [rowId(r)]);
    assert.deepEqual(cell.witness.neg, []);
  });

  await ok("a contested ⊤ cell carries witnesses on BOTH faces", async () => {
    const rows = [
      { e: "within-window", a: "has-converse", v: "overdue", t: "t0" },
      { e: "p", a: "within-window", v: "permit", t: "t1" },
      { e: "p", a: "overdue", v: "permit", t: "t2" },
    ];
    const cell = being("p", rows, { witness: true }).fiber.find((c) => c.predicate === "within-window");
    assert.equal(cell.value.glyph, "⊤");
    assert.equal(cell.witness.pos.length, 1, "positive face witnessed");
    assert.equal(cell.witness.neg.length, 1, "negative (converse) face witnessed");
    assert.notEqual(cell.witness.pos[0], cell.witness.neg[0]);
  });

  await ok("aggregate is a content-addressed union (the witness-combining join)", async () => {
    assert.deepEqual(aggregate(["a", "b"], ["b", "c"]), ["a", "b", "c"]);
    assert.deepEqual(aggregate([], ["a"]), ["a"]);
  });

  await ok("settle threads witness through to disk-backed beings", async () => {
    const bell = await settle(world, "a-brass-bell", { witness: true });
    const named = bell.fiber.find((c) => c.predicate === "naming");
    assert.ok(named.witness.pos.length >= 1, "the naming cell is witnessed by its row");
    // and the thin read still omits it
    const thin = await settle(world, "a-brass-bell");
    assert.equal(thin.fiber.find((c) => c.predicate === "naming").witness, undefined);
  });

  console.log(`\n${pass} evidence checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
