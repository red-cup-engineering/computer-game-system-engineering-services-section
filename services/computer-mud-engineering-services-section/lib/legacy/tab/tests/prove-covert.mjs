// prove-covert — COVERT play: stealth, theft, and locks, all as DETERMINISTIC integer contests
// (skill-bonus + attribute-edge ≥ resistance), never chance. Builds a tiny world by hand in a
// UNIQUE /tmp dir (no examples, no Farstone), seeds actors with attributes (attr:*) and covert
// skills (via #practicing, which the #proficiency bonus reads), then drives the covert morphisms
// directly and asserts:
//   - hide sets `hidden` from covert.stealth bonus + dex edge;
//   - a high-perception observer detects the hidden actor, a low-perception one does not;
//   - steal SUCCEEDS for a skilled thief (the item moves located-in → thief) and FAILS+caught for
//     an unskilled one (the item stays with the victim, a `noticed` marker is filed);
//   - pick OPENS a locked chest when covert.locks (with a lockpick) meets the difficulty, and
//     REFUSES when short (the lock stays).
//
// Same tiny harness shape as prove-comms.mjs. Standalone: run `node tests/prove-covert.mjs`.
// #covert is imported by RELATIVE path (its alias is reserved for the engine, not this test).

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import doing from "#doing";
import practice from "#practicing";
import { settle, containedBy } from "#substrate";
import { holds } from "#value";

import covert, {
  hide, unhide, hiddenOf, isHidden, detect, steal, pick, isLocked, lockedOf,
} from "../being/doing/responding/skulking/scripts/skulk.mjs";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );

const tmp = mkdtempSync(join(tmpdir(), "tab-covert-"));
const world = join(tmp, "w");

// helpers -------------------------------------------------------------------------------------

// place an actor/item into a room (functional located-in; relational so it dual-files at the room).
const place = async (who, room, t) => {
  await doing({ root: world, subject: who, predicate: "naming", object: who, t: `${t}a` });
  await doing({ root: world, subject: who, predicate: "located-in", object: room, t: `${t}b` });
};
// set an attribute (attr:<stat> is a FUNCTIONAL family — latest wins).
const setAttr = async (who, stat, val, t) =>
  doing({ root: world, subject: who, predicate: `attr:${stat}`, object: val, t });
// teach a covert skill N times: each success accrues one witness → taught = N (bonus = N*5 + edge).
const teach = async (who, skillPath, n, prefix) => {
  for (let i = 0; i < n; i += 1) {
    await practice({ root: world, agent: who, actor: who, skill: skillPath, outcome: "success", t: `${prefix}:${i}` });
  }
};

