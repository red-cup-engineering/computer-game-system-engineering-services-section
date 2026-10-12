// prove-proficiency — the ATTRIBUTES + SKILL-TREE + BONUS + ADVANCEMENT spine. Builds a tiny
// world by hand in a UNIQUE /tmp dir, seeds an actor's attributes (attr:<stat>) and skill
// practice rows (skill:<path> successes; an unskill:<path> converse for a regression), then
// asserts the derived readings: taught depth counts the successes, bonus = taught*5 + (gov-10)*2,
// bonus rises with another teach and (separately) with a higher governing stat, a converse makes
// the skill contested (⊤), the triangular advancement thresholds behave (later levels need more
// teaches), attributes default to 10 when absent, and report() lists the skill with its bonus.
//
// Same tiny harness as prove-comms.mjs. Standalone: run `node tests/prove-proficiency.mjs`.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import doing, { declareConverse } from "#doing";

import proficiency, {
  attributes,
  attributesOf,
  taughtOf,
  contested,
  governingStat,
  bonusOf,
  proficiencyOf,
  level,
  advances,
  nextAt,
  thresholdFor,
  report,
  reportOf,
  GOVERNANCE,
} from "../being/doing/observing/proficiency/scripts/proficiency.mjs";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );

const tmp = mkdtempSync(join(tmpdir(), "tab-proficiency-"));
const world = join(tmp, "w");

const SWORD = "fighting.melee.sword";
const skillPred = `skill:${SWORD}`;
const unskillPred = `unskill:${SWORD}`;

// teach — file one positive practice row for the sword skill (object IS the path, per the
// practice convention so successes collapse to one cell and the witness counts them).
let seq = 0;
const teach = (who, t) =>
  doing({ root: world, subject: who, predicate: skillPred, object: SWORD, t });

