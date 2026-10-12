/**
 * The operational computer (DESIGN.md §3, §4.4): `look` observes a fiber into a CGS
 * arena, and the sole-writer `tick` reads multiplayer fan-in as the bigraded H^1 —
 * confluent when independent, a witnessed class when contended. Never silently flattened.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { look, tick } from "./running.mjs";
import { placeOf, world } from "./world.mjs";
import type { FizzosProposal } from "./concurrency.mjs";

const scene = () =>
  world([
    { e: "alice", a: "located-in", v: "tavern" },
    { e: "bob", a: "located-in", v: "tavern" },
    { e: "lantern", a: "located-in", v: "tavern" },
  ]);

test("look — perception observes into a polarized CGS arena on real carriers", () => {
  const { perception, observation } = look(scene(), "alice");
  assert.equal(perception.place, "tavern");
  assert.equal(observation.kind, "computing.computer.observation");
  const events = observation.arena.structure.events.map((e) => e.id);
  assert.ok(events.includes("alice|located-in|tavern"), "the actor's own placement is an observed event");
});

test("H^1 — independent moves are CONFLUENT (commute, order-independent)", () => {
  const proposals: FizzosProposal[] = [
    { actor: "alice", assertions: [{ e: "alice", a: "located-in", v: "cellar" }] },
    { actor: "bob", assertions: [{ e: "bob", a: "located-in", v: "yard" }] },
  ];
  const result = tick(scene(), proposals);
  assert.equal(result.contention.confluent, true, "disjoint moves glue to a global section");
  assert.equal(placeOf(result.next, "alice"), "cellar");
  assert.equal(placeOf(result.next, "bob"), "yard");
});

test("H^1 — two actors grabbing one thing is NON-confluent and witnessed, not flattened", () => {
  const proposals: FizzosProposal[] = [
    { actor: "alice", assertions: [{ e: "lantern", a: "located-in", v: "alice" }] },
    { actor: "bob", assertions: [{ e: "lantern", a: "located-in", v: "bob" }] },
  ];
  const { contention } = tick(scene(), proposals);
  assert.equal(contention.confluent, false, "a genuine functional collision is a non-trivial H^1 class");
  assert.ok(contention.heldContradictions.includes("lantern|located-in|alice"), "both contested cells are witnessed");
  assert.ok(contention.heldContradictions.includes("lantern|located-in|bob"));
  assert.ok(contention.disagreementRank > 0, "the disagreement class is non-zero");
});

test("the tick is TOTAL — it always yields exactly one next world", () => {
  const result = tick(scene(), [
    { actor: "alice", assertions: [{ e: "lantern", a: "located-in", v: "alice" }] },
    { actor: "bob", assertions: [{ e: "lantern", a: "located-in", v: "bob" }] },
  ]);
  assert.equal(result.next.kind, "fizzos.engine.world", "one world, never a fork");
});
