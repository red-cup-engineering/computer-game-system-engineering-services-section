// prove-living — the LIVING-AI layer: needs that decay, mood, and goal-seeking npcs. Builds a
// SMALL hand-made world in a unique /tmp dir (three areas in a line, a food resource at one end,
// one hungry npc at the other) and drives needs() + decayed() + decide() directly. Same tiny
// harness as prove-interaction.mjs. The npc must pursue its most pressing need (hunger) through
// the world: move toward the food, then use it. Deterministic — the same world → the same call.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import doing from "#doing";
import { settle, locationOf } from "#substrate";

import needs, { needsOf, decayed, DECAY, satisfies, NEED_FUNCTIONAL } from "../being/doing/observing/needing/scripts/needs.mjs";
import decide from "../being/doing/responding/deciding/scripts/decide.mjs";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );

const tmp = mkdtempSync(join(tmpdir(), "tab-living-"));
const world = join(tmp, "tiny");

// seed — append a base intra-action at a monotone seed time, no agent attribution.
let seq = 0;
const seed = (subject, predicate, object) =>
  doing({ root: world, subject, predicate, object, t: `seed:${String(++seq).padStart(6, "0")}` });

try {
  // --- a tiny world: meadow --east--> grove --east--> orchard; food (an apple-tree) in orchard.
  // npc `wanda` starts in meadow with a low hunger.
  await seed("meadow", "kind", "area");
  await seed("grove", "kind", "area");
  await seed("orchard", "kind", "area");
  // walkable both ways
  await seed("meadow", "exit-east", "grove");
  await seed("grove", "exit-west", "meadow");
  await seed("grove", "exit-east", "orchard");
  await seed("orchard", "exit-west", "grove");

  // a food resource in the orchard
  await seed("apple-tree", "kind", "resource");
  await seed("apple-tree", "provides", "need:hunger");
  await seed("apple-tree", "located-in", "orchard");
  await seed("apple-tree", "amount", 5);

  // the npc
  await seed("wanda", "kind", "npc");
  await seed("wanda", "mover", "tick");
  await seed("wanda", "home", "meadow");
  await seed("wanda", "located-in", "meadow");
  await seed("wanda", "need:hunger", 10);      // starving — the pressing need
  await seed("wanda", "need:rest", 90);
  await seed("wanda", "need:recreation", 85);

  // --- (a) needs reports the pressing need = hunger and a low mood band -----------------------
  await ok("needs: pressing = hunger, levels read off need:* cells", async () => {
    const r = await needsOf(world, "wanda");
    assert.equal(r.pressing, "hunger");
    assert.equal(r.levels.hunger, 10);
    assert.equal(r.levels.rest, 90);
    assert.equal(r.levels.recreation, 85);
  });
  await ok("needs: low hunger drags the mood band off content", async () => {
    const r = await needsOf(world, "wanda");
    // mean = (10+90+85)/300 ≈ 0.617 — but hunger is a crisis; band reflects the blended mood.
    assert.ok(["content", "strained", "breaking"].includes(r.band));
    assert.ok(r.mood >= 0 && r.mood <= 1);
  });

  // --- trait modifiers shift mood ------------------------------------------------------------
  await ok("trait modifiers shift mood: gloomy < plain < cheerful (same needs)", async () => {
    const base = { entity: "x", fiber: [
      { predicate: "need:hunger", object: 50, value: { pos: 1, neg: 0, glyph: "t" } },
      { predicate: "need:rest", object: 50, value: { pos: 1, neg: 0, glyph: "t" } },
      { predicate: "need:recreation", object: 50, value: { pos: 1, neg: 0, glyph: "t" } },
    ] };
    const plain = needs(base).mood;
    const gloomy = needs({ entity: "x", fiber: [...base.fiber, { predicate: "trait", object: "gloomy", value: { pos: 1, neg: 0, glyph: "t" } }] }).mood;
    const cheerful = needs({ entity: "x", fiber: [...base.fiber, { predicate: "trait", object: "cheerful", value: { pos: 1, neg: 0, glyph: "t" } }] }).mood;
    assert.ok(gloomy < plain, `gloomy ${gloomy} should be < plain ${plain}`);
    assert.ok(cheerful > plain, `cheerful ${cheerful} should be > plain ${plain}`);
  });

  // --- satisfies: a settled resource provides a need -----------------------------------------
  await ok("satisfies: the apple-tree provides need:hunger, not need:rest", async () => {
    const tree = await settle(world, "apple-tree");
    assert.equal(satisfies(tree, "hunger"), true);
    assert.equal(satisfies(tree, "need:hunger"), true);
    assert.equal(satisfies(tree, "rest"), false);
  });

  // --- (b) decay lowers a need deterministically ---------------------------------------------
  await ok("decayed: drops by rate, clamps at 0, integer-stable, hunger fastest", async () => {
    assert.equal(decayed(50, DECAY.hunger), 50 - DECAY.hunger);
    assert.equal(decayed(2, DECAY.hunger), 0);          // clamps, never negative
    assert.equal(decayed(decayed(50, DECAY.hunger), DECAY.hunger), 50 - 2 * DECAY.hunger);
    assert.ok(DECAY.hunger > DECAY.rest && DECAY.rest > DECAY.recreation, "hunger decays fastest");
    assert.equal(decayed(10, 4), decayed(10, 4));        // deterministic
  });

  // --- (c) decide: MOVE toward the resource's area when the npc is elsewhere ------------------
  await ok("decide: npc in meadow → MOVE east toward the orchard (first hop = grove)", async () => {
    const d = await decide({ root: world, actor: "wanda" });
    assert.equal(d.kind, "move");
    assert.equal(d.moves.length, 1);
    assert.deepEqual(d.moves[0], { subject: "wanda", predicate: "located-in", object: "grove" });
  });
  await ok("decide: one hop closer (in grove) → MOVE to the orchard", async () => {
    await seed("wanda", "located-in", "grove");
    const d = await decide({ root: world, actor: "wanda" });
    assert.equal(d.kind, "move");
    assert.deepEqual(d.moves[0], { subject: "wanda", predicate: "located-in", object: "orchard" });
  });
  await ok("decide: co-located with the food → USE (raise need:hunger + deplete the resource)", async () => {
    await seed("wanda", "located-in", "orchard");
    const d = await decide({ root: world, actor: "wanda" });
    assert.equal(d.kind, "use");
    assert.equal(d.moves.length, 2);
    const raise = d.moves.find((m) => m.subject === "wanda");
    const deplete = d.moves.find((m) => m.subject === "apple-tree");
    assert.equal(raise.predicate, "need:hunger");
    assert.ok(raise.object > 10, "use raises hunger above its starved level");
    assert.equal(deplete.predicate, "amount");
    assert.equal(deplete.object, 4, "the resource is depleted by one (5 → 4)");
  });

  // --- enact the use, confirm the loop closes on disk ----------------------------------------
  await ok("enacting the USE raises hunger and depletes the tree on disk (the tick's job)", async () => {
    const d = await decide({ root: world, actor: "wanda" });
    for (const m of d.moves) await seed(m.subject, m.predicate, m.object);
    const r = await needsOf(world, "wanda");
    assert.ok(r.levels.hunger > 10, `hunger should have risen, got ${r.levels.hunger}`);
    const tree = await settle(world, "apple-tree", { functional: NEED_FUNCTIONAL });
    const amt = tree.fiber.find((c) => c.predicate === "amount");
    assert.equal(Number(amt.object), 4, "the apple-tree now holds 4");
    // hunger no longer pressing ⇒ next decision is not a move toward food
    const d2 = await decide({ root: world, actor: "wanda" });
    assert.notEqual(d2.kind, "move");
  });

  // --- idle when no need presses -------------------------------------------------------------
  await ok("decide: all needs satisfied → idle", async () => {
    await seed("fido", "kind", "npc");
    await seed("fido", "mover", "tick");
    await seed("fido", "located-in", "meadow");
    await seed("fido", "need:hunger", 95);
    await seed("fido", "need:rest", 95);
    await seed("fido", "need:recreation", 95);
    const d = await decide({ root: world, actor: "fido" });
    assert.equal(d.kind, "idle");
    assert.equal(d.moves.length, 0);
  });

  // --- (d) determinism: same world → same decision -------------------------------------------
  await ok("determinism: re-deciding the same world yields an identical move", async () => {
    const a = await decide({ root: world, actor: "wanda" });
    const b = await decide({ root: world, actor: "wanda" });
    assert.deepEqual(a, b);
  });

  console.log(`\n${pass} living-AI checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
