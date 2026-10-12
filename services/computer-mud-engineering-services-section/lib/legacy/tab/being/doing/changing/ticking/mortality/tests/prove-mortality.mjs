// prove-mortality — MORTALITY: death, corpses, decay, and respawn as a tick-fold.
// Builds a tiny world by hand in a UNIQUE /tmp dir (no examples), drives the mortality morphisms
// directly, and asserts the agential-realist properties: an actor driven to a mortal wound dies on
// the tick; its death mints a `corpse` entity the room contains; the corpse carries the actor's
// dropped loot; the actor reads `dead`; the corpse's `decay` rises each tick and eventually rots
// away (its located-in retracted, so it leaves the room); a player respawn clears every wound
// (alive again, no injuries) and places the body; isDead reflects the recorded state throughout.
//
// Same tiny harness as prove-comms.mjs. Standalone: run `node tests/prove-mortality.mjs`.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import doing from "#doing";
import { settle, containedBy, locationOf, FUNCTIONAL } from "#substrate";
import { holds } from "#value";
import { healthOf, injure } from "#health";

import tickMortality, { die, respawn, isDead, corpsesIn, ROT_AT }
  from "../scripts/mortality.mjs";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );

const tmp = mkdtempSync(join(tmpdir(), "tab-mortality-"));
const world = join(tmp, "w");

// local functional set so we can read `dead`/`decay` even if the substrate set ever drifts.
const F = new Set([...FUNCTIONAL, "dead", "decay"]);
const settled = (id) => settle(world, id, { functional: F });
const cellOf = (thing, p) => thing.fiber.find((c) => c.predicate === p && holds(c.value))?.object;

// place an actor (a `mover`) into a room, carrying one item.
const seed = async () => {
  await doing({ root: world, subject: "hero", predicate: "kind", object: "player", t: "seed:00a" });
  await doing({ root: world, subject: "hero", predicate: "naming", object: "Hero", t: "seed:00b" });
  await doing({ root: world, subject: "hero", predicate: "mover", object: true, t: "seed:00c" });
  await doing({ root: world, subject: "hero", predicate: "located-in", object: "the-crypt", t: "seed:00d" });
  // a carried item: located-in the hero (relational; dual-files at the hero anchor).
  await doing({ root: world, subject: "sword", predicate: "kind", object: "weapon", t: "seed:01a" });
  await doing({ root: world, subject: "sword", predicate: "naming", object: "a sword", t: "seed:01b" });
  await doing({ root: world, subject: "sword", predicate: "located-in", object: "hero", t: "seed:01c" });
};

