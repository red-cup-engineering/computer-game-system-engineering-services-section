/**
 * The recursive component topology: a whole is the inverse-limit of its nested parts, and
 * its state is FORMED from theirs by the knowledge-join. A ship's manifest is its rooms'
 * contents; a region's ecology is the bilattice-fold of its cells — so a sea where some
 * cells thrive and some are dead reads `stable`, the contested whole. The "components
 * formed from each other" the ecosystem builds everything out of, realized for the world.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateCharge, aggregateNumber, subtreeOf } from "./components.mjs";
import { world } from "./world.mjs";

test("subtree — nesting composes transitively across located-in and part-of", () => {
  // a region ⊃ cells ⊃ a ship ⊃ rooms ⊃ a crew member, by mixed morphisms
  const w = world([
    { e: "cell-a", a: "part-of", v: "region" },
    { e: "cell-b", a: "part-of", v: "region" },
    { e: "ship", a: "located-in", v: "cell-a" },
    { e: "deck", a: "part-of", v: "ship" },
    { e: "sailor", a: "located-in", v: "deck" },
  ]);
  const tree = new Set(subtreeOf(w, "region"));
  assert.ok(tree.has("cell-a") && tree.has("ship") && tree.has("deck") && tree.has("sailor"), "the whole nested diagram is in the region's subtree");
});

test("aggregateNumber — a whole's manifest is summed from its parts", () => {
  const w = world([
    { e: "fleet", a: "located-in", v: "harbor" },
    { e: "ship-1", a: "part-of", v: "fleet" }, { e: "ship-1", a: "hull", v: "8" },
    { e: "ship-2", a: "part-of", v: "fleet" }, { e: "ship-2", a: "hull", v: "18" },
  ]);
  assert.equal(aggregateNumber(w, "fleet", "hull"), 26, "the fleet's hull is the sum of its ships'");
});

test("aggregateCharge — a region thriving AND dying at once is held `stable` (inverse-limit)", () => {
  const w = world([
    { e: "alive", a: "part-of", v: "sound" }, { e: "alive", a: "ecology", v: "potential" },
    { e: "dead", a: "part-of", v: "sound" }, { e: "dead", a: "ecology", v: "active" },
  ]);
  assert.equal(aggregateCharge(w, "sound", "ecology"), "stable", "opposing cell readings glue to the contested whole");

  const healthy = world([
    { e: "c1", a: "part-of", v: "s" }, { e: "c1", a: "ecology", v: "potential" },
    { e: "c2", a: "part-of", v: "s" }, { e: "c2", a: "ecology", v: "potential" },
  ]);
  assert.equal(aggregateCharge(healthy, "s", "ecology"), "potential", "agreement reinforces");
});
