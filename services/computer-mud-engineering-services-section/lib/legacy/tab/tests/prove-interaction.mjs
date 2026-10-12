// prove-interaction — respond() (the universal interaction primitive), affordances (the computed
// action menu), and the playable session. Builds Farstone into a temp dir and drives the command
// handler directly (no terminal). Same tiny harness as run-spine-tests.mjs.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { truthMeet, glyph, TRUE, FALSE, BOTTOM, TOP } from "#value";
import being from "#being";
import { respond, composes } from "#responding";
import respondAt from "#responding";
import affording from "#affording";
import { settle, locationOf, containedBy } from "#substrate";
import ticking from "#ticking";
import { makeSession } from "../scripts/play.mjs";
import buildFarstone from "./fixtures/build-fixture.mjs";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );

const tmp = mkdtempSync(join(tmpdir(), "tab-ix-"));
const world = join(tmp, "farstone");

try {
  await buildFarstone(world);

  // --- truthMeet (⊙), the one new bilattice op ----------------------------------------------
  // Fiber fusion: positive evidence must agree (AND), negative accrues (OR). An action succeeds
  // only when both affirm; a denied target fails (f); a silent target is no action (⊥); an
  // already-contested target stays a situation (⊤ passes through).
  await ok("truthMeet ⊙: t⊙t=t, t⊙f=f, ⊥⊙t=⊥, f⊙f=f, ⊤⊙t=⊤", async () => {
    assert.equal(glyph(truthMeet(TRUE, TRUE)), "t");
    assert.equal(glyph(truthMeet(TRUE, FALSE)), "f");
    assert.equal(glyph(truthMeet(BOTTOM, TRUE)), "⊥");
    assert.equal(glyph(truthMeet(FALSE, FALSE)), "f");
    assert.equal(glyph(truthMeet(TOP, TRUE)), "⊤");
  });

  // --- respond / composes --------------------------------------------------------------------
  await ok("respond composes on an affirmed cell → a candidate result (t)", async () => {
    const bell = await settle(world, "a-brass-bell");
    const { results } = respond(bell, { channel: "naming" });
    assert.equal(results.length, 1);
    assert.equal(results[0].value.glyph, "t");
    assert.equal(results[0].object, "a brass harbor bell");
  });
  await ok("a silent channel composes trivially (⊥) → NOT an available action", async () => {
    const bell = await settle(world, "a-brass-bell");
    assert.equal(composes(bell, { channel: "flying" }), false);
  });
  await ok("respond surfaces a contested cell as ⊤ (the situation passes through)", async () => {
    // a being holding a cell AND its converse settles to ⊤; respond on that channel stays ⊤.
    const contested = being("p", [
      { e: "within-window", a: "has-converse", v: "overdue", t: "t0" },
      { e: "p", a: "within-window", v: "permit", t: "t1" },
      { e: "p", a: "overdue", v: "permit", t: "t2" },
    ]);
    const { results } = respond(contested, { channel: "within-window" });
    assert.equal(results[0].value.glyph, "⊤");
  });
  await ok("respondAt records the interaction, attributed to the agent", async () => {
    const { appended } = await respondAt({
      root: world, agent: "you", target: "a-clam-rake",
      message: { channel: "naming" }, t: "tick:000000/play:000001",
    });
    assert.ok(appended.length >= 1);
    const rake = await settle(world, "a-clam-rake");
    const cell = rake.fiber.find((c) => c.predicate === "naming" && c.object === "a clam rake");
    assert.ok(cell.observers.includes("you"), "the cut should be attributed to you");
  });

  // --- affordances: computed, not listed -----------------------------------------------------
  await ok("affordances compute movement + take + drop, and update with state", async () => {
    const s = makeSession({ root: world, actor: "you" });
    await s.handle("s"); // harbor-district → farston-harbor (a coil of net is here)
    let a = await affording({ root: world, actor: "you" });
    assert.ok(a.some((x) => x.verb === "go"), "should afford movement");
    assert.ok(a.some((x) => x.verb === "take" && x.object === "a-coil-of-net"), "should afford taking the net");
    assert.ok(!a.some((x) => x.verb === "drop"), "nothing carried yet");
    await s.handle("take net");
    a = await affording({ root: world, actor: "you" });
    assert.ok(!a.some((x) => x.verb === "take" && x.object === "a-coil-of-net"), "take disappears once carried");
    assert.ok(a.some((x) => x.verb === "drop" && x.object === "a-coil-of-net"), "drop appears once carried");
  });

  // --- the playable session ------------------------------------------------------------------
  await ok("session: look reports the room, exits, and occupants", async () => {
    const s = makeSession({ root: world, actor: "you" });
    const out = await s.handle("look");
    assert.match(out, /Farston Harbor|Harbor District/);
    assert.match(out, /Exits:/);
  });
  await ok("session: move + take + drop are real intra-actions", async () => {
    const s = makeSession({ root: world, actor: "you2" });
    // place a fresh player to avoid interference with earlier moves.
    const { default: doing } = await import("#doing");
    await doing({ root: world, subject: "you2", predicate: "kind", object: "player", t: "seed:900001" });
    await doing({ root: world, subject: "you2", predicate: "mover", object: "session", t: "seed:900002" });
    await doing({ root: world, subject: "you2", predicate: "located-in", object: "the-marsh", t: "seed:900003" });
    await s.handle("take rake");
    assert.equal(await locationOf(world, "a-clam-rake"), "you2");
    assert.ok((await containedBy(world, "you2")).includes("a-clam-rake"));
    await s.handle("drop rake");
    assert.equal(await locationOf(world, "a-clam-rake"), "the-marsh");
  });
  await ok("session: player moves anchor to the tick and survive ticks (replay-safe)", async () => {
    const s = makeSession({ root: world, actor: "you3" });
    const { default: doing } = await import("#doing");
    await doing({ root: world, subject: "you3", predicate: "kind", object: "player", t: "seed:910001" });
    await doing({ root: world, subject: "you3", predicate: "located-in", object: "downtown-farston", t: "seed:910002" });
    await ticking({ root: world });               // world advances
    await s.handle("e");                            // player moves to marsh-end
    await ticking({ root: world });               // and advances again
    assert.equal(await locationOf(world, "you3"), "marsh-end", "the player's move outlasts later ticks");
  });

  console.log(`\n${pass} interaction checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
