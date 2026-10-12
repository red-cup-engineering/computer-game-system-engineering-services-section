// prove-medicine — MEDICINE: one actor TREATS another's wounds, scaled by their people.healing
// skill, fights infection, and an untended SEVERE wound FESTERS into `sick` on the tick. Builds a
// tiny world by hand in a UNIQUE /tmp dir (no examples), drives the tending morphisms directly, and
// asserts: a skilled healer lowers a wound's severity (and improves the capacity it serves); a
// higher-skill healer closes MORE than a low-skill one; diagnose reports the wound + worst; a treat
// relieves a `sick` infection; tickWounds festers a severity-≥7 untended wound into `sick`.
//
// Same tiny harness as prove-comms.mjs. Standalone: run `node tests/prove-medicine.mjs`.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import doing from "#doing";
import { healthOf, injure } from "#health";
import { conditionsOf, afflict } from "#conditions";

import treat, { bandage, diagnose, tickWounds, healAmountFor } from "../being/doing/responding/tending/scripts/tend.mjs";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );

const tmp = mkdtempSync(join(tmpdir(), "tab-medicine-"));
const world = join(tmp, "w");

// place an actor (kind=player + a `mover` cell so the tick recognises it as an actor).
const place = async (who, t) => {
  await doing({ root: world, subject: who, predicate: "kind", object: "player", t: `${t}a` });
  await doing({ root: world, subject: who, predicate: "naming", object: who, t: `${t}b` });
  await doing({ root: world, subject: who, predicate: "mover", object: true, t: `${t}c` });
};

// teach a skill `n` times (each success files a positive skill:<path> witness row).
const teach = async (who, path, n, t) => {
  for (let i = 0; i < n; i += 1) {
    await doing({ root: world, subject: who, predicate: `skill:${path}`, object: true, t: `${t}:teach:${i}` });
  }
};