try {
  await seed();

  await ok("the carried item starts located-in the actor", async () => {
    assert.deepEqual(await containedBy(world, "hero"), ["sword"]);
    assert.equal(await isDead(world, "hero"), false, "the hero starts alive");
  });

  // --- mortal wound + tick → death ----------------------------------------------------------
  await ok("a severity-10 torso wound drives healthOf().alive false", async () => {
    await injure({ root: world, subject: "hero", part: "torso", severity: 10, t: "tick:0001/wound" });
    const h = await healthOf(world, "hero");
    assert.equal(h.alive, false, "a destroyed vital part is mortal");
  });

  // tick t values are ZERO-PADDED so string supersession (latest-t wins) orders them numerically,
  // as a real tick clock formats them — "tick:0002" < "tick:0010" lexically as well as numerically.
  const tk = (n) => `tick:${String(n).padStart(4, "0")}`;

  let corpse;
  await ok("tickMortality dies the mortally-wounded actor and mints a corpse in the room", async () => {
    const out = await tickMortality(world, tk(2));
    assert.ok(out.died.includes("hero"), "the hero is reported among the dead");
    const here = await corpsesIn(world, "the-crypt");
    assert.equal(here.length, 1, "exactly one corpse stands in the crypt");
    [corpse] = here;
    assert.ok(corpse.startsWith("corpse:"), "the corpse carries the corpse: prefix");
    const c = await settled(corpse);
    assert.equal(cellOf(c, "kind"), "corpse");
    assert.equal(cellOf(c, "naming"), "the corpse of Hero");
    assert.equal(cellOf(c, "was"), "hero");
    assert.equal(cellOf(c, "decay"), 0, "a fresh corpse starts at decay 0");
    assert.equal(await locationOf(world, corpse), "the-crypt");
  });

  await ok("the corpse carries the actor's dropped loot; the actor reads dead", async () => {
    assert.deepEqual(await containedBy(world, corpse), ["sword"], "the sword is now on the corpse");
    assert.equal(await locationOf(world, "sword"), corpse, "loot stays with the body");
    assert.equal(await containedBy(world, "hero").then((c) => c.length), 0, "the hero carries nothing");
    assert.equal(await isDead(world, "hero"), true, "the hero reads dead");
  });

  await ok("die is idempotent — dying an already-dead actor is a no-op", async () => {
    const again = await die(world, "hero", `${tk(3)}/again`);
    assert.equal(again.corpse, null, "no second corpse is minted");
    assert.deepEqual(again.dropped, []);
    assert.equal((await corpsesIn(world, "the-crypt")).length, 1, "still exactly one corpse");
  });

  await ok("the corpse is replay-deterministic (content-addressed id)", async () => {
    // re-deriving die at the SAME tick yields the SAME corpse id (proven by the cells landing on
    // the same entity). We assert determinism by re-running die on a fresh dead actor in a fresh
    // world at the same tick and matching the corpse id.
    const t2 = mkdtempSync(join(tmpdir(), "tab-mortality-det-"));
    const w2 = join(t2, "w");
    try {
      await doing({ root: w2, subject: "hero", predicate: "naming", object: "Hero", t: "seed:00b" });
      await doing({ root: w2, subject: "hero", predicate: "mover", object: true, t: "seed:00c" });
      await doing({ root: w2, subject: "hero", predicate: "located-in", object: "the-crypt", t: "seed:00d" });
      const a = await die(w2, "hero", "tick:9/die:0");
      // a second identical world → identical corpse id.
      const t3 = mkdtempSync(join(tmpdir(), "tab-mortality-det2-"));
      const w3 = join(t3, "w");
      try {
        await doing({ root: w3, subject: "hero", predicate: "naming", object: "Hero", t: "seed:00b" });
        await doing({ root: w3, subject: "hero", predicate: "mover", object: true, t: "seed:00c" });
        await doing({ root: w3, subject: "hero", predicate: "located-in", object: "the-crypt", t: "seed:00d" });
        const b = await die(w3, "hero", "tick:9/die:0");
        assert.equal(a.corpse, b.corpse, "identical death at identical tick → identical corpse id");
      } finally { rmSync(t3, { recursive: true, force: true }); }
    } finally { rmSync(t2, { recursive: true, force: true }); }
  });

  // --- decay → rot away ---------------------------------------------------------------------
  await ok("repeated ticks raise the corpse's decay", async () => {
    const before = Number(cellOf(await settled(corpse), "decay"));
    await tickMortality(world, tk(4));
    const after = Number(cellOf(await settled(corpse), "decay"));
    assert.equal(after, before + 1, "one tick raises decay by exactly one");
  });

  await ok("the corpse rots away when decay reaches the threshold (located-in retracted)", async () => {
    // drive enough ticks to reach ROT_AT. The corpse was minted at tick:2 (decay 0, born-this-tick
    // so it stayed 0), then tick:4 → 1. Keep ticking until it is gone, bounded by ROT_AT+ ticks.
    let gone = false;
    for (let i = 5; i < 5 + ROT_AT + 2 && !gone; i += 1) {
      const out = await tickMortality(world, tk(i));
      if (out.rotted.includes(corpse)) gone = true;
    }
    assert.ok(gone, "the corpse was reported rotted");
    assert.equal(await locationOf(world, corpse), null, "its located-in is retracted — it left the room");
    assert.equal((await corpsesIn(world, "the-crypt")).length, 0, "no corpse remains in the crypt");
  });

  // --- respawn ------------------------------------------------------------------------------
  await ok("respawn clears every wound (alive, no injuries) and places the actor", async () => {
    assert.equal((await healthOf(world, "hero")).alive, false, "the hero is still mortally wounded");
    const { ok: done } = await respawn(world, "hero", "the-shrine", tk(50));
    assert.equal(done, true);
    const h = await healthOf(world, "hero");
    assert.equal(h.alive, true, "the body is whole again");
    assert.equal(h.injuries.length, 0, "no live injuries remain");
    assert.equal(await isDead(world, "hero"), false, "the hero no longer reads dead");
    assert.equal(await locationOf(world, "hero"), "the-shrine", "the hero stands at the shrine");
  });

  console.log(`\n${pass} mortality checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