try {
  // hero: attr:str 14, three sword teaches. nemo: no attrs at all (defaults), no skills.
  await doing({ root: world, subject: "hero", predicate: "attr:str", object: 14, t: "seed:000001" });
  await teach("hero", "seed:000002");
  await teach("hero", "seed:000003");
  await teach("hero", "seed:000004");

  // --- attributes default to 10 for absent stats; read the asserted one ----------------------
  await ok("attributesOf defaults absent attributes to 10, reads asserted attr:str", async () => {
    const a = await attributesOf(world, "hero");
    assert.equal(a.str, 14, "attr:str was seeded to 14");
    assert.equal(a.dex, 10, "absent attr:dex defaults to 10");
    assert.equal(a.int, 10);
    assert.equal(a.wis, 10);
    assert.equal(a.con, 10);
    const n = await attributesOf(world, "nemo");
    assert.deepEqual(n, { str: 10, dex: 10, int: 10, wis: 10, con: 10 }, "no attrs ⇒ all 10");
  });

  // --- governance: fighting is governed by str ----------------------------------------------
  await ok("governingStat reads the tree root; fighting → str", async () => {
    assert.equal(GOVERNANCE.fighting, "str");
    assert.equal(governingStat(SWORD), "str", "first dotted segment 'fighting' governs by str");
    assert.equal(governingStat("magic.fire.bolt"), "int");
    assert.equal(governingStat("nonsense.path"), "str", "unknown root defaults to str");
  });

  // --- taught depth + bonus formula ----------------------------------------------------------
  await ok("taught counts the success rows; bonus = taught*5 + (str-10)*2", async () => {
    const p = await proficiencyOf(world, "hero", SWORD);
    assert.equal(p.taught, 3, "three teaches ⇒ taught depth 3");
    assert.equal(p.governing, "str");
    assert.equal(p.gov, 14);
    // 3*5 + (14-10)*2 = 15 + 8 = 23
    assert.equal(p.bonus, 23, "bonus = 3*5 + (14-10)*2 = 23");
    assert.equal(p.contested, false, "no regression yet");
    assert.equal(await bonusOf(world, "hero", SWORD), 23);
  });

  // --- bonus rises with another teach --------------------------------------------------------
  await ok("an additional teach raises taught and bonus", async () => {
    const before = await bonusOf(world, "hero", SWORD);
    await teach("hero", "seed:000005");
    const p = await proficiencyOf(world, "hero", SWORD);
    assert.equal(p.taught, 4, "fourth teach counted");
    // 4*5 + (14-10)*2 = 20 + 8 = 28
    assert.equal(p.bonus, 28, "bonus = 4*5 + (14-10)*2 = 28");
    assert.ok(p.bonus > before, "bonus rose with the teach");
  });

  // --- bonus rises (separately) with a higher governing stat ---------------------------------
  await ok("raising str (functional latest wins) raises the bonus at the same taught depth", async () => {
    const beforeP = await proficiencyOf(world, "hero", SWORD);
    await doing({ root: world, subject: "hero", predicate: "attr:str", object: 18, t: "seed:000006" });
    const p = await proficiencyOf(world, "hero", SWORD);
    assert.equal(p.gov, 18, "attr:str settled to the latest value 18 (functional)");
    assert.equal(p.taught, beforeP.taught, "taught unchanged by the stat raise");
    // 4*5 + (18-10)*2 = 20 + 16 = 36
    assert.equal(p.bonus, 36, "bonus = 4*5 + (18-10)*2 = 36");
    assert.ok(p.bonus > beforeP.bonus, "higher str ⇒ higher bonus at the same taught depth");
  });

  // --- contested: a converse unskill:<path> makes the skill settle to ⊤ -----------------------
  await ok("a converse unskill:<path> regression makes contested() true (⊤)", async () => {
    const before = await proficiencyOf(world, "hero", SWORD);
    assert.equal(before.contested, false, "not contested before the regression");
    // Declare the converse on the actor's trace (as practice.mjs does), then file the unskill row.
    await declareConverse(world, "hero", skillPred, unskillPred, "seed:000007");
    await doing({ root: world, subject: "hero", predicate: unskillPred, object: SWORD, t: "seed:000008" });
    const p = await proficiencyOf(world, "hero", SWORD);
    assert.equal(p.contested, true, "positive successes + a converse regression ⇒ contested (⊤)");
  });

  // --- advancement: triangular thresholds, later levels need more teaches ---------------------
  await ok("level()/advances()/nextAt() use increasing triangular thresholds", async () => {
    // thresholds: L1=1, L2=3, L3=6, L4=10
    assert.equal(thresholdFor(1), 1);
    assert.equal(thresholdFor(2), 3);
    assert.equal(thresholdFor(3), 6);
    assert.equal(thresholdFor(4), 10);
    assert.equal(level(0), 0, "no teach ⇒ level 0");
    assert.equal(level(1), 1, "1 teach ⇒ level 1");
    assert.equal(level(2), 1, "2 teaches still level 1 (next at 3)");
    assert.equal(level(3), 2, "3 teaches ⇒ level 2");
    assert.equal(level(6), 3);
    assert.equal(level(10), 4);
    // advancing later levels needs MORE teaches: 1→2 is +1 (from 1), 2→3 spans 3..6 (+3 teaches)
    assert.equal(nextAt(1), 2, "from 1 teach, 2 more reach level 2 (threshold 3)");
    assert.equal(nextAt(3), 3, "from 3 teaches, 3 more reach level 3 (threshold 6)");
    assert.ok(nextAt(3) > nextAt(0), "the gap to the next level grows as you climb");
    assert.equal(advances(2, 3), true, "crossing 2→3 raises level (1→2): a teaching moment");
    assert.equal(advances(3, 4), false, "3→4 stays level 2: no advancement");
    assert.equal(advances(5, 6), true, "5→6 raises level (2→3)");
  });

  // --- report: lists the skill with its bonus, plus the attributes ----------------------------
  await ok("report lists every skill with its bonus/taught/contested and the attributes", async () => {
    const r = await reportOf(world, "hero");
    assert.equal(r.attributes.str, 18, "report carries the latest attributes");
    assert.equal(r.attributes.dex, 10);
    const sword = r.skills.find((s) => s.skill === SWORD);
    assert.ok(sword, "the sword skill appears in the report");
    assert.equal(sword.taught, 4, "report taught depth matches");
    assert.equal(sword.bonus, 36, "report bonus matches proficiency()");
    assert.equal(sword.contested, true, "report surfaces the contested skill");
  });

  // --- pure readers operate on a hand-built fiber (no disk) ------------------------------------
  await ok("attributes()/report() are pure over a settled fiber", async () => {
    const thing = { entity: "x", fiber: [
      { predicate: "attr:dex", object: 12, value: { pos: 1, neg: 0 } },
      { predicate: "skill:covert.stealth", object: "covert.stealth",
        value: { pos: 1, neg: 0 }, witness: { pos: ["row:a", "row:b"], neg: [] } },
    ] };
    const a = attributes(thing);
    assert.equal(a.dex, 12);
    assert.equal(a.str, 10, "absent ⇒ baseline");
    assert.equal(taughtOf(thing, "covert.stealth"), 2, "witness counts two teaches");
    assert.equal(contested(thing, "covert.stealth"), false, "no negative face ⇒ not contested");
    const p = proficiency(thing, "covert.stealth");
    assert.equal(p.governing, "dex", "covert governed by dex");
    // 2*5 + (12-10)*2 = 10 + 4 = 14
    assert.equal(p.bonus, 14);
    const rep = report(thing);
    assert.equal(rep.skills[0].skill, "covert.stealth");
    assert.equal(rep.skills[0].bonus, 14);
  });

  console.log(`\n${pass} proficiency checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
