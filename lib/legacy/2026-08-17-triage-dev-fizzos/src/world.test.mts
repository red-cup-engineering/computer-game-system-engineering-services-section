/**
 * Engine invariants (Farstone DESIGN.md §4) — the named laws the world must preserve.
 * A mechanic without its invariant test is not earned; these earn the foundation.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  type World,
  chargeOf,
  contentsOf,
  drop,
  give,
  go,
  numberOf,
  perceive,
  placeOf,
  settledFacts,
  take,
  tell,
  valueOf,
  world,
} from "./world.mjs";

const harbor = (): World =>
  world([
    { e: "alice", a: "located-in", v: "quay" },
    { e: "bob", a: "located-in", v: "quay" },
    { e: "lantern", a: "located-in", v: "quay" },
    { e: "gull", a: "located-in", v: "cove" },
    { e: "quay", a: "name", v: "The Quay" },
  ]);

test("CONSERVATION — a thing moved is in exactly one place; the old is vacated", () => {
  let w = harbor();
  assert.equal(placeOf(w, "lantern"), "quay");
  w = take(w, "alice", "lantern");
  assert.equal(placeOf(w, "lantern"), "alice", "lantern moved into alice");
  assert.ok(!contentsOf(w, "quay").includes("lantern"), "lantern no longer on the quay");
  // the lantern is `located-in` exactly one place — never two
  const places = settledFacts(w).filter((f) => f.e === "lantern" && f.a === "located-in" && f.charge === "potential");
  assert.equal(places.length, 1, "exactly one held location");
});

test("CONSERVATION — give / drop / go are the same retraction, never duplicating", () => {
  let w = harbor();
  w = take(w, "alice", "lantern");
  w = give(w, "alice", "lantern", "bob");
  assert.equal(placeOf(w, "lantern"), "bob");
  assert.ok(!contentsOf(w, "alice").includes("lantern"), "alice no longer holds it");
  w = drop(w, "bob", "lantern");
  assert.equal(placeOf(w, "lantern"), "quay", "dropped into bob's place");
  w = go(w, "bob", "cove");
  assert.equal(placeOf(w, "bob"), "cove");
  assert.ok(!contentsOf(w, "quay").includes("bob"));
});

test("FIBER — an actor perceives only its own section, never outside it (no leak)", () => {
  const w = harbor();
  const aliceSees = new Set(perceive(w, "alice").facts.map((f) => f.e));
  assert.ok(aliceSees.has("alice") && aliceSees.has("quay") && aliceSees.has("bob") && aliceSees.has("lantern"), "sees co-located things");
  assert.ok(!aliceSees.has("gull"), "does NOT see the gull in another place — information cannot leak across fibers");
  // a secret in the cove is absent from the quay fiber by construction
  const gullSees = new Set(perceive(w, "gull").facts.map((f) => f.e));
  assert.ok(!gullSees.has("alice"), "the gull cannot see the quay either");
});

test("the world is a settled charge valuation, not a store — absent facts are absurd", () => {
  const w = harbor();
  assert.equal(chargeOf(w, "alice", "located-in", "quay"), "potential");
  assert.equal(chargeOf(w, "alice", "located-in", "mars"), "absurd", "an unasserted fact is absurd");
});

test("tell is pure — a transition returns a new world, leaving the old untouched", () => {
  const w0 = harbor();
  const w1 = take(w0, "alice", "lantern");
  assert.notEqual(w0, w1, "a new world version");
  assert.equal(placeOf(w0, "lantern"), "quay", "the prior world is unchanged");
  assert.equal(placeOf(w1, "lantern"), "alice");
});

test("functional scalar attributes are single-valued and read the latest", () => {
  let w = world([{ e: "alice", a: "health", v: "20" }]);
  w = tell(w, [{ e: "alice", a: "health", v: "12" }]);
  assert.equal(numberOf(w, "alice", "health", 0), 12, "latest health supersedes");
  assert.equal(valueOf(w, "alice", "health"), "12");
});
