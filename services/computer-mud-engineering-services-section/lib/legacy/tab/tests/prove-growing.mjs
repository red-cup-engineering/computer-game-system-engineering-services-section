// prove-growing — the `growing` morphism: the Fibonacci-word quasicrystal laid as a walkable
// spiral, replay-determinism, and the fold-to-atom tower step. Builds worlds into UNIQUE temp
// dirs and drives grow/fold directly. Same tiny harness as prove-interaction.mjs.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { dedupe, rowId } from "#eavt-row";
import doing, { declareConverse } from "#doing";
import { look } from "#observing";
import { settle, allRows } from "#substrate";

import grow, { fold, fibonacciWord, PHI } from "../being/doing/changing/ticking/growing/scripts/grow.mjs";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );

const tmp = mkdtempSync(join(tmpdir(), "tab-grow-"));
const freshWorld = (tag) => join(tmp, `w-${tag}-${Math.random().toString(36).slice(2)}`);

try {
  // (a) fibonacciWord lengths are the Fibonacci numbers, and long/short → φ as n grows. -------
  await ok("fibonacciWord(n) lengths are Fibonacci; longCount/shortCount → φ", async () => {
    // |σ^n(a)| = F(n+2): 1,2,3,5,8,13,21,34,55,89,...
    const fib = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];
    for (let n = 0; n < fib.length; n += 1) {
      assert.equal(fibonacciWord(n).length, fib[n], `|σ^${n}(a)| should be ${fib[n]}`);
    }
    // ratio of longs (a) to shorts (b) approaches φ.
    const w = fibonacciWord(18);
    const longs = [...w].filter((c) => c === "a").length;
    const shorts = w.length - longs;
    assert.ok(Math.abs(longs / shorts - PHI) < 1e-3, `long/short ${longs / shorts} should approach φ ${PHI}`);
  });

  // grow returns the summary, with ratio approaching φ. ----------------------------------------
  await ok("grow lays the word and reports counts + goldenAngleDeg", async () => {
    const world = freshWorld("summary");
    const r = await grow({ root: world, generations: 10 });
    assert.equal(r.word, fibonacciWord(10));
    assert.equal(r.longCount + r.shortCount, r.word.length);
    assert.equal(r.atoms.length, r.word.length);
    assert.ok(Math.abs(r.ratio - PHI) < 1e-2, "ratio approaches φ");
    assert.ok(Math.abs(r.goldenAngleDeg - 137.5078) < 1e-2, "golden angle ≈ 137.5078°");
  });

  // (b) grow is replay-deterministic: two fresh dirs produce byte-identical row-sets. ----------
  await ok("grow is replay-deterministic (identical row-id sets in two dirs)", async () => {
    const a = freshWorld("det-a");
    const b = freshWorld("det-b");
    await grow({ root: a, generations: 8 });
    await grow({ root: b, generations: 8 });
    const idsA = dedupe(await allRows(a)).map(rowId).sort();
    const idsB = dedupe(await allRows(b)).map(rowId).sort();
    assert.deepEqual(idsA, idsB, "two grown worlds must have identical content-addressed rows");
    assert.ok(idsA.length > 0);
  });

  // (c) generated rooms are walkable: look() shows exit-east / exit-west. ----------------------
  await ok("grown rooms are walkable (look shows exit-east / exit-west)", async () => {
    const world = freshWorld("walk");
    await grow({ root: world, generations: 6 });
    // room 2 (grow-room-2) is interior, so it has BOTH a west and an east exit.
    const mid = await look({ root: world, observer: "walker", subject: "grow-room-2" });
    assert.equal(mid.exits.east, "grow-room-3", "exit-east → successor");
    assert.equal(mid.exits.west, "grow-room-1", "exit-west → predecessor");
    // The first room has only an east exit; the last only a west exit.
    const first = await look({ root: world, observer: "walker", subject: "grow-room-1" });
    assert.equal(first.exits.east, "grow-room-2");
    assert.equal(first.exits.west, undefined, "first room has no predecessor");
  });

  // (d) fold promotes a CLOSED entity (settled-as appears) and NOT a ⊤-carrying one. -----------
  await ok("fold promotes a closed room and refuses a ⊤-carrying entity", async () => {
    const world = freshWorld("fold");
    await grow({ root: world, generations: 5 });

    // Plant a contested (⊤) entity: a predicate AND its declared converse both asserted on it.
    await declareConverse(world, "contested-one", "within-window", "overdue", "seed:000001");
    await doing({ root: world, subject: "contested-one", predicate: "within-window", object: "permit", t: "seed:000002" });
    await doing({ root: world, subject: "contested-one", predicate: "overdue", object: "permit", t: "seed:000003" });
    // Sanity: it really carries a ⊤ cell.
    const contested = await settle(world, "contested-one");
    assert.ok(contested.fiber.some((c) => c.value.glyph === "⊤"), "contested-one should hold a ⊤ cell");

    const { promoted } = await fold({ root: world });
    const byFrom = new Map(promoted.map((p) => [p.from, p.atom]));

    // A grown room is closed (all cells t) → promoted.
    assert.ok(byFrom.has("grow-room-1"), "a closed grown room should be promoted to an atom");
    // The contested entity carries ⊤ → NOT promoted.
    assert.ok(!byFrom.has("contested-one"), "a ⊤-carrying entity must NOT be promoted");

    // The settled-as row and the atom row are on disk.
    const room = await settle(world, "grow-room-1");
    const settledAs = room.fiber.find((c) => c.predicate === "settled-as");
    assert.ok(settledAs, "settled-as cell appears on the closed room");
    const atomThing = await settle(world, settledAs.object);
    assert.ok(
      atomThing.fiber.some((c) => c.predicate === "is-atom-at-level" && c.object === 1),
      "the minted atom is at level 1",
    );
    // contested-one has NO settled-as cell.
    assert.ok(
      !contested.fiber.some((c) => c.predicate === "settled-as"),
      "contested-one must carry no settled-as cell",
    );
  });

  console.log(`\n${pass} growing checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
