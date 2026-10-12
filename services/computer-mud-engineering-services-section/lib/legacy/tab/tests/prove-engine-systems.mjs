// prove-engine-systems — the first slice of ENGINE SYSTEMS (EPIC B): combat, ecology/regen, and
// time/calendar. Each must INTERLOCK with the existing needs/mood/health/scarcity loop and be
// deterministic / replay-safe. Same tiny harness as prove-interaction.mjs: a hand-made temp world
// in a UNIQUE /tmp dir, torn down at the end. Existing modules come in by #alias; the three NEW
// modules under test come in by relative path (their package.json aliases are not wired yet).

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import doing from "#doing";
import { healthOf } from "#health";
import { settle } from "#substrate";

import attack, { canAttack, resolve, partFor } from "../being/doing/responding/fighting/scripts/fight.mjs";
import regenerate, { grownTo, regenRows } from "../being/doing/changing/ticking/ecology/scripts/regen.mjs";
import clock, { timeRows, needRateAt, phaseOf } from "../being/doing/changing/ticking/timing/scripts/time.mjs";

let pass = 0;
const ok = (name, fn) =>
  Promise.resolve()
    .then(fn)
    .then(
      () => { pass += 1; console.log(`  ok  ${name}`); },
      (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
    );

const tmp = mkdtempSync(join(tmpdir(), "tab-engine-"));
const world = join(tmp, "arena");

// seed — a tiny helper to place a base cell on a subject deterministically.
let seq = 0;
const seed = (subject, predicate, object) =>
  doing({ root: world, subject, predicate, object, t: `seed:${String(++seq).padStart(6, "0")}` });

try {
  // --- world seed: two fighters, a defenceless dummy, and a depletable resource ----------------
  await seed("bruiser", "kind", "npc");
  await seed("bruiser", "skill:combat", 60); // a strong attacker
  await seed("bruiser", "located-in", "the-pit");

  await seed("dummy", "kind", "npc"); // defenceless: no combat skill, and we cripple its moving
  await seed("dummy", "located-in", "the-pit");

  await seed("guard", "kind", "npc"); // a STRONG defender: high moving, no combat skill of its own
  await seed("guard", "located-in", "the-pit");

  await seed("duelist", "kind", "npc"); // an evenly-matched fighter → a clash
  await seed("duelist", "skill:combat", 40);
  await seed("duelist", "located-in", "the-pit");

  await seed("berry-bush", "kind", "resource");
  await seed("berry-bush", "provides", "need:hunger");
  await seed("berry-bush", "located-in", "the-pit");
  await seed("berry-bush", "amount", 3); // depleted; cap is 20

  // === (a) COMBAT ==============================================================================

  await ok("attack on a defenceless target HITS, files an injury cell, and drops its #health", async () => {
    const before = await healthOf(world, "dummy");
    assert.equal(before.alive, true);
    assert.equal(before.injuries.length, 0);

    const r = await attack({ root: world, agent: "bruiser", target: "dummy", t: "tick:000100" });
    assert.equal(r.outcome, "hit", `expected hit, got ${r.outcome} (${r.glyph})`);
    assert.ok(r.injury, "a hit produces an injury");
    assert.ok(r.appended.length >= 1, "a hit appends at least the injury row");

    // the injury cell is on disk as injury:<part> with the severity as its object.
    const settled = await settle(world, "dummy", { functional: new Set(["located-in"]) });
    const cell = settled.fiber.find((c) => c.predicate === `injury:${r.injury.part}`);
    assert.ok(cell, `an injury:${r.injury.part} cell should exist on the target`);

    // #health reads a REDUCED capacity for the part struck.
    const after = await healthOf(world, "dummy");
    assert.equal(after.injuries.length, 1, "exactly one wound recorded");
    const served = { leg: "moving", arm: "manipulation", eye: "sight", torso: "moving" }[r.injury.part];
    assert.ok(after.capacities[served] < 100, `capacity ${served} should drop below 100`);
  });

  await ok("combat is DETERMINISTIC — same inputs reproduce the same outcome and part", async () => {
    // resolve is pure: same scores → same value.
    const a1 = resolve({ attackScore: 60, defenceScore: 0, counterScore: 0 });
    const a2 = resolve({ attackScore: 60, defenceScore: 0, counterScore: 0 });
    assert.deepEqual({ pos: a1.pos, neg: a1.neg }, { pos: a2.pos, neg: a2.neg });
    // part choice is a pure hash of attacker|target|tick.
    assert.equal(partFor("bruiser", "dummy", "tick:000100"), partFor("bruiser", "dummy", "tick:000100"));
  });

  await ok("a STRONG defender (high moving, no skill) yields a MISS, not a wound", async () => {
    // guard has full capacity:moving (100) → defence 50 ≥ attack? Use a weak attacker to force f.
    await seed("weakling", "kind", "npc");
    await seed("weakling", "skill:combat", 30); // attack 30 < guard defence 50 → denied (miss)
    await seed("weakling", "located-in", "the-pit");
    const r = await attack({ root: world, agent: "weakling", target: "guard", t: "tick:000200" });
    assert.equal(r.outcome, "miss", `expected miss, got ${r.outcome} (${r.glyph})`);
    assert.equal(r.glyph, "f");
    const after = await healthOf(world, "guard");
    assert.equal(after.injuries.length, 0, "a miss leaves the defender unwounded");
  });

  await ok("an evenly-matched skilled defender yields a CLASH (⊤) — both land", async () => {
    // duelist: skill 40, full moving → defence 50. attacker also skill 40 → defence 50 denies (40<50),
    // and duelist counters (counter 40 ≥ defence 50? no). Tune: give the attacker skill 50 so the
    // duelist's defence (50) ties the attack (50 ≥ 50 → denies) AND its counter (40) — adjust so a
    // clash is reachable: attacker 45 vs duelist defence 50 (denies) and counter 40 ≥ 50? Compose
    // a clean case via the pure resolve to assert the ⊤ branch, then drive a live attack that hits ⊤.
    const clashVal = resolve({ attackScore: 45, defenceScore: 50, counterScore: 50 });
    assert.equal(clashVal.pos, 1);
    assert.equal(clashVal.neg, 1); // ⊤

    // live: attacker 'duelist' (skill 40) strikes 'duelist2' (skill 50, full moving → defence 50,
    // counter 50). attack 40 < defence 50 → denied; counter 50 ≥ defence 50 → clash.
    await seed("duelist2", "kind", "npc");
    await seed("duelist2", "skill:combat", 50);
    await seed("duelist2", "located-in", "the-pit");
    const r = await attack({ root: world, agent: "duelist", target: "duelist2", t: "tick:000300" });
    assert.equal(r.outcome, "clash", `expected clash, got ${r.outcome} (${r.glyph})`);
    assert.equal(r.glyph, "⊤");
    assert.ok(r.injury, "the attacker's blow lands");
    assert.ok(r.counter, "the target's counter lands too");
    // both bodies carry a fresh wound.
    const tH = await healthOf(world, "duelist2");
    const aH = await healthOf(world, "duelist");
    assert.ok(tH.injuries.length >= 1, "target wounded in the clash");
    assert.ok(aH.injuries.length >= 1, "attacker wounded in the clash");
  });

  await ok("a LETHAL wound to a vital part (torso) reads alive=false out of #health", async () => {
    // file a severity-10 torso wound directly through the combat path's injure (here via doing) on a
    // fresh victim, then confirm #health derives death — combat never special-cases dying.
    await seed("victim", "kind", "npc");
    await seed("victim", "located-in", "the-pit");
    await doing({ root: world, subject: "victim", predicate: "injury:torso", object: 10, t: "tick:000400" });
    const h = await healthOf(world, "victim");
    assert.equal(h.alive, false, "a destroyed torso (vital) is death");
    // and a dead thing cannot be attacked.
    assert.equal(await canAttack({ root: world, attacker: "bruiser", target: "victim" }), false);
  });

  await ok("canAttack: a live, mobile attacker CAN strike a live target; not itself", async () => {
    assert.equal(await canAttack({ root: world, attacker: "bruiser", target: "guard" }), true);
    assert.equal(await canAttack({ root: world, attacker: "bruiser", target: "bruiser" }), false);
  });

  // === (b) ECOLOGY / REGEN ====================================================================

  await ok("grownTo: regrows toward cap by rate, NEVER above cap", async () => {
    assert.equal(grownTo(3, 20, 1), 4);
    assert.equal(grownTo(19, 20, 5), 20); // clamps at cap, no overshoot
    assert.equal(grownTo(20, 20, 1), 20); // already full → unchanged
    assert.equal(grownTo(25, 20, 1), 20); // over cap → pulled down to cap, never pushed higher
  });

  await ok("regenRows is pure and emits no row for a resource already at cap", async () => {
    const rows = regenRows({ resources: [{ subject: "x", amount: 20 }], t: "tick:1", cap: 20, rate: 1 });
    assert.equal(rows.length, 0);
    const rows2 = regenRows({ resources: [{ subject: "x", amount: 3 }], t: "tick:1", cap: 20, rate: 2 });
    assert.deepEqual(rows2, [{ e: "x", a: "amount", v: 5, t: "tick:1" }]);
  });

  await ok("regenerate raises a depleted resource's amount toward cap, never above", async () => {
    const amountNow = async () => {
      const s = await settle(world, "berry-bush", { functional: new Set(["located-in", "amount"]) });
      return Number(s.fiber.find((c) => c.predicate === "amount").object);
    };
    assert.equal(await amountNow(), 3);
    await regenerate({ root: world, t: "tick:000500", cap: 20, rate: 4 });
    assert.equal(await amountNow(), 7, "3 + 4 = 7");
    // drive it to the cap and confirm it never overshoots.
    for (let i = 0; i < 10; i += 1) await regenerate({ root: world, t: `tick:0006${i}0`, cap: 20, rate: 4 });
    assert.equal(await amountNow(), 20, "saturates exactly at cap");
    // a further regen at cap appends nothing new (stays at cap).
    const r = await regenerate({ root: world, t: "tick:000700", cap: 20, rate: 4 });
    assert.equal(r.appended.length, 0, "no row when already at cap");
  });

  // === (c) TIME / CALENDAR ====================================================================

  await ok("clock derives day/hour/season deterministically from the integer tick", async () => {
    assert.deepEqual(clock(0), clock(0)); // pure
    const t0 = clock(0);
    assert.equal(t0.hour, 0);
    assert.equal(t0.day, 0);
    assert.equal(t0.season, "spring");
    assert.equal(t0.phase, "night"); // hour 0 is night

    assert.equal(clock(25).hour, 1); // 25 = day 1, hour 1
    assert.equal(clock(25).day, 1);
    assert.equal(clock(24 * 30).season, "summer"); // day 30 → second season
    assert.equal(clock(24 * 60).season, "autumn");
    assert.equal(clock(24 * 90).season, "winter");
    assert.equal(clock(24 * 120).season, "spring"); // a full year wraps
    assert.equal(clock(24 * 120).year, 1);
    assert.equal(phaseOf(12), "day");
    assert.equal(phaseOf(23), "night");
    assert.equal(phaseOf(6), "dawn");
    assert.equal(phaseOf(20), "dusk");
  });

  await ok("needRateAt varies by phase — rest decays faster at night, slower by day", async () => {
    const restNight = needRateAt("rest", "night", "spring", 2);
    const restDay = needRateAt("rest", "day", "spring", 2);
    assert.ok(restNight > restDay, `rest should decay faster at night (${restNight} > ${restDay})`);
    // recreation is the inverse: the long day bores, night eases it.
    assert.ok(needRateAt("recreation", "day", "spring", 1) >= needRateAt("recreation", "night", "spring", 1));
    // a decaying need never modulates to 0.
    assert.ok(needRateAt("rest", "day", "spring", 2) >= 1);
    // a season bites: winter hunger > summer hunger.
    assert.ok(needRateAt("hunger", "day", "winter", 4) > needRateAt("hunger", "day", "summer", 4));
  });

  await ok("timeRows writes day/hour/season/phase onto the dimension, readable off its fiber", async () => {
    const rows = timeRows({ dimension: "arena-dim", tick: 30, t: "tick:000030" });
    assert.equal(rows.length, 4);
    for (const r of rows) await doing({ root: world, subject: r.e, predicate: r.a, object: r.v, t: r.t });
    const dim = await settle(world, "arena-dim", { functional: new Set(["phase"]) });
    assert.ok(dim.fiber.find((c) => c.predicate === "phase"), "phase is on the dimension");
    const c = clock(30);
    assert.equal(rows.find((r) => r.a === "hour").v, c.hour);
    assert.equal(rows.find((r) => r.a === "season").v, c.season);
  });

  console.log(`\n${pass} engine-systems checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
