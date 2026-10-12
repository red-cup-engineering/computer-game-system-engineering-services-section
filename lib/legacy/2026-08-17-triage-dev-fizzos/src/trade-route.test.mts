/**
 * Elite-style trade: regional price differentials a player (or NPC trader) can run. Fish is cheap
 * where it's caught and dear inland; carrying it across the island turns a profit. These name the
 * differential and the arbitrage loop.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { tell, numberOf } from "./world.mjs";
import { regionalPriceBase, WARES } from "./market.mjs";
import { type Bible, loadBible } from "./world-load.mjs";
import { FizzosScene, type CommandIntent } from "./scene.mjs";

test("INVARIANT regional differential: a good is cheap at its source and dear away from it", () => {
  const fish = WARES.fish!;
  const atQuay = regionalPriceBase(fish, ["place", "harbor", "dock"]);
  const inTown = regionalPriceBase(fish, ["place", "town", "civic"]);
  assert.ok(atQuay < fish.basePrice, "fish is cheap on the fishing waterfront");
  assert.ok(inTown > fish.basePrice, "and dear in the inland town");
  assert.ok(inTown > atQuay, "the differential exists to be traded");
});

test("WEAVE trade route: buy fish cheap at the quay, sell dear downtown — a real arbitrage", () => {
  const bible: Bible = {
    rooms: [
      { id: "quay", name: "Fish Pier", description: "Where the catch lands.", exits: { up: "town" }, tags: ["place", "harbor", "dock", "shop"] },
      { id: "town", name: "Downtown", description: "Inland, hungry for fish.", exits: { down: "quay" }, tags: ["place", "town", "civic", "shop"] },
    ],
    npcs: [
      { id: "fishwife", name: "the fishwife", description: "Sells off the boats.", location: "quay", tags: ["npc", "shop", "sells:fish", "coin:500"] },
      { id: "grocer", name: "the grocer", description: "Inland trade.", location: "town", tags: ["npc", "shop", "sells:fish", "coin:500"] },
    ],
  };
  const { world: w, content } = loadBible(bible);
  const s = new FizzosScene(tell(w, [{ e: "trader", a: "coin", v: "100" }, { e: "trader", a: "health", v: "20" }, { e: "trader", a: "max-health", v: "20" }, { e: "trader", a: "condition", v: "alive" }]), content, "quay");
  s.join("trader", "quay");
  s.runTick(0, []); // settle prices to their regional bases

  const start = numberOf(s.currentWorld(), "trader", "coin", 0);
  s.runTick(1, [{ k: "command", actor: "trader", line: "buy fish" } satisfies CommandIntent]);
  const afterBuy = numberOf(s.currentWorld(), "trader", "coin", 0);
  s.runTick(2, [{ k: "command", actor: "trader", line: "go up" } satisfies CommandIntent]);
  s.runTick(3, [{ k: "command", actor: "trader", line: "sell fish" } satisfies CommandIntent]);
  const afterSell = numberOf(s.currentWorld(), "trader", "coin", 0);

  const paid = start - afterBuy;
  const got = afterSell - afterBuy;
  assert.ok(paid > 0, "bought fish at the quay");
  assert.ok(got > paid, `sold it inland for more than it cost (paid ${paid}, got ${got}) — the route is profitable`);
});
