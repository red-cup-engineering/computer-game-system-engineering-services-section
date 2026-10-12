// prove-inner-life — the INNER-LIFE layer: monologue (⊤ cells as inner monologue) and voicing
// (skills as arguing voices). Builds Farstone into a UNIQUE temp dir and drives the new modules
// directly. Same tiny harness as prove-interaction.mjs. The modules under test are imported by
// RELATIVE path (they are not yet wired as #aliases).

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import being from "#being";
import doing, { declareConverse } from "#doing";
import { settle } from "#substrate";
import buildFarstone from "./fixtures/build-fixture.mjs";

import monologue, { monologueOf } from "../being/doing/observing/monologuing/scripts/monologue.mjs";
import voicing, { skillSubjectsOf, chorusLines } from "../being/doing/observing/voicing/scripts/voice.mjs";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );

const tmp = mkdtempSync(join(tmpdir(), "tab-inner-"));
const world = join(tmp, "farstone");

try {
  await buildFarstone(world);

  // --- monologue: one line per ⊤ cell, formatted, deterministically sorted -------------------
  await ok("monologue emits exactly one line for a ⊤ cell, zero for determined cells", async () => {
    // a being holding a predicate AND its converse on the same object settles to ⊤; plain cells
    // settle to t. "hero"/"wreck" are converses → the self-belief is contested.
    const harry = being("harry", [
      { e: "hero", a: "has-converse", v: "wreck", t: "t0" },
      { e: "harry", a: "hero", v: "self", t: "t1" }, // "I am a hero"
      { e: "harry", a: "wreck", v: "self", t: "t2" }, // "...and a wreck"
      { e: "harry", a: "naming", v: "the detective", t: "t3" }, // a settled (t) cell — no line
    ]);
    const heroCell = harry.fiber.find((c) => c.predicate === "hero" && c.object === "self");
    assert.equal(heroCell.value.glyph, "⊤", "hero/self should settle to ⊤");
    const lines = monologue(harry);
    assert.equal(lines.length, 1, "exactly one ⊤ cell → one monologue line");
    assert.match(lines[0], /^hero self —/, "formatted from predicate+object");
    assert.match(lines[0], /held both ways/, "names the contradiction");
    // the determined naming cell contributes nothing.
    assert.ok(!lines.some((l) => /naming|detective/.test(l)), "determined cells emit no line");
  });

  await ok("monologue: count of ⊤ cells = how torn; deterministic sort", async () => {
    const torn = being("torn", [
      { e: "hero", a: "has-converse", v: "wreck", t: "t0" },
      { e: "calm", a: "has-converse", v: "panicked", t: "t0b" },
      { e: "torn", a: "hero", v: "self", t: "t1" },
      { e: "torn", a: "wreck", v: "self", t: "t2" },
      { e: "torn", a: "calm", v: "self", t: "t3" },
      { e: "torn", a: "panicked", v: "self", t: "t4" },
    ]);
    const lines = monologue(torn);
    assert.equal(lines.length, 2, "two contradictions held");
    // deterministic: calm < hero by localeCompare of "predicate object".
    assert.deepEqual([...lines].sort(), lines, "lines are emitted in sorted order");
    assert.match(lines[0], /^calm self/);
    assert.match(lines[1], /^hero self/);
  });

  await ok("monologueOf settles from disk and agrees with monologue(settle(...))", async () => {
    // seed a contested self-belief on a fresh subject via the world + declareConverse.
    await declareConverse(world, "kim", "steady", "shaken", "seed:il0001");
    await doing({ root: world, subject: "kim", predicate: "steady", object: "self", t: "seed:il0002" });
    await doing({ root: world, subject: "kim", predicate: "shaken", object: "self", t: "seed:il0003" });
    await doing({ root: world, subject: "kim", predicate: "naming", object: "the lieutenant", t: "seed:il0004" });
    const thing = await settle(world, "kim");
    const direct = monologue(thing);
    const viaOf = await monologueOf(world, "kim");
    assert.deepEqual(viaOf, direct, "monologueOf consistent with monologue(settle)");
    assert.equal(viaOf.length, 1, "one contradiction (steady/shaken); naming is settled");
    assert.match(viaOf[0], /^steady self/);
  });

  // --- voicing: skills as arguing voices ----------------------------------------------------
  // Seed an actor with two `skill` cells pointing at two skill-beings. Each skill-being has a
  // fiber with a cell on some channel. We pose a situation on one channel and read the chorus.
  await ok("voicing: a skill bearing on the channel speaks; one that doesn't stays silent", async () => {
    // skill-being "logic": its fiber bears on the "perception" channel (asserts a reading).
    await doing({ root: world, subject: "logic", predicate: "perception", object: "a clue", t: "seed:sk0001" });
    // skill-being "rhetoric": fiber bears only on "argument" — silent for "perception".
    await doing({ root: world, subject: "rhetoric", predicate: "argument", object: "a point", t: "seed:sk0002" });
    // actor holds both skills (predicate `skill`, object = skill subject id).
    await doing({ root: world, subject: "cop", predicate: "skill", object: "logic", t: "seed:sk0010" });
    await doing({ root: world, subject: "cop", predicate: "skill", object: "rhetoric", t: "seed:sk0011" });

    const actorBeing = await settle(world, "cop");
    assert.deepEqual(skillSubjectsOf(actorBeing), ["logic", "rhetoric"], "both skills resolved, sorted");

    const chorus = await voicing({ root: world, actor: "cop", situation: { channel: "perception" } });
    // only logic bears on "perception"; rhetoric is ⊥ (dropped).
    assert.equal(chorus.length, 1, "exactly one voice speaks; the silent skill is dropped");
    assert.equal(chorus[0].skill, "logic");
    assert.equal(chorus[0].glyph, "t", "logic asserts a reading (t)");
    assert.equal(chorus[0].reading, "a clue");
    assert.ok(!chorus.some((v) => v.skill === "rhetoric"), "rhetoric stays silent (⊥), dropped");
    // formatter is pure formatting over the chorus.
    assert.deepEqual(chorusLines(chorus), ["logic asserts a clue"]);
  });

  await ok("voicing: a skill with a contested (⊤) cell on the channel argues with itself (⊤)", async () => {
    // skill-being "empathy" holds a channel cell BOTH ways → ⊤ on that channel.
    await declareConverse(world, "empathy", "feeling", "numbness", "seed:em0001");
    await doing({ root: world, subject: "empathy", predicate: "feeling", object: "their grief", t: "seed:em0002" });
    await doing({ root: world, subject: "empathy", predicate: "numbness", object: "their grief", t: "seed:em0003" });
    const empathyBeing = await settle(world, "empathy");
    const fCell = empathyBeing.fiber.find((c) => c.predicate === "feeling" && c.object === "their grief");
    assert.equal(fCell.value.glyph, "⊤", "the skill's channel cell is contested");

    // actor holds empathy via the `skill:<name>` shape (robust to either form).
    await doing({ root: world, subject: "cop2", predicate: "skill:empathy", object: "empathy", t: "seed:em0010" });
    const actorBeing = await settle(world, "cop2");
    assert.deepEqual(skillSubjectsOf(actorBeing), ["empathy"], "skill:<name> resolves to the named subject");

    const chorus = await voicing({ root: world, actor: "cop2", situation: { channel: "feeling" } });
    assert.equal(chorus.length, 1, "the contested skill is not silent — it speaks");
    assert.equal(chorus[0].glyph, "⊤", "it argues with itself (⊤)");
    assert.equal(chorus[0].reading, "their grief");
  });

  await ok("voicing: deterministic ordering and empty chorus when no skill bears", async () => {
    // pose a channel no skill bears on → silent chorus.
    const silent = await voicing({ root: world, actor: "cop", situation: { channel: "flying" } });
    assert.deepEqual(silent, [], "no voice bears → empty chorus");
    // ordering is by skill id, stable across calls.
    const a = await voicing({ root: world, actor: "cop", situation: { channel: "perception" } });
    const b = await voicing({ root: world, actor: "cop", situation: { channel: "perception" } });
    assert.deepEqual(a, b, "voicing is deterministic across calls");
  });

  console.log(`\n${pass} inner-life checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
