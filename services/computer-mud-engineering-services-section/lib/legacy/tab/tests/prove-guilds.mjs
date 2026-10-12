// prove-guilds — GUILDS: membership and the Discworld title ladder, read off settled fibers.
// Builds a tiny world by hand in a UNIQUE /tmp dir (no Farstone, no examples), drives the guild
// morphisms and #practicing directly, and asserts: joining the watch sets the membership cell (and
// debits any fee); a fresh member holds the at:0 novice title; enough skill successes raise the
// title past a threshold; a non-member has no title; a join is refused when coin < fee; leaving
// removes membership; titlesOf lists titles across two guilds.
//
// Same tiny harness as prove-comms.mjs. Standalone: run `node tests/prove-guilds.mjs`.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as pjoin } from "node:path";

import doing from "#doing";
import practice from "#practicing";
import { coinOf } from "#market";

import guilds, {
  GUILDS,
  listGuilds,
  join,
  leave,
  membershipsOf,
  titleOf,
  titlesOf,
} from "../being/doing/observing/guilds/scripts/guild.mjs";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );

const tmp = mkdtempSync(pjoin(tmpdir(), "tab-guilds-"));
const world = pjoin(tmp, "w");

// set an actor's purse to an exact penny total (FUNCTIONAL coin; latest supersedes).
const setCoin = (who, pennies, t) =>
  doing({ root: world, agent: who, subject: who, predicate: "coin", object: pennies, t });

// drill a skill to `n` successes (each success teaches; bonus = taught*5 at baseline stat).
const drill = async (who, skill, n, t) => {
  for (let i = 0; i < n; i += 1) {
    await practice({ root: world, agent: who, actor: who, skill, outcome: "success", t: `${t}:${i}` });
  }
};

try {
  // --- the table and its shape -------------------------------------------------------------
  await ok("listGuilds names every guild; default export exposes the API", async () => {
    const names = listGuilds();
    assert.ok(names.includes("watch") && names.includes("wizards") && names.includes("assassins"));
    assert.ok(names.length >= 6, "at least six guilds in the ladder");
    assert.equal(typeof guilds.join, "function");
    assert.equal(typeof guilds.titleOf, "function");
    // every guild's titles ladder is ascending and starts at:0.
    for (const n of names) {
      const t = GUILDS[n].titles;
      assert.equal(t[0].at, 0, `${n} novice rung is at:0`);
      for (let i = 1; i < t.length; i += 1) assert.ok(t[i].at > t[i - 1].at, `${n} ladder ascends`);
    }
  });

  // --- join the watch: membership cell set; watch is free, so no debit -----------------------
  await ok("join the watch sets the membership cell (free guild, no debit)", async () => {
    await doing({ root: world, agent: "vimes", subject: "vimes", predicate: "naming", object: "vimes", t: "seed:1" });
    const before = await membershipsOf(world, "vimes");
    assert.ok(!before.includes("watch"), "vimes starts outside the watch");
    const r = await join(world, "vimes", "watch", "tick:1/join");
    assert.deepEqual(r, { ok: true });
    const after = await membershipsOf(world, "vimes");
    assert.ok(after.includes("watch"), "vimes is now a member of the watch");
  });

  // --- a fresh member holds the at:0 novice title -------------------------------------------
  await ok("a fresh member's titleOf is the at:0 novice title", async () => {
    const title = await titleOf(world, "vimes", "watch");
    assert.equal(title, "Recruit", "a watch member with no fighting skill is a Recruit");
  });

  // --- skill successes raise the title past a threshold -------------------------------------
  await ok("after enough fighting successes, titleOf rises past a threshold", async () => {
    // watch Constable is at:30; bonus = taught*5 at baseline str(10), so 6 successes ⇒ bonus 30.
    await drill("vimes", "fighting", 6, "tick:2/drill");
    const title = await titleOf(world, "vimes", "watch");
    assert.equal(title, "Constable", "six fighting successes (bonus 30) lifts Recruit to Constable");
  });

  // --- a non-member has no title ------------------------------------------------------------
  await ok("a non-member has no title in a guild", async () => {
    await doing({ root: world, agent: "nobby", subject: "nobby", predicate: "naming", object: "nobby", t: "seed:2" });
    assert.equal(await titleOf(world, "nobby", "watch"), null, "non-member ⇒ null title");
    assert.equal(await titleOf(world, "vimes", "no-such-guild"), null, "unknown guild ⇒ null title");
  });

  // --- a fee debits the purse; an unaffordable fee refuses the join -------------------------
  await ok("join debits a fee and refuses when coin < fee", async () => {
    // wizards charge 150p. Give a would-be wizard only 100p first: refused, no debit, no membership.
    await doing({ root: world, agent: "rincewind", subject: "rincewind", predicate: "naming", object: "rincewind", t: "seed:3" });
    await setCoin("rincewind", 100, "tick:3/coin-a");
    const poor = await join(world, "rincewind", "wizards", "tick:3/try");
    assert.deepEqual(poor, { ok: false, reason: "cannot afford" });
    assert.equal(await coinOf(world, "rincewind"), 100, "a refused join debits nothing");
    assert.ok(!(await membershipsOf(world, "rincewind")).includes("wizards"), "no membership on refusal");
    // Now top up to 200p and join: succeeds, purse debited by the 150p fee, membership set.
    await setCoin("rincewind", 200, "tick:3/coin-b");
    const r = await join(world, "rincewind", "wizards", "tick:3/join");
    assert.deepEqual(r, { ok: true });
    assert.equal(await coinOf(world, "rincewind"), 50, "200p - 150p fee = 50p");
    assert.ok((await membershipsOf(world, "rincewind")).includes("wizards"), "now a wizard");
  });

  // --- leave removes membership -------------------------------------------------------------
  await ok("leave removes the membership (latest flag wins); title goes null", async () => {
    const r = await leave(world, "rincewind", "wizards", "tick:4/leave");
    assert.deepEqual(r, { ok: true });
    assert.ok(!(await membershipsOf(world, "rincewind")).includes("wizards"), "no longer a wizard");
    assert.equal(await titleOf(world, "rincewind", "wizards"), null, "ex-member ⇒ null title");
  });

  // --- titlesOf lists titles across two guilds ----------------------------------------------
  await ok("titlesOf lists the actor's title across each guild they belong to", async () => {
    // vimes is already a Constable in the watch. Enroll him in the (free? no) fools guild too:
    // give him coin for the 75p fee, join, then drill people to clear the Jester threshold (at:25).
    await setCoin("vimes", 100, "tick:5/coin");
    const j = await join(world, "vimes", "fools", "tick:5/join");
    assert.deepEqual(j, { ok: true });
    await drill("vimes", "people", 5, "tick:5/drill"); // bonus 25 ⇒ Jester (at:25)
    const titles = await titlesOf(world, "vimes");
    const byGuild = Object.fromEntries(titles.map((e) => [e.guild, e.title]));
    assert.equal(byGuild.watch, "Constable", "still a Constable in the watch");
    assert.equal(byGuild.fools, "Jester", "a Jester among the fools");
    assert.equal(titles.length, 2, "exactly the two guilds vimes belongs to");
  });

  console.log(`\n${pass} guild checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
