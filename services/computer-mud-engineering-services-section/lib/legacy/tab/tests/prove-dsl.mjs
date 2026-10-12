// prove-dsl — the AUTHORING DSL (library/dsl): compile a declarative world DEFINITION to EAVT,
// loadWorld it into a UNIQUE temp dir, and assert the engine reads it back through #substrate;
// plus lint catching a broken exit and an out-of-range need, and passing a good definition.
// Same tiny harness as prove-interaction.mjs.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import compile, { loadWorld, lint } from "../library/dsl/scripts/compile.mjs";
import { settle, locationOf, containedBy } from "#substrate";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );

const tmp = mkdtempSync(join(tmpdir(), "tab-dsl-"));
const world = join(tmp, "smallworld");

// A small, well-formed definition: 3 areas wired with exits, a region, an npc, a resource, item.
const good = {
  areas: [
    { id: "green", name: "the Green", biome: "town", region: "the-vale", exits: { east: "mill", south: "well" } },
    { id: "mill", name: "the Old Mill", biome: "valley", region: "the-vale", exits: { south: "well" } },
    { id: "well", name: "the Well Yard", biome: "valley", region: "the-vale", exits: {} },
  ],
  regions: [
    { id: "the-vale", name: "the Vale", contains: ["green", "mill", "well"] },
  ],
  npcs: [
    {
      id: "bram", name: "Bram Miller", home: "mill", "located-in": "mill",
      traits: ["industrious", "kind"], needs: { hunger: 70, rest: 80, recreation: 60 },
      skills: ["building"],
      intends: [{ when: { predicate: "ringing", object: "for-fog" }, do: { predicate: "tending", object: "the-bell" } }],
    },
  ],
  resources: [
    { id: "berry-thicket", name: "a berry thicket", provides: "need:hunger", "located-in": "well", amount: 12 },
  ],
  items: [
    { id: "a-hammer", name: "a worn hammer", material: "iron", quality: 40, "located-in": "mill" },
  ],
  recipes: [
    { id: "plank-recipe", name: "sawing a plank", requires: [{ predicate: "material", object: "wood" }], yields: { id: "a-plank", cells: [{ predicate: "kind", object: "item" }] } },
  ],
};

try {
  // --- compile is pure and deterministic ------------------------------------------------------
  await ok("compile is deterministic (same definition → identical rows)", async () => {
    const r1 = compile(good);
    const r2 = compile(good);
    assert.deepEqual(r1, r2);
    assert.ok(r1.length > 0, "compile should emit rows");
    // The npc carries mover=tick and a need:hunger cell, in the expected shapes.
    assert.ok(r1.some((c) => c.subject === "bram" && c.predicate === "mover" && c.object === "tick"));
    assert.ok(r1.some((c) => c.subject === "bram" && c.predicate === "need:hunger" && c.object === 70));
    // The skill is a skill:<name> = practiced cell.
    assert.ok(r1.some((c) => c.subject === "bram" && c.predicate === "skill:building" && c.object === "practiced"));
  });

  // --- lint passes the good definition --------------------------------------------------------
  await ok("lint returns NO issues for a good definition", async () => {
    const issues = lint(good);
    assert.deepEqual(issues, [], `expected no issues, got: ${JSON.stringify(issues)}`);
  });

  // --- load + read back through the substrate -------------------------------------------------
  await ok("loadWorld writes the world; it reads back through #substrate", async () => {
    const { written } = await loadWorld(world, good);
    assert.equal(written, compile(good).length, "wrote one cell per compiled row");

    // areas have their kind and naming.
    const green = await settle(world, "green");
    assert.ok(green.fiber.some((c) => c.predicate === "kind" && c.object === "area"));
    assert.ok(green.fiber.some((c) => c.predicate === "naming" && c.object === "the Green"));

    // exits are written BOTH ways: green --east--> mill implies mill --west--> green.
    assert.ok(green.fiber.some((c) => c.predicate === "exit-east" && c.object === "mill"), "green→mill east");
    const mill = await settle(world, "mill");
    assert.ok(mill.fiber.some((c) => c.predicate === "exit-west" && c.object === "green"), "mill→green west (return)");
    // green --south--> well and well --north--> green.
    const well = await settle(world, "well");
    assert.ok(well.fiber.some((c) => c.predicate === "exit-north" && c.object === "green"), "well→green north (return)");
  });

  await ok("the npc is located-in AND containedBy its area", async () => {
    assert.equal(await locationOf(world, "bram"), "mill");
    const here = await containedBy(world, "mill");
    assert.ok(here.includes("bram"), `mill should contain bram, got ${JSON.stringify(here)}`);
  });

  await ok("the resource provides its need", async () => {
    const res = await settle(world, "berry-thicket");
    assert.ok(res.fiber.some((c) => c.predicate === "provides" && c.object === "need:hunger"));
    assert.equal(await locationOf(world, "berry-thicket"), "well");
  });

  // --- lint catches a broken exit -------------------------------------------------------------
  await ok("lint flags an exit to a nonexistent area", async () => {
    const broken = { ...good, areas: [
      { id: "green", name: "the Green", exits: { east: "nowhere" } },
    ], regions: [], npcs: [], resources: [], items: [], recipes: [] };
    const issues = lint(broken);
    assert.ok(issues.some((i) => i.code === "broken-exit"), `expected broken-exit, got ${JSON.stringify(issues)}`);
  });

  // --- lint catches a need out of range -------------------------------------------------------
  await ok("lint flags a need out of 0..100", async () => {
    const bad = {
      areas: [{ id: "green", name: "the Green", exits: {} }],
      npcs: [{ id: "x", name: "X", "located-in": "green", needs: { hunger: 200 } }],
    };
    const issues = lint(bad);
    assert.ok(issues.some((i) => i.code === "need-out-of-range"), `expected need-out-of-range, got ${JSON.stringify(issues)}`);
  });

  console.log(`\n${pass} DSL checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