try {
  await place("patient", "seed:000001");
  await place("novice", "seed:000002");
  await place("master", "seed:000003");
  await place("victim", "seed:000004");

  // master is well-taught at people.healing; novice has none.
  await teach("master", "people.healing", 6, "seed:000010");

  // --- a skilled healer lowers a wound's severity and improves the served capacity -----------
  await ok("treat lowers the wounded part's severity and improves its capacity", async () => {
    await injure({ root: world, subject: "patient", part: "arm", severity: 6, t: "tick:1/injure:1" });
    const before = await healthOf(world, "patient");
    assert.equal(before.injuries.find((w) => w.part === "arm").severity, 6, "arm starts at severity 6");
    const manipBefore = before.capacities.manipulation;

    const res = await treat(world, "master", "patient", "arm", "tick:1/treat:1");
    assert.equal(res.ok, true, "treat on a real wound succeeds");
    assert.equal(res.part, "arm");
    assert.ok(res.healedBy >= 2, "the master closes at least the base amount");

    const after = await healthOf(world, "patient");
    const armAfter = after.injuries.find((w) => w.part === "arm");
    const sevAfter = armAfter ? armAfter.severity : 0;
    assert.ok(sevAfter < 6, "the arm severity dropped");
    assert.equal(sevAfter, res.severityAfter, "severityAfter matches the settled reading");
    assert.ok(after.capacities.manipulation > manipBefore, "manipulation capacity improved");
  });

  // --- treating an unhurt part fails -----------------------------------------------------------
  await ok("treat reports ok:false with a reason when there is no wound on the part", async () => {
    const res = await treat(world, "master", "patient", "leg", "tick:1/treat:2");
    assert.equal(res.ok, false, "no wound on the leg → no treat");
    assert.ok(/no wound/.test(res.reason), "the reason names the missing wound");
  });

  // --- a higher-skill healer closes MORE than a low-skill one ----------------------------------
  await ok("a higher-skill healer closes more of a wound than a low-skill one", async () => {
    // pure formula: master's bonus is strictly larger, so it closes >= the novice's amount.
    const masterHeal = healAmountFor(6 * 5 + (10 - 10) * 2); // taught=6 → bonus 30 → 2+floor(30/15)=4
    const noviceHeal = healAmountFor(0);                     // bonus 0 → 2
    assert.ok(masterHeal > noviceHeal, "more teaching closes strictly more");

    // and end-to-end on equal wounds: novice vs master each treat a fresh severity-6 arm.
    await injure({ root: world, subject: "novice", part: "arm", severity: 6, t: "tick:2/injure:1" });
    await injure({ root: world, subject: "patient", part: "leg", severity: 6, t: "tick:2/injure:2" });
    const r1 = await treat(world, "novice", "novice", "arm", "tick:2/treat:1"); // novice self-treats
    const r2 = await treat(world, "master", "patient", "leg", "tick:2/treat:2");
    assert.ok(r2.healedBy > r1.healedBy, "the master closed more than the novice");
  });

  // --- diagnose reports the wounds + worst -----------------------------------------------------
  await ok("diagnose reports the injuries and the worst wound", async () => {
    await injure({ root: world, subject: "victim", part: "leg", severity: 3, t: "tick:3/injure:1" });
    await injure({ root: world, subject: "victim", part: "eye", severity: 8, t: "tick:3/injure:2" });
    const d = await diagnose(world, "victim");
    assert.equal(d.injuries.length, 2, "both wounds are reported");
    assert.equal(d.worst.part, "eye", "the eye (severity 8) is the worst");
    assert.equal(d.worst.severity, 8);
    assert.equal(d.infected, false, "no infection yet");
    assert.ok(typeof d.advice === "string" && d.advice.length > 0, "advice is a non-empty string");
  });

  // --- bandage treats the worst wound ----------------------------------------------------------
  await ok("bandage treats the patient's worst wound", async () => {
    // t must sort AFTER the eye injure (tick:3/injure:2) so the heal supersedes it (functional
    // latest-t is a lexicographic compare): "tick:3/treat" > "tick:3/injure".
    const res = await bandage(world, "master", "victim", "tick:3/treat:9");
    assert.equal(res.ok, true);
    assert.equal(res.part, "eye", "bandage chose the worst wound (the eye)");
    const after = await healthOf(world, "victim");
    const eye = after.injuries.find((w) => w.part === "eye");
    assert.ok((eye ? eye.severity : 0) < 8, "the eye wound was lowered");
  });

  // --- a treat relieves a `sick` infection -----------------------------------------------------
  await ok("treating an infected patient relieves the sick condition", async () => {
    await injure({ root: world, subject: "patient", part: "torso", severity: 4, t: "tick:4/injure:1" });
    await afflict(world, "patient", "sick", 3, "tick:4/afflict:1");
    const sickBefore = (await conditionsOf(world, "patient")).find((c) => c.name === "sick").intensity;
    assert.equal(sickBefore, 3, "patient starts at sick intensity 3");

    const res = await treat(world, "master", "patient", "torso", "tick:4/treat:1");
    assert.equal(res.ok, true);
    const sickAfter = (await conditionsOf(world, "patient")).find((c) => c.name === "sick")?.intensity ?? 0;
    assert.ok(sickAfter < sickBefore, "the infection was reduced by a successful treat");
  });

  // --- tickWounds festers an untended severe wound into `sick` ---------------------------------
  await ok("tickWounds festers a severity-≥7 untended wound into sick", async () => {
    await injure({ root: world, subject: "victim", part: "torso", severity: 8, t: "tick:5/injure:1" });
    const before = (await conditionsOf(world, "victim")).find((c) => c.name === "sick")?.intensity ?? 0;

    const { appended } = await tickWounds(world, "tick:5/fester:1");
    assert.ok(appended.length >= 1, "at least one fester row was written");

    const after = (await conditionsOf(world, "victim")).find((c) => c.name === "sick")?.intensity ?? 0;
    assert.equal(after, before + 1, "the severe untended wound festered sick by 1");
  });

  await ok("tickWounds leaves a lightly-wounded actor untouched", async () => {
    // a fresh actor with only a mild wound (severity < 7) does not fester.
    await place("hale", "seed:000005");
    await injure({ root: world, subject: "hale", part: "leg", severity: 3, t: "tick:6/injure:1" });
    await tickWounds(world, "tick:6/fester:1");
    const sick = (await conditionsOf(world, "hale")).find((c) => c.name === "sick")?.intensity ?? 0;
    assert.equal(sick, 0, "a mild wound does not fester");
  });

  console.log(`\n${pass} medicine checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
