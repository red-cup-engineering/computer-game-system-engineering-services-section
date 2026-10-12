// prove-progression — the PROGRESSION layer: mood as CLOSURE DISTANCE, skills as predicates held
// at a degree, and ADVANCEMENT as a settlement threshold (the tower-fold for an actor). Builds
// Farstone into a UNIQUE temp dir and drives the new morphisms directly. Same tiny harness as
// prove-interaction.mjs. New modules are imported by RELATIVE path (aliases not yet wired); the
// existing #aliases are fine.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import being from "#being";
import { settle } from "#substrate";
import { holds, isTop } from "#value";
import buildFarstone from "./fixtures/build-fixture.mjs";

import closure, { closureOf } from "../being/library/value/library/closure/scripts/closure.mjs";
import practice, { skillPredicate } from "../being/doing/practicing/scripts/practice.mjs";
import advance from "../being/doing/changing/ticking/growing/advancing/scripts/advance.mjs";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );

const cellFor = (thing, predicate) => thing.fiber.find((c) => c.predicate === predicate);

const tmp = mkdtempSync(join(tmpdir(), "tab-prog-"));
const world = join(tmp, "farstone");

try {
  await buildFarstone(world);

  // --- (a) closure distance: 0 iff every cell determined and non-⊤ ---------------------------
  await ok("closure: distance 0 iff every cell determined and non-⊤; fraction in [0,1]", async () => {
    // All determined, none ⊤ → distance 0, closed, fraction 1.
    const allT = being("x", [
      { e: "x", a: "p", v: "1", t: "t1" },
      { e: "x", a: "q", v: "2", t: "t2" },
    ]);
    const cA = closure(allT);
    assert.equal(cA.distance, 0);
    assert.equal(cA.open, 0);
    assert.equal(cA.contested, 0);
    assert.equal(cA.closed, true);
    assert.equal(cA.fraction, 1);

    // A ⊤ cell is determined but contested → distance counts it, NOT closed.
    const top = being("y", [
      { e: "p", a: "has-converse", v: "np", t: "t0" },
      { e: "y", a: "p", v: "v", t: "t1" },
      { e: "y", a: "np", v: "v", t: "t2" },
    ]);
    const cT = closure(top);
    assert.equal(cT.contested, 1);
    assert.equal(cT.distance, 1);
    assert.equal(cT.closed, false);
    assert.ok(cT.fraction > 0 && cT.fraction <= 1);

    // An empty fiber is not "closed".
    assert.equal(closure(being("z", [])).closed, false);
  });

  await ok("closureOf(root,subject) === closure(settle(root,subject))", async () => {
    const direct = closure(await settle(world, "a-brass-bell"));
    const via = await closureOf(world, "a-brass-bell");
    assert.deepEqual(via, direct);
  });

  // --- (b) practice success affirms the skill cell and raises closure.determined by one -------
  await ok("practice success → skill cell holds (t) and closure.determined +1", async () => {
    const actor = "deckhand-a";
    await being; // no-op keep import
    const before = closure(await settle(world, actor)); // no log yet → empty fiber
    await practice({ root: world, actor, skill: "rowing", outcome: "success", t: "practice-a" });
    const thing = await settle(world, actor);
    const cell = cellFor(thing, skillPredicate("rowing"));
    assert.ok(cell, "the skill cell exists");
    assert.equal(holds(cell.value), true, "success makes the skill cell hold (t)");
    assert.equal(cell.value.glyph, "t");
    const after = closure(thing);
    assert.equal(after.determined, before.determined + 1, "exactly one new determined cell");
  });

  // --- (c) fail then success on the same skill → ⊤ (contested); closure.contested +1 ----------
  await ok("practice fail then success on the same skill → ⊤ and closure.contested increments", async () => {
    const actor = "deckhand-b";
    await practice({ root: world, actor, skill: "knots", outcome: "success", t: "practice-bs" });
    const settledT = closure(await settle(world, actor));
    assert.equal(settledT.contested, 0, "a pure-success skill is not contested");

    await practice({ root: world, actor, skill: "knots", outcome: "fail", t: "practice-bf" });
    const thing = await settle(world, actor);
    const cell = cellFor(thing, skillPredicate("knots"));
    assert.ok(isTop(cell.value), "success + fail on one skill settle to ⊤");
    assert.equal(cell.value.glyph, "⊤");
    assert.equal(closure(thing).contested, settledT.contested + 1, "closure.contested increments");
  });

  // --- (d) advance gates on sub-fiber closure ------------------------------------------------
  await ok("advance: false while a required skill is ⊥, true exactly when the sub-fiber closes", async () => {
    const actor = "harbor-trainee";
    const office = "harbormaster";
    const requires = ["seamanship", "tides"];

    // Nothing practised → both required cells ⊥ → not advanced.
    const r0 = await advance({ root: world, actor, office, requires, t: "advance-0" });
    assert.equal(r0.advanced, false, "no skills yet → not advanced");

    // One required skill closed, the other still ⊥ → still not advanced.
    await practice({ root: world, actor, skill: "seamanship", outcome: "success", t: "practice-c1" });
    const r1 = await advance({ root: world, actor, office, requires, t: "advance-1" });
    assert.equal(r1.advanced, false, "one of two skills → not advanced");

    // A contested required skill (⊤) also blocks advancement.
    await practice({ root: world, actor, skill: "tides", outcome: "success", t: "practice-c2" });
    await practice({ root: world, actor, skill: "tides", outcome: "fail", t: "practice-c3" });
    const rContested = await advance({ root: world, actor, office, requires, t: "advance-2" });
    assert.equal(rContested.advanced, false, "a ⊤ required skill blocks advancement");

    // This actor cannot close `tides` (it is ⊤). Use a fresh actor to prove the closed → advance
    // path with a clean sub-fiber.
    const ok2 = "harbor-trainee-2";
    await practice({ root: world, actor: ok2, skill: "seamanship", outcome: "success", t: "practice-d1" });
    await practice({ root: world, actor: ok2, skill: "tides", outcome: "success", t: "practice-d2" });
    const r2 = await advance({ root: world, actor: ok2, office, requires, t: "advance-3" });
    assert.equal(r2.advanced, true, "both required skills closed → advanced");
    assert.ok(r2.atom, "advancement mints a vocabulary atom");

    // The office row is FUNCTIONAL and present on the actor's settled fiber.
    const settled = await settle(world, ok2);
    const officeCell = settled.fiber.find((c) => c.predicate === "office" && c.object === office);
    assert.ok(officeCell, "a functional office row is appended");
    assert.equal(holds(officeCell.value), true);
    // The minted atom is an atom at the next level (the office, not a number).
    const atom = await settle(world, r2.atom);
    const levelCell = atom.fiber.find((c) => c.predicate === "is-atom-at-level");
    assert.ok(levelCell, "the atom is-atom-at-level");
    assert.equal(levelCell.object, office, "level is the office name, never a number");
  });

  // --- (e) the SHARED path: npc and player advance to identical fiber shapes ------------------
  await ok("npc and player run the same practice→advance and get identical fiber shapes", async () => {
    const office = "lamplighter";
    const requires = ["lamps", "oil"];
    const drive = async (actor, mover) => {
      // The ONLY difference is `mover` (npc:tick vs player:session) — never the path.
      await being; // keep import referenced
      const { default: doing } = await import("#doing");
      await doing({ root: world, subject: actor, predicate: "kind", object: mover === "tick" ? "npc" : "player", t: `seed-${actor}-1` });
      await doing({ root: world, subject: actor, predicate: "mover", object: mover, t: `seed-${actor}-2` });
      await practice({ root: world, actor, skill: "lamps", outcome: "success", t: `pr-${actor}-1` });
      await practice({ root: world, actor, skill: "oil", outcome: "success", t: `pr-${actor}-2` });
      return advance({ root: world, actor, office, requires, t: `adv-${actor}` });
    };
    const rNpc = await drive("lamp-npc", "tick");
    const rPlayer = await drive("lamp-player", "session");
    assert.equal(rNpc.advanced, true);
    assert.equal(rPlayer.advanced, true);

    // Compare fiber SHAPE: the set of {predicate, object-presence, glyph} minus the identity-only
    // cells (entity name, kind, mover) which legitimately differ between an npc and a player.
    const shape = (thing) =>
      thing.fiber
        .filter((c) => !["kind", "mover", "naming"].includes(c.predicate) && !c.predicate.startsWith("settled-as") )
        .map((c) => `${c.predicate}|${c.object}|${c.value.glyph}`)
        .sort();
    const npc = await settle(world, "lamp-npc");
    const player = await settle(world, "lamp-player");
    // Normalize the atom object (atom-office-<office> is identical here) — same office, same atom.
    assert.deepEqual(shape(npc), shape(player), "the shared path yields identical fiber shapes");
  });

  console.log(`\n${pass} progression checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
