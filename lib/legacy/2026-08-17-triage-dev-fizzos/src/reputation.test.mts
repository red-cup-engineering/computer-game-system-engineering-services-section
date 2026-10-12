/**
 * Reputation: standing as the connective tissue. These name the couplings — favour discounts the
 * market, contempt closes it, hatred draws blades — and the paraconsistent invariant that you
 * cannot stand well with rival factions at once (please the marsh, anger the chapel).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, tell, numberOf } from "./world.mjs";
import { dispositionOf, priceMultiplier, shiftStanding, standingOf, willTrade } from "./reputation.mjs";
import { type Bible, loadBible } from "./world-load.mjs";
import { FizzosScene, type CommandIntent } from "./scene.mjs";

test("INVARIANT paraconsistent standing: favour with a faction is contempt from its rival", () => {
  let w = world([]);
  w = shiftStanding(w, "p", "marsh", 40); // curry favour with Morrigan's marsh-folk
  assert.equal(standingOf(w, "p", "marsh"), 40);
  assert.equal(standingOf(w, "p", "chapel"), -20, "the chapel, the marsh's rival, sours by half");
  assert.equal(dispositionOf(40), "friendly");
  assert.equal(dispositionOf(-20), "wary");
});

test("favour discounts the market; contempt refuses it", () => {
  assert.ok(priceMultiplier(80) < priceMultiplier(40) && priceMultiplier(40) < 1, "devotion is the deepest discount");
  assert.equal(priceMultiplier(-10), 1.1, "suspicion is a surcharge");
  assert.equal(willTrade(-50), false, "the hostile are turned away");
  assert.equal(willTrade(-10), true);
});

const MARKET: Bible = {
  rooms: [{ id: "market", name: "Market Row", description: "Fish and rope.", tags: ["place", "market", "shop", "outdoor"] }],
  npcs: [{ id: "greer", name: "Greer Tenn", description: "A fishwife.", location: "market", tags: ["npc", "shop", "sells:fish", "faction:fishers", "coin:200"] }],
};

const buyFish = (standing: number): number => {
  const { world: w, content } = loadBible(MARKET);
  const seed = [{ e: "greer", a: "price:fish", v: "10" }, { e: "buyer", a: "standing:fishers", v: String(standing) }];
  const s = new FizzosScene(tell(w, seed), content, "market");
  s.join("buyer", "market");
  const before = numberOf(s.currentWorld(), "buyer", "coin", 0);
  s.runTick(1, [{ k: "command", actor: "buyer", line: "buy fish" } satisfies CommandIntent]);
  return before - numberOf(s.currentWorld(), "buyer", "coin", 0); // coin actually spent
};

test("WEAVE standing→economy: a devoted friend of the fishers pays less than a stranger", () => {
  const stranger = buyFish(0);
  const friend = buyFish(80);
  assert.equal(stranger, 10, "a stranger pays the board price of 10");
  assert.equal(friend, 7, "a devoted friend pays 0.7× — 7");
  assert.ok(friend < stranger, "favour is cheaper");
});

// A lawless cove (no Watch witnesses), so these tests isolate the faction-standing mechanic from
// the crime/bounty coupling that a policed harbor would also trigger.
const QUAY: Bible = {
  rooms: [{ id: "quay", name: "A Lonely Cove", description: "Beyond the Watch's reach.", tags: ["place", "outdoor", "shore"] }],
  npcs: [
    { id: "greer", name: "Greer Tenn", description: "A fishwife.", location: "quay", tags: ["npc", "faction:fishers"] },
    { id: "mate", name: "a fisher's mate", description: "Stout.", location: "quay", tags: ["npc", "faction:fishers"] },
  ],
};

test("WEAVE attack→standing: striking a fisher sinks you with them and lifts their rival", () => {
  const { world: w, content } = loadBible(QUAY);
  const s = new FizzosScene(w, content, "quay");
  s.join("brute", "quay");
  s.runTick(1, [{ k: "command", actor: "brute", line: "attack greer" } satisfies CommandIntent]);
  assert.ok(standingOf(s.currentWorld(), "brute", "fishers") <= -25, "the assault sank the brute with the fishers");
  assert.ok(standingOf(s.currentWorld(), "brute", "watch") >= 12, "and lifted them with the watch, the fishers' rival");
});

test("WEAVE standing→PvE: a player the fishers HATE is set upon by faction members", () => {
  const { world: w, content } = loadBible(QUAY);
  // Already loathed (a brawl's worth of standing) — the fishers' own turn on sight.
  const s = new FizzosScene(tell(w, [{ e: "brute", a: "standing:fishers", v: "-50" }]), content, "quay");
  s.join("brute", "quay");
  const before = numberOf(s.currentWorld(), "brute", "health", 100);
  s.runTick(1, []); // no command — the NPCs act on their disposition
  assert.ok(numberOf(s.currentWorld(), "brute", "health", 100) < before, "hatred draws blades — PvE consequence of reputation");
});
