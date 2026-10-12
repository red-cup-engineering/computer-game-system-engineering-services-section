/**
 * The campaign — the long-horizon player arc (retention loop). These name it: stages complete from
 * the player's *own progress through the other systems* (not fetch-flags), and completing one
 * unlocks the next, automatically, with a reward.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { type CampaignView, OFF_SEASON, stageAt } from "./campaign.mjs";
import { tell, numberOf, valueOf } from "./world.mjs";
import { type Bible, loadBible } from "./world-load.mjs";
import { FizzosScene, type CommandIntent } from "./scene.mjs";

const view = (o: Partial<CampaignView>): CampaignView => ({ coin: 0, topSkill: 0, faculties: 0, ownsBuilt: false, permitResolved: false, topStanding: 0, thoughtsFixed: 0, ...o });

test("stages are thresholds read off the world, not fetch-flags", () => {
  assert.equal(OFF_SEASON.stages[0]!.done(view({ coin: 30 })), false, "60 coin not yet made");
  assert.equal(OFF_SEASON.stages[0]!.done(view({ coin: 70 })), true, "found your feet");
  assert.equal(OFF_SEASON.stages[5]!.done(view({ topStanding: 40 })), true, "a pillar of the harbor");
  assert.equal(OFF_SEASON.stages.length, 6, "a six-stage arc spanning the systems");
  assert.equal(stageAt(OFF_SEASON, 6), null, "past the last stage is completion");
});

// Seed health/condition so join treats the hero as known and preserves our seeded progress.
const known = (id: string, cells: Record<string, string>) => Object.entries({ health: "20", "max-health": "20", condition: "alive", ...cells }).map(([a, v]) => ({ e: id, a, v }));

test("WEAVE retention: crossing a stage's threshold advances the campaign and pays the reward", () => {
  const bible: Bible = { rooms: [{ id: "quay", name: "Quay", description: "Waterfront.", tags: ["place", "harbor", "outdoor"] }] };
  const { world, content } = loadBible(bible);
  const s = new FizzosScene(tell(world, known("hero", { coin: "60" })), content, "quay");
  s.join("hero", "quay");
  const { events } = s.runTick(1, []); // the campaign agent observes coin >= 60
  const text = events.filter((e) => e.k === "message" && e.to === "hero").map((e) => (e as { text: string }).text).join("\n");
  assert.match(text, /"Find Your Feet" complete/, "stage one completed from the hero's own coin");
  assert.equal(numberOf(s.currentWorld(), "hero", "campaign:off-season", 0), 1, "advanced to stage two");
  assert.equal(numberOf(s.currentWorld(), "hero", "coin", 0), 85, "the 60 coin plus the 25-coin stage reward");
});

test("WEAVE retention: a hero who has done it all wins the whole campaign in sequence", () => {
  const bible: Bible = { rooms: [{ id: "quay", name: "Quay", description: "Waterfront.", tags: ["place", "harbor", "outdoor"] }] };
  const { world, content } = loadBible(bible);
  // A veteran: monied, skilled, a Thought internalized, owns the quay, the permit settled, friend of the fishers.
  const seed = [
    ...known("vet", { coin: "200", "skill:fishing": "30", "standing:fishers": "45", "campaign:off-season": "0" }),
    { e: "vet", a: "thought:the-held-permit", v: "fixed" },
    { e: "quay", a: "owner", v: "vet" },
    { e: "the-dredging-permit", a: "decision-status", v: "granted" },
  ];
  const s = new FizzosScene(tell(world, seed), content, "quay");
  s.join("vet", "quay");
  const { events } = s.runTick(1, []);
  const text = events.filter((e) => e.k === "message" && e.to === "vet").map((e) => (e as { text: string }).text).join("\n");
  assert.match(text, /campaign is won/, "every stage cleared, the campaign is won");
  assert.equal(numberOf(s.currentWorld(), "vet", "campaign:off-season", 0), 6, "all six stages done");
  void valueOf;
});
