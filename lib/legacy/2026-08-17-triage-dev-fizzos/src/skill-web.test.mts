/**
 * The skill web turned to 11 (Project Gorgon): everything is skillful and grows by doing, skills
 * synergize, and the inner faculties are skills too. These name the laws — tiers, synergy, and
 * use-based growth of both craft skills and the Cabinet.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, tell, numberOf } from "./world.mjs";
import { effectiveSkill, skillOf, skillTier } from "./skills.mjs";
import { facultyLevel } from "./interiority.mjs";
import { type Bible, loadBible } from "./world-load.mjs";
import { FizzosScene, type CommandIntent } from "./scene.mjs";

test("milestone tiers name every rank — a level is a felt advancement", () => {
  assert.equal(skillTier(0), "untrained");
  assert.equal(skillTier(5), "novice");
  assert.equal(skillTier(40), "journeyman");
  assert.equal(skillTier(99), "grandmaster");
});

test("INVARIANT synergy: a related skill lifts a skill's effective level (no skill stands alone)", () => {
  const w = tell(world([]), [{ e: "p", a: "skill:fighting", v: "40" }, { e: "p", a: "skill:anatomy", v: "60" }]);
  assert.equal(skillOf(w, "p", "fighting"), 40, "base fighting is unchanged");
  assert.ok(effectiveSkill(w, "p", "fighting") > 40, "but anatomy sharpens the effective blow");
  assert.ok(effectiveSkill(w, "p", "fighting") <= 100);
});

test("WEAVE faculties grow by use: reading the world keens the faculty that read it", () => {
  const bible: Bible = { rooms: [{ id: "quay", name: "Quay", description: "Granite.", tags: ["place", "harbor", "outdoor"] }] };
  const { world: w, content } = loadBible(bible);
  // Seed health (so join keeps our cabinet) and a middling Shivers that will fire on a look.
  const s = new FizzosScene(tell(w, [{ e: "the-world", a: "weather", v: "fog" }, { e: "watcher", a: "faculty:shivers", v: "5" }, { e: "watcher", a: "health", v: "20" }, { e: "watcher", a: "max-health", v: "20" }, { e: "watcher", a: "condition", v: "alive" }]), content, "quay");
  s.join("watcher", "quay");
  const before = facultyLevel(s.currentWorld(), "watcher", "shivers");
  s.runTick(1, [{ k: "command", actor: "watcher", line: "look" } satisfies CommandIntent]);
  assert.ok(facultyLevel(s.currentWorld(), "watcher", "shivers") > before, "Shivers keened from being used");
});

test("WEAVE eat is a skill: consuming food heals, trains gourmandise, and removes the food", () => {
  const bible: Bible = {
    rooms: [{ id: "quay", name: "Quay", description: "Granite.", tags: ["place", "harbor", "outdoor"] }],
    items: [{ id: "biscuit", name: "a ship's biscuit", description: "Hard tack.", location: "eater", tags: ["item", "takeable", "edible", "nutrition:5"] }],
  };
  const { world: w, content } = loadBible(bible);
  const s = new FizzosScene(tell(w, [{ e: "eater", a: "health", v: "10" }, { e: "eater", a: "max-health", v: "30" }, { e: "eater", a: "condition", v: "alive" }]), content, "quay");
  s.join("eater", "quay");
  s.runTick(1, [{ k: "command", actor: "eater", line: "eat biscuit" } satisfies CommandIntent]);
  assert.ok(numberOf(s.currentWorld(), "eater", "health", 0) > 10, "the meal restored health");
  assert.ok(skillOf(s.currentWorld(), "eater", "gourmandise") > 0, "eating trained the palate");
});
