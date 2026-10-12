/**
 * Scalar fields diffusing on the world graph, over `@emsenn/relating`'s exact spectral
 * geometry. Diffusion is heat flow on the room graph's Laplacian: it conserves total mass,
 * spreads from full rooms to empty neighbours, and settles to a harmonic equilibrium. The
 * spectrum also reads structure — how many disconnected regions, how resilient each is.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { atEquilibrium, connectivity, diffuse, regionCount, worldGraph } from "./fields.mjs";
import { FizzosScene } from "./scene.mjs";
import { type Bible, loadBible } from "./world-load.mjs";
import { pollutionOf } from "./ecology.mjs";
import { tell } from "./world.mjs";

// A path of three rooms: A — B — C.
const PATH = { A: ["B"], B: ["A", "C"], C: ["B"] };

test("diffusion conserves total field mass and spreads it from the source", () => {
  const wg = worldGraph(PATH);
  let field: Record<string, number> = { A: 6, B: 0, C: 0 };
  const total = (f: Record<string, number>): number => f.A! + f.B! + f.C!;
  const before = total(field);
  field = diffuse(wg, field);
  assert.ok(Math.abs(total(field) - before) < 1e-3, "total mass is conserved (Laplacian rows sum to zero)");
  assert.ok(field.A! < 6 && field.B! > 0, "the field flows from the full room to its empty neighbour");
});

test("diffusion settles to a uniform harmonic equilibrium across a connected world", () => {
  const wg = worldGraph(PATH);
  let field: Record<string, number> = { A: 6, B: 0, C: 0 };
  for (let i = 0; i < 400; i++) field = diffuse(wg, field);
  for (const id of ["A", "B", "C"] as const) assert.ok(Math.abs((field[id] ?? 0) - 2) < 0.05, `${id} approaches the even share of 2`);
  assert.ok(atEquilibrium(wg, { A: 2, B: 2, C: 2 }), "a uniform field is harmonic — at equilibrium");
  assert.ok(!atEquilibrium(wg, { A: 6, B: 0, C: 0 }), "a concentrated field is not yet harmonic");
});

test("the spectrum reads the world's structure — disconnected regions and resilience", () => {
  // Two separate edges: A–B and C–D are different regions.
  assert.equal(regionCount(worldGraph({ A: ["B"], B: ["A"], C: ["D"], D: ["C"] })), 2, "two components");
  assert.equal(regionCount(worldGraph(PATH)), 1, "a path is one region");
  // A triangle has three spanning trees; a path of three has exactly one.
  assert.equal(connectivity(worldGraph({ A: ["B", "C"], B: ["A", "C"], C: ["A", "B"] })), 3, "a triangle: three spanning trees");
  assert.equal(connectivity(worldGraph(PATH)), 1, "a path: one spanning tree");
});

test("scene: a pollution plume DIFFUSES across the connected waters", () => {
  // A dock and two connected ocean cells.
  const BIBLE: Bible = {
    rooms: [
      { id: "dock", name: "Dock", description: "A stone dock.", exits: { out: "sea-a" } },
      { id: "sea-a", name: "Near Water", description: "Water by the dock.", exits: { in: "dock", deep: "sea-b" }, tags: ["ocean"] },
      { id: "sea-b", name: "Far Water", description: "Open water.", exits: { shallow: "sea-a" }, tags: ["ocean"] },
    ],
  };
  const { world, content } = loadBible(BIBLE);
  // Seed a heavy plume on one cell directly in the world.
  const s = new FizzosScene(tell(world, [{ e: "sea-a", a: "pollution", v: "20" }]), content, "dock");
  assert.ok(pollutionOf(s.currentWorld(), "sea-a") >= 19, "the plume starts on the seeded cell");
  assert.equal(pollutionOf(s.currentWorld(), "sea-b"), 0, "the adjacent water starts clean");
  // Let the world tick: pollution flows along the exact graph-Laplacian heat flow (and the
  // ecology slowly decays it, so we read while the plume is still in the water).
  let clock = 1;
  for (let i = 0; i < 8; i++) s.runTick(clock++, []);
  assert.ok(pollutionOf(s.currentWorld(), "sea-b") > 1, "the plume spread to the neighbouring water");
  assert.ok(pollutionOf(s.currentWorld(), "sea-a") < 20, "and thinned at the source");
});
