/**
 * The Thought Cabinet (Disco Elysium): interiority as character build — a Thought drawn from lived
 * experience, turned over across time, that permanently reshapes the faculties. These name it:
 * availability from experience, the single slot, internalization after its time, and its effects.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, tell, numberOf } from "./world.mjs";
import { type ThoughtSignals, availableThoughts, beginThought, fixingThought, internalizeStep, isFixed } from "./thoughts.mjs";

const NONE: ThoughtSignals = { season: "spring", seenContradiction: false, topSkill: 0, chapelStanding: 0, marshStanding: 0 };

test("availability is earned by experience — you cannot contemplate what you have not lived", () => {
  assert.equal(availableThoughts(world([]), "p", NONE).length, 0, "a fresh mind has no thoughts to turn over");
  const seen = availableThoughts(world([]), "p", { ...NONE, seenContradiction: true });
  assert.ok(seen.some((t) => t.id === "the-held-permit"), "witnessing the held ⊤ opens 'The Permit That Won't Resolve'");
});

test("INVARIANT one slot: you cannot turn over two thoughts at once", () => {
  const sig = { ...NONE, seenContradiction: true, topSkill: 40 };
  let w = beginThought(world([]), "p", "the-held-permit", 0, sig).world;
  assert.ok(fixingThought(w, "p")?.id === "the-held-permit", "the first thought is forming");
  const second = beginThought(w, "p", "salt-in-the-blood", 1, sig);
  assert.match(second.message, /already turning something over/, "the second is refused");
});

test("WEAVE internalize: a thought fixes after its time and permanently keens the faculties", () => {
  const sig = { ...NONE, seenContradiction: true };
  let w = beginThought(world([{ e: "p", a: "faculty:logic", v: "4" }]), "p", "the-held-permit", 0, sig).world;
  // Not yet — still forming before its 20 ticks.
  let step = internalizeStep(w, "p", 10);
  assert.equal(step.finished, null, "it has not fixed yet");
  // After its time, it internalizes and applies its effects (logic +2, inland-empire +2).
  step = internalizeStep(w, "p", 20);
  w = step.world;
  assert.equal(step.finished?.id, "the-held-permit");
  assert.ok(isFixed(w, "p", "the-held-permit"), "the thought is internalized");
  assert.equal(numberOf(w, "p", "faculty:logic", 0), 6, "Logic permanently raised 4→6");
  assert.equal(numberOf(w, "p", "faculty:inland-empire", 0), 2, "Inland Empire raised 0→2");
});

test("a thought with a cost: the off-season hardens you, trading empathy for endurance", () => {
  const sig = { ...NONE, season: "winter" };
  let w = beginThought(world([{ e: "p", a: "faculty:empathy", v: "5" }]), "p", "off-season-mind", 0, sig).world;
  w = internalizeStep(w, "p", 30).world;
  assert.equal(numberOf(w, "p", "faculty:endurance", 0), 3, "endurance gained");
  assert.equal(numberOf(w, "p", "faculty:empathy", 0), 4, "empathy paid the cost (5→4)");
});
