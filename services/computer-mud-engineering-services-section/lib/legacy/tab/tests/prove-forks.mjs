// prove-forks — settleForks (non-confluence / real choice) as a READ over the settled fiber.
// Constructs a temp world with a 3-chain `bypasses` declaration whose middle cell becomes
// contested (⊤), and asserts the three load-bearing behaviors:
//   (i)   a world with NO bypasses ⇒ forks:[], and base deep-equal to a plain settle().
//   (ii)  a real 3-chain ⇒ exactly two forks + a non-empty seam.
//   (iii) base is byte-equal to settle() (the confluent floor is untouched).
// Same tiny harness as prove-interaction.mjs. Imports settleForks by RELATIVE path.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { settle } from "#substrate";
import settleForks, {
  bypassRelation,
  bypassChains,
} from "../being/doing/responding/forking/scripts/settle-forks.mjs";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );

const tmp = mkdtempSync(join(tmpdir(), "tab-forks-"));

// Write a subject's jsonl log directly (append-only on-disk world is the substrate's contract).
const writeLog = (root, subject, rows) =>
  writeFileSync(join(root, `${subject}.jsonl`), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");

try {
  // --- world A: a real 3-chain with a contested middle cell ---------------------------------
  // Predicates p1 → p2 → p3 all present in the fiber. p2 is CONTESTED: a converse declaration
  // (q2 is the converse of p2) plus both a p2-row and a q2-row settle p2's cell to ⊤.
  const worldA = join(tmp, "chain");
  rmSync(worldA, { recursive: true, force: true });
  await import("node:fs/promises").then(({ mkdir }) => mkdir(worldA, { recursive: true }));
  writeLog(worldA, "node", [
    // bypass relation declared as data: p1 bypasses p2, p2 bypasses p3 (the 3-chain).
    { e: "p1", a: "bypasses", v: "p2", t: "t0" },
    { e: "p2", a: "bypasses", v: "p3", t: "t1" },
    // the three chain cells, all present in the fiber.
    { e: "node", a: "p1", v: "x", t: "t2" },
    { e: "node", a: "p2", v: "y", t: "t3" },
    { e: "node", a: "p3", v: "z", t: "t4" },
    // make p2 contested → ⊤: declare q2 as p2's converse, then assert both.
    { e: "p2", a: "has-converse", v: "q2", t: "t5" },
    { e: "node", a: "q2", v: "y", t: "t6" }, // negative evidence for the (p2,y) cell
  ]);

  await ok("a real 3-chain ⇒ exactly two forks", async () => {
    const { forks } = await settleForks(worldA, "node");
    assert.equal(forks.length, 2, "Thing F6.3: two incomparable normal forms");
    assert.equal(forks[0].resolveOrder, "p1-p2-first");
    assert.equal(forks[1].resolveOrder, "p2-p3-first");
    assert.deepEqual(forks[0].chain, ["p1", "p2", "p3"]);
  });

  await ok("the two forks are distinct (incomparable orderings)", async () => {
    const { forks } = await settleForks(worldA, "node");
    const order = (f) => f.fiber.map((c) => c.predicate + " " + c.object).join("|");
    assert.notEqual(order(forks[0]), order(forks[1]), "neither reaches the other");
  });

  await ok("the contested p2 cell IS the seam (⊤ on a chain predicate)", async () => {
    const { seams } = await settleForks(worldA, "node");
    assert.ok(seams.length >= 1, "non-empty seam");
    const s = seams.find((x) => x.predicate === "p2");
    assert.ok(s, "p2 participates in the chain and reads ⊤");
    assert.equal(s.glyph, "⊤");
    assert.equal(s.object, "y");
  });

  await ok("base is byte-equal to settle() (confluent floor untouched)", async () => {
    const { base } = await settleForks(worldA, "node");
    const plain = await settle(worldA, "node");
    assert.equal(JSON.stringify(base), JSON.stringify(plain), "base === settle()");
    assert.deepEqual(base, plain);
  });

  // --- world B: NO bypasses ⇒ confluent ⇒ settleForks ≡ settle -------------------------------
  const worldB = join(tmp, "plain");
  await import("node:fs/promises").then(({ mkdir }) => mkdir(worldB, { recursive: true }));
  writeLog(worldB, "node", [
    { e: "node", a: "p1", v: "x", t: "t0" },
    { e: "node", a: "p2", v: "y", t: "t1" },
    { e: "node", a: "p3", v: "z", t: "t2" },
  ]);

  await ok("no bypasses ⇒ forks:[] and base deep-equal to plain settle()", async () => {
    const { base, forks, seams } = await settleForks(worldB, "node");
    assert.equal(forks.length, 0, "Quality F6.4: no chain ⇒ no fork");
    assert.equal(seams.length, 0);
    const plain = await settle(worldB, "node");
    assert.deepEqual(base, plain, "settleForks ≡ settle on a confluent world");
  });

  // --- a two-chain is NOT non-confluent (Quality F6.4: length ≥3 required) -------------------
  const worldC = join(tmp, "twochain");
  await import("node:fs/promises").then(({ mkdir }) => mkdir(worldC, { recursive: true }));
  writeLog(worldC, "node", [
    { e: "p1", a: "bypasses", v: "p2", t: "t0" }, // only ONE edge ⇒ no 3-chain
    { e: "node", a: "p1", v: "x", t: "t1" },
    { e: "node", a: "p2", v: "y", t: "t2" },
  ]);

  await ok("a single bypass edge (length-2) produces NO forks", async () => {
    const { forks, seams } = await settleForks(worldC, "node");
    assert.equal(forks.length, 0, "two-generator histories are always confluent");
    assert.equal(seams.length, 0);
  });

  // --- unit checks on the helpers -----------------------------------------------------------
  await ok("bypassRelation collects bypasses rows into a Map<pred,Set<pred>>", async () => {
    const rel = bypassRelation([
      { e: "p1", a: "bypasses", v: "p2", t: "t0" },
      { e: "p2", a: "bypasses", v: "p3", t: "t1" },
      { e: "node", a: "p1", v: "x", t: "t2" }, // not a bypasses row
    ]);
    assert.ok(rel.get("p1").has("p2"));
    assert.ok(rel.get("p2").has("p3"));
    assert.equal(rel.size, 2);
  });

  await ok("bypassChains finds the triple only when all three are present", async () => {
    const rel = bypassRelation([
      { e: "p1", a: "bypasses", v: "p2", t: "t0" },
      { e: "p2", a: "bypasses", v: "p3", t: "t1" },
    ]);
    const full = [{ predicate: "p1", object: "x" }, { predicate: "p2", object: "y" }, { predicate: "p3", object: "z" }];
    assert.deepEqual(bypassChains(full, rel), [["p1", "p2", "p3"]]);
    const missing = [{ predicate: "p1", object: "x" }, { predicate: "p2", object: "y" }];
    assert.deepEqual(bypassChains(missing, rel), [], "p3 absent ⇒ no chain");
  });

  console.log(`\n${pass} fork checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