try {
  // World: a hideaway and a guardroom.
  await place("sly", "hideaway", "seed:000001");      // a nimble, trained skulk
  await place("oaf", "hideaway", "seed:000002");      // a clumsy, untrained lout
  await place("hawk", "hideaway", "seed:000003");     // a sharp-eyed sentinel
  await place("mole", "hideaway", "seed:000004");     // a half-blind guard

  // sly: dex 16 (edge +6), 4 teaches of covert.stealth and covert.theft, 3 of covert.locks.
  await setAttr("sly", "dex", 16, "seed:000010");
  await teach("sly", "covert.stealth", 4, "seed:st");
  await teach("sly", "covert.theft", 4, "seed:th");
  await teach("sly", "covert.locks", 3, "seed:lk");

  // oaf: dex 8 (edge −2), no covert training at all.
  await setAttr("oaf", "dex", 8, "seed:000020");

  // hawk: int 16 (edge +6), dex 14 (edge +4), 4 teaches of covert.stealth (perception).
  await setAttr("hawk", "int", 16, "seed:000030");
  await setAttr("hawk", "dex", 14, "seed:000031");
  await teach("hawk", "covert.stealth", 4, "seed:hk");

  // mole: int 8 (edge −2), dex 8 (edge −2), no perception training.
  await setAttr("mole", "int", 8, "seed:000040");
  await setAttr("mole", "dex", 8, "seed:000041");

  // give sly a coin-purse to be lifted, and a lockpick tool.
  await place("purse-of-sly", "sly", "seed:000050"); // located-in sly = carried
  await doing({ root: world, subject: "lockpick-01", predicate: "tool", object: "lockpick", t: "seed:000060a" });
  await place("lockpick-01", "sly", "seed:000061");  // sly carries the lockpick

  // a locked chest in the hideaway, difficulty 25.
  await place("chest", "hideaway", "seed:000070");
  await doing({ root: world, subject: "chest", predicate: "locked", object: 25, t: "seed:000071" });

  // --- hide: concealment strength = covert.stealth bonus + dex edge --------------------------
  await ok("hide sets `hidden` from covert.stealth bonus + dex edge", async () => {
    // sly: taught 4 ⇒ bonus 4*5 + (16-10)*2 = 20+12 = 32; dex edge (16-10)=6 ⇒ hidden = 38.
    const { hidden } = await hide(world, "sly", "tick:1/hide:1");
    assert.equal(hidden, 38, "hidden should be stealth bonus (32) + dex edge (6)");
    assert.equal(await hiddenOf(world, "sly"), 38, "hiddenOf reads the concealment back");
    assert.equal(await isHidden(world, "sly"), true, "a positive strength means hidden");
  });

  await ok("unhide returns to visible (hidden 0)", async () => {
    await hide(world, "oaf", "tick:1/hide:2");
    const { hidden } = await unhide(world, "oaf", "tick:1/unhide:1");
    assert.equal(hidden, 0);
    assert.equal(await isHidden(world, "oaf"), false, "unhidden actor is visible");
  });

  // --- detect: high perception sees the hidden actor; low perception does not -----------------
  await ok("a high-perception observer detects the hidden actor; a low one does not", async () => {
    // sly is hidden at 38 (from the first check). hawk perception =
    //   stealth bonus 4*5 + (dex 14-10)*2 = 20+8 = 28 ... governing stat for covert is dex, so the
    //   bonus uses dex; + int edge (16-10=6) + dex edge (14-10=4) = 28 + 6 + 4 = 38 ≥ 38 → detects.
    assert.equal(await detect(world, "hawk", "sly"), true, "hawk's perception meets sly's concealment");
    // mole perception = stealth bonus 0 + int edge (8-10=-2) + dex edge (8-10=-2) = -4 < 38 → no.
    assert.equal(await detect(world, "mole", "sly"), false, "mole cannot perceive the hidden sly");
    // a visible actor (hidden 0) is always detected.
    assert.equal(await detect(world, "mole", "oaf"), true, "a visible actor is always noticed");
  });

  // --- steal: a skilled thief lifts the item (it moves); an unskilled one is caught (it stays) -
  await ok("steal SUCCEEDS for a skilled thief — the item moves to the thief", async () => {
    // sly steals from... we need a victim carrying something. Give oaf a trinket, sly lifts it.
    await place("trinket-of-oaf", "oaf", "seed:000080");
    const before = await containedBy(world, "oaf");
    assert.ok(before.includes("trinket-of-oaf"), "oaf carries the trinket to start");
    // sly sleight = theft bonus 4*5 + (16-10)*2 = 32 + dex edge 6 = 38.
    // oaf awareness = max(5, stealth bonus 0 + int edge (10-10=0)) = 5. 38 ≥ 5 → WIN.
    const r = await steal(world, "sly", "oaf", "trinket", "tick:2/steal:1");
    assert.equal(r.ok, true, "the skilled thief succeeds");
    assert.equal(r.item, "trinket-of-oaf", "itemRef resolved by substring");
    const oafNow = await containedBy(world, "oaf");
    assert.ok(!oafNow.includes("trinket-of-oaf"), "the trinket left oaf");
    const slyNow = await containedBy(world, "sly");
    assert.ok(slyNow.includes("trinket-of-oaf"), "the trinket is now carried by sly");
  });

  await ok("steal FAILS + caught for an unskilled thief — the item stays, a marker is filed", async () => {
    // oaf (no theft, dex edge -2) tries to lift sly's purse. sleight = 0 + (-2) = -2.
    // sly awareness = max(5, stealth bonus 32 + int edge 0) = 32. -2 < 32 → LOSS, caught.
    const before = await containedBy(world, "sly");
    assert.ok(before.includes("purse-of-sly"), "sly carries the purse to start");
    const r = await steal(world, "oaf", "sly", "purse", "tick:2/steal:2");
    assert.equal(r.ok, false, "the clumsy thief fails");
    assert.equal(r.caught, true, "and is caught");
    assert.equal(r.reason, "caught");
    const slyNow = await containedBy(world, "sly");
    assert.ok(slyNow.includes("purse-of-sly"), "the purse stays with sly");
    // the victim filed a `noticed` marker naming the thief.
    const v = await settle(world, "sly");
    const noticed = v.fiber.find((c) => c.predicate === "noticed" && holds(c.value))?.object;
    assert.equal(noticed, "oaf", "sly noticed oaf's fumbling attempt");
  });

  await ok("steal of a non-existent item reports no-such-item (no theft, no change)", async () => {
    const r = await steal(world, "sly", "oaf", "nonexistent", "tick:2/steal:3");
    assert.equal(r.ok, false);
    assert.equal(r.reason, "no-such-item");
  });

  // --- pick: a lockpicker opens the chest when craft meets difficulty; refuses when short ------
  await ok("pick OPENS the chest when covert.locks (with a lockpick) meets the difficulty", async () => {
    assert.equal(await isLocked(world, "chest"), true, "the chest starts locked");
    assert.equal(await lockedOf(world, "chest"), 25, "difficulty 25");
    // sly carries lockpick-01 (tool=lockpick). craft = locks bonus 3*5 + (16-10)*2 = 27 ... governing
    // stat dex (16) ⇒ bonus = 15 + 12 = 27; + lockpick tool +10 = 37 ≥ 25 → OPEN.
    const r = await pick(world, "sly", "chest", "tick:3/pick:1");
    assert.equal(r.ok, true, "the skilled, equipped picker opens it");
    assert.equal(r.locked, 0);
    assert.equal(await isLocked(world, "chest"), false, "the chest is now unlocked");
  });

  await ok("pick REFUSES when craft falls short — the lock stays", async () => {
    // a fresh, harder strongbox (difficulty 40). oaf has no locks skill and no lockpick.
    await place("strongbox", "hideaway", "seed:000090");
    await doing({ root: world, subject: "strongbox", predicate: "locked", object: 40, t: "seed:000091" });
    // oaf craft = locks bonus 0 (governing dex 8 ⇒ max(0, 0+(8-10)*2)=0) + no tool 0 = 0 < 40 → refuse.
    const r = await pick(world, "oaf", "strongbox", "tick:3/pick:2");
    assert.equal(r.ok, false, "the unskilled, unequipped picker fails");
    assert.equal(r.reason, "too-hard");
    assert.equal(r.locked, 40, "the difficulty is reported back");
    assert.equal(await isLocked(world, "strongbox"), true, "the strongbox stays locked");
  });

  // --- default export exposes the whole surface ----------------------------------------------
  await ok("the default export exposes the covert surface", async () => {
    for (const k of ["hide", "unhide", "hiddenOf", "detect", "steal", "pick", "isLocked"]) {
      assert.equal(typeof covert[k], "function", `default export carries ${k}`);
    }
  });

  console.log(`\n${pass} covert checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
