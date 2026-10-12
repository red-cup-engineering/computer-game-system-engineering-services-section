/**
 * Crime & bounty: the PvP/PvE ward. These name the geography-gated invariant (a blow is a crime
 * only where the law reaches), the escalation into Watch hatred (reusing the reputation PvE hunt),
 * and the settlement that clears it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, tell, numberOf } from "./world.mjs";
import { bountyOf, flagCrime, isLawfulArea, payBounty } from "./crime.mjs";
import { dispositionOf, standingOf } from "./reputation.mjs";
import { type Bible, loadBible } from "./world-load.mjs";
import { FizzosScene, type CommandIntent } from "./scene.mjs";

test("law is geography: the policed waterfront is lawful, the open sea is not", () => {
  assert.equal(isLawfulArea(["place", "harbor", "outdoor"]), true);
  assert.equal(isLawfulArea(["place", "ocean", "deep"]), false, "no Watch on the open sea");
});

test("INVARIANT escalation: repeated crime drives Watch standing into hatred, and paying clears it", () => {
  let w = world([{ e: "p", a: "coin", v: "500" }]);
  w = flagCrime(w, "p", "assault");
  w = flagCrime(w, "p", "assault");
  w = flagCrime(w, "p", "assault");
  assert.ok(bountyOf(w, "p") >= 45, "three assaults stack a real bounty");
  assert.equal(dispositionOf(standingOf(w, "p", "watch")), "hostile", "the Watch comes to hate the repeat offender (→ PvE hunt)");
  const { world: paid, paid: amount } = payBounty(w, "p");
  assert.ok(amount > 0 && bountyOf(paid, "p") === 0, "settling up wipes the bounty");
  assert.ok(standingOf(paid, "p", "watch") > standingOf(w, "p", "watch"), "and thaws the Watch a little");
});

test("WEAVE crime in town: striking a peaceful NPC on the quay flags a bounty; out at sea it does not", () => {
  const bible: Bible = {
    rooms: [
      { id: "quay", name: "Quay", description: "Policed granite.", exits: { sea: "deep" }, tags: ["place", "harbor", "outdoor", "dock"] },
      { id: "deep", name: "Open Sea", description: "Lawless water.", exits: { in: "quay" }, tags: ["place", "ocean", "deep"] },
    ],
    npcs: [
      { id: "pip", name: "Pip Fizzle", description: "A peaceful soul.", location: "quay", tags: ["npc", "stance:peaceful"] },
      { id: "selkie", name: "a lone bather", description: "Treading water.", location: "deep", tags: ["npc", "stance:peaceful"] },
    ],
  };
  const { world: w, content } = loadBible(bible);
  const s = new FizzosScene(w, content, "quay");
  s.join("rogue", "quay");
  s.runTick(1, [{ k: "command", actor: "rogue", line: "attack pip" } satisfies CommandIntent]);
  assert.ok(bountyOf(s.currentWorld(), "rogue") > 0, "assault on the policed quay is a crime");
  const townBounty = bountyOf(s.currentWorld(), "rogue");
  // Now go offshore and strike — beyond the law, no new bounty accrues.
  s.runTick(2, [{ k: "command", actor: "rogue", line: "go sea" } satisfies CommandIntent]);
  s.runTick(3, [{ k: "command", actor: "rogue", line: "attack bather" } satisfies CommandIntent]);
  assert.equal(bountyOf(s.currentWorld(), "rogue"), townBounty, "no Watch on the open sea — no new bounty");
});

test("self-defence is no crime: striking an aggressor does not flag a bounty", () => {
  const bible: Bible = {
    rooms: [{ id: "quay", name: "Quay", description: "Granite.", tags: ["place", "harbor", "outdoor"] }],
    npcs: [{ id: "dax", name: "Dax Pell", description: "Spoiling for a fight.", location: "quay", tags: ["npc", "stance:offensive"] }],
  };
  const { world: w, content } = loadBible(bible);
  const s = new FizzosScene(w, content, "quay");
  s.join("citizen", "quay");
  s.runTick(1, [{ k: "command", actor: "citizen", line: "attack dax" } satisfies CommandIntent]);
  assert.equal(bountyOf(s.currentWorld(), "citizen"), 0, "hitting an aggressor is self-defence, not a crime");
});

test("pay clears the bounty at a Watch member", () => {
  const bible: Bible = {
    rooms: [{ id: "town", name: "Downtown", description: "Civic.", tags: ["place", "town", "civic"] }],
    npcs: [{ id: "mara", name: "Sergeant Mara Quill", description: "The Watch.", location: "town", tags: ["npc", "faction:watch"] }],
  };
  const { world: w, content } = loadBible(bible);
  // Seed health so join treats the felon as already-known and keeps our seeded coin.
  // Coin below the campaign's first stage threshold, so no stage reward perturbs the exact figure.
  const s = new FizzosScene(tell(w, [{ e: "felon", a: "bounty", v: "20" }, { e: "felon", a: "coin", v: "40" }, { e: "felon", a: "health", v: "30" }, { e: "felon", a: "max-health", v: "30" }, { e: "felon", a: "condition", v: "alive" }]), content, "town");
  s.join("felon", "town");
  const { events } = s.runTick(1, [{ k: "command", actor: "felon", line: "pay" } satisfies CommandIntent]);
  assert.equal(bountyOf(s.currentWorld(), "felon"), 0, "the bounty is cleared");
  assert.equal(numberOf(s.currentWorld(), "felon", "coin", 0), 20, "the coin is taken (40 − 20)");
  assert.ok(events.some((e) => e.k === "message" && /clear/.test((e as { text: string }).text)));
});
