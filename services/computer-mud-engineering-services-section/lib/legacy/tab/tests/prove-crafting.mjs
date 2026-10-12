// prove-crafting — crafting as FIBER FUSION (Minecraft-style; recipes are DATA). Builds Farstone
// into a UNIQUE temp dir, seeds two input items with the cells a recipe requires, then proves:
//   (a) canCraft is true with both inputs present, false with one missing;
//   (b) craft mints the output (settle shows its cells) and CONSUMES the inputs (located-in gone);
//   (c) a missing ingredient → { ok:false, missing:[...] }, NO output minted, NO inputs consumed;
//   (d) append-only: a replay (re-settle) reproduces the same residue.
// Same tiny harness as tests/prove-interaction.mjs. Module under test imported by RELATIVE path.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import doing from "#doing";
import { settle, locationOf } from "#substrate";
import buildFarstone from "./fixtures/build-fixture.mjs";
import craft, { canCraft } from "../being/doing/responding/crafting/scripts/craft.mjs";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );

const tmp = mkdtempSync(join(tmpdir(), "tab-craft-"));
const world = join(tmp, "farstone");

// the recipe under test: a plank (material:wood) + a nail (material:iron) → a wooden crate.
const recipe = {
  requires: [
    { predicate: "material", object: "wood" },
    { predicate: "material", object: "iron" },
  ],
  yields: {
    id: "a-crate",
    cells: [
      { predicate: "kind", object: "item" },
      { predicate: "naming", object: "a wooden crate" },
    ],
  },
};

// seed an input item: a kind:item with the given material, located-in a place so consumption
// (retracting located-in) is observable.
async function seedItem(id, material, place, base) {
  await doing({ root: world, subject: id, predicate: "kind", object: "item", t: `${base}/1` });
  await doing({ root: world, subject: id, predicate: "material", object: material, t: `${base}/2` });
  await doing({ root: world, subject: id, predicate: "located-in", object: place, t: `${base}/3` });
}

try {
  await buildFarstone(world);

  // --- (a) canCraft: present vs missing ------------------------------------------------------
  await ok("canCraft is FALSE before any inputs are seeded", async () => {
    assert.equal(await canCraft({ root: world, recipe, inputs: {} }), false);
  });

  await seedItem("a-plank", "wood", "the-marsh", "seed-craft:000100");

  await ok("canCraft is FALSE with only the wood input (iron missing)", async () => {
    assert.equal(await canCraft({ root: world, recipe, inputs: { "a-plank": 1 } }), false);
  });

  await seedItem("a-nail", "iron", "the-marsh", "seed-craft:000200");

  await ok("canCraft is TRUE once both wood + iron inputs are present", async () => {
    assert.equal(await canCraft({ root: world, recipe, inputs: { "a-plank": 1, "a-nail": 1 } }), true);
  });

  // --- (c) atomic failure FIRST (before consuming, so we can re-prove a clean world) ---------
  await ok("a missing ingredient → { ok:false, missing:[...] }, NO output, NO consumption", async () => {
    // try to craft with only the plank: iron requirement is unmet.
    const before = await settle(world, "a-crate");
    const r = await craft({ root: world, agent: "smith", recipe, inputs: { "a-plank": 1 }, t: "craft:fail01" });
    assert.equal(r.ok, false);
    assert.ok(Array.isArray(r.missing) && r.missing.length === 1, "exactly the iron req is missing");
    assert.equal(r.missing[0].object, "iron");
    assert.equal(r.appended.length, 0, "a failed craft writes nothing");
    // no output minted:
    const after = await settle(world, "a-crate");
    assert.equal(after.fiber.length, before.fiber.length, "no a-crate cells appeared");
    // the plank was NOT consumed:
    assert.equal(await locationOf(world, "a-plank"), "the-marsh", "the input is untouched on failure");
  });

  // --- (b) success: mint output + consume inputs ---------------------------------------------
  await ok("craft mints a-crate with its yields cells", async () => {
    const r = await craft({
      root: world, agent: "smith", recipe, inputs: { "a-plank": 1, "a-nail": 1 }, t: "tick:000900",
    });
    assert.equal(r.ok, true);
    assert.equal(r.output, "a-crate");
    const crate = await settle(world, "a-crate");
    const kind = crate.fiber.find((c) => c.predicate === "kind" && c.object === "item");
    const name = crate.fiber.find((c) => c.predicate === "naming" && c.object === "a wooden crate");
    assert.ok(kind && kind.value.glyph === "t", "a-crate is kind:item");
    assert.ok(name && name.value.glyph === "t", "a-crate is named a wooden crate");
    assert.ok(kind.observers.includes("smith"), "the mint is attributed to the agent");
  });

  await ok("craft CONSUMES the inputs (their located-in is retracted / gone)", async () => {
    assert.equal(await locationOf(world, "a-plank"), null, "the plank left its place");
    assert.equal(await locationOf(world, "a-nail"), null, "the nail left its place");
  });

  // --- (d) append-only: replay reproduces ----------------------------------------------------
  await ok("append-only: re-settling reproduces the same residue (replay-safe)", async () => {
    const a = await settle(world, "a-crate");
    const b = await settle(world, "a-crate");
    assert.deepEqual(a.fiber, b.fiber, "settle is a pure fold of the on-disk trace");
    // inputs still consumed on re-read (no hidden mutation undid the tombstone):
    assert.equal(await locationOf(world, "a-plank"), null);
    assert.equal(await locationOf(world, "a-nail"), null);
  });

  console.log(`\n${pass} crafting checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
