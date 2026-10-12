// prove-conditions — CONDITIONS: the status-effects layer. A condition:<name> cell carries an
// integer INTENSITY; conditions modify the actor's effective stats/skills/capacities (modifiersOf
// scales each per-map by intensity and sums); afflict raises to MAX(current,intensity) and rejects an
// uncatalogued name; tickConditions decays every actor's conditions by 1 toward 0 append-only; a
// condition decayed to 0 drops out of the view. Builds a tiny world by hand in a UNIQUE /tmp dir.
//
// Same tiny harness as prove-comms.mjs. Standalone: run `node tests/prove-conditions.mjs`.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import doing from "#doing";
import { rowsFor } from "#substrate";

import conditionsOf, {
  CONDITIONS, conditions, modifiersOf, afflict, relieve, tickConditions,
} from "../being/doing/observing/conditions/scripts/conditions.mjs";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );

const tmp = mkdtempSync(join(tmpdir(), "tab-conditions-"));
const world = join(tmp, "w");

try {
  // 'you' is an actor (a `mover:tick` cell). 'rock' is not (no mover) — it never gets afflicted/ticked.
  await doing({ root: world, subject: "you", predicate: "mover", object: "tick", t: "seed:000001" });
  await doing({ root: world, subject: "rock", predicate: "kind", object: "object", t: "seed:000002" });

  // --- afflict + conditionsOf: drunk 5 shows with its per-map -------------------------------
  await ok("afflict drunk 5 → conditionsOf shows drunk intensity 5 with its per-map", async () => {
    await afflict(world, "you", "drunk", 5, "tick:1/afflict:1");
    const live = await conditionsOf(world, "you");
    const drunk = live.find((c) => c.name === "drunk");
    assert.ok(drunk, "drunk should be live");
    assert.equal(drunk.intensity, 5);
    assert.equal(drunk.desc, CONDITIONS.drunk.desc);
    assert.deepEqual(drunk.per, CONDITIONS.drunk.per);
  });

  // --- modifiersOf scales by intensity -------------------------------------------------------
  await ok("modifiersOf scales drunk's dex per-point by intensity 5", async () => {
    const mods = await modifiersOf(world, "you");
    // drunk per dex is -1 per point; at intensity 5 → -5.
    assert.equal(mods.attr.dex, CONDITIONS.drunk.per.dex * 5);
    assert.equal(mods.attr.dex, -5);
    // drunk's people +2 per point → +10 in the skill bucket.
    assert.equal(mods.skill.people, 10);
  });

  // --- afflict MAX semantics: a milder dose does not weaken an existing affliction -----------
  await ok("afflict to a lower intensity keeps MAX(current, intensity)", async () => {
    await afflict(world, "you", "drunk", 2, "tick:1/afflict:2");
    const drunk = (await conditionsOf(world, "you")).find((c) => c.name === "drunk");
    assert.equal(drunk.intensity, 5, "MAX(5,2) stays 5");
  });

  // --- a second condition combines into the net ---------------------------------------------
  await ok("afflict exhausted 2 combines into the net modifiers", async () => {
    await afflict(world, "you", "exhausted", 2, "tick:1/afflict:3");
    const mods = await modifiersOf(world, "you");
    // dex: drunk -1×5 plus exhausted -1×2 = -7.
    assert.equal(mods.attr.dex, (CONDITIONS.drunk.per.dex * 5) + (CONDITIONS.exhausted.per.dex * 2));
    assert.equal(mods.attr.dex, -7);
    // str: only exhausted -1×2 = -2. moving: only exhausted -2×2 = -4.
    assert.equal(mods.attr.str, -2);
    assert.equal(mods.capacity.moving, -4);
    // the view now carries two conditions, sorted by name (drunk before exhausted).
    const live = await conditionsOf(world, "you");
    assert.deepEqual(live.map((c) => c.name), ["drunk", "exhausted"]);
  });

  // --- tickConditions decays each by 1, append-only -----------------------------------------
  await ok("tickConditions decays drunk 5→4 and exhausted 2→1 (append-only)", async () => {
    const { appended } = await tickConditions(world, "tick:2/decay:1");
    assert.equal(appended.length, 2, "one decay row per live condition on the actor");
    const live = await conditionsOf(world, "you");
    const by = Object.fromEntries(live.map((c) => [c.name, c.intensity]));
    assert.equal(by.drunk, 4, "drunk decayed 5→4");
    assert.equal(by.exhausted, 1, "exhausted decayed 2→1");
    // append-only: the old intensity-5 drunk row is STILL on the raw trace.
    const raw = await rowsFor(world, "you");
    assert.ok(
      raw.some((r) => r.e === "you" && r.a === "condition:drunk" && r.v === 5),
      "the original drunk=5 row is never deleted",
    );
    assert.ok(
      raw.some((r) => r.e === "you" && r.a === "condition:drunk" && r.v === 4),
      "a new drunk=4 row was appended",
    );
  });

  // --- a condition decayed to 0 drops out of the view ---------------------------------------
  await ok("a condition decayed to 0 drops out of conditionsOf", async () => {
    // exhausted is at 1; one more tick takes it to 0.
    await tickConditions(world, "tick:3/decay:1");
    const live = await conditionsOf(world, "you");
    assert.ok(!live.some((c) => c.name === "exhausted"), "exhausted at 0 is gone from the view");
    assert.ok(live.some((c) => c.name === "drunk"), "drunk (now 3) is still live");
    const ex = await conditionsOf(world, "you");
    assert.equal(ex.find((c) => c.name === "drunk").intensity, 3);
  });

  // --- relieve lifts a condition immediately -------------------------------------------------
  await ok("relieve sets a condition to 0 and it drops out", async () => {
    await relieve(world, "you", "drunk", "tick:4/relieve:1");
    const live = await conditionsOf(world, "you");
    assert.ok(!live.some((c) => c.name === "drunk"), "drunk is relieved");
  });

  // --- afflict rejects an unknown name -------------------------------------------------------
  await ok("afflict rejects an uncatalogued condition name", async () => {
    await assert.rejects(
      () => afflict(world, "you", "bewildered", 3, "tick:5/afflict:1"),
      /unknown condition/,
      "an uncatalogued name must be rejected",
    );
  });

  // --- the pure view function reads a hand-built fiber ---------------------------------------
  await ok("conditions(thing) reads live conditions off a settled fiber, sorted by name", async () => {
    const fiber = [
      { predicate: "condition:blessed", object: 2, value: { pos: 1, neg: 0, glyph: "⊤" } },
      { predicate: "condition:afraid", object: 3, value: { pos: 1, neg: 0, glyph: "⊤" } },
      { predicate: "condition:drunk", object: 0, value: { pos: 1, neg: 0, glyph: "⊤" } }, // gone
    ];
    const view = conditions({ entity: "x", fiber });
    assert.deepEqual(view.map((c) => c.name), ["afraid", "blessed"], "sorted, zero dropped");
  });

  // --- a non-actor is never ticked -----------------------------------------------------------
  await ok("tickConditions only touches actors (subjects with a mover cell)", async () => {
    const before = (await rowsFor(world, "rock")).length;
    await tickConditions(world, "tick:6/decay:1");
    const after = (await rowsFor(world, "rock")).length;
    assert.equal(after, before, "the rock has no mover cell — untouched by the tick");
  });

  console.log(`\n${pass} conditions checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
