// prove-market — MARKET: money, shops, and burden as cell-derived readings + the buy/sell acts.
// Builds a tiny world by hand in a UNIQUE /tmp dir (no examples), seeds a buyer with coin, a shop
// place holding a priced+weighed lantern, and drives the market morphism directly, asserting:
// coin reads the latest purse; purse() formats pennies; buy moves the ware and shifts both purses;
// an unaffordable buy fails with a reason and no coin change; burden sums carried weight; capacity
// scales with attr:str; waresOf lists only priced items; sell returns the lantern and pays back.
//
// Same tiny harness as prove-comms.mjs. Standalone: run `node tests/prove-market.mjs`.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import doing from "#doing";
import { containedBy } from "#substrate";

import market, {
  coinOf, purse, weightOf, burdenOf, carryCapacity, overburdened,
  priceOf, waresOf, buy, sell,
} from "../being/doing/changing/trading/library/market/scripts/market.mjs";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );

const tmp = mkdtempSync(join(tmpdir(), "tab-market-"));
const world = join(tmp, "w");

try {
  // Seed: buyer with 500p and str 15; a shop place; a-lantern in the shop, named, priced 120, wt 3.
  await doing({ root: world, subject: "buyer", predicate: "kind", object: "player", t: "seed:0001" });
  await doing({ root: world, subject: "buyer", predicate: "coin", object: 500, t: "seed:0002" });
  await doing({ root: world, subject: "buyer", predicate: "attr:str", object: 15, t: "seed:0003" });
  await doing({ root: world, subject: "buyer", predicate: "located-in", object: "the-shop", t: "seed:0004" });

  await doing({ root: world, subject: "the-shop", predicate: "kind", object: "place", t: "seed:0010" });
  await doing({ root: world, subject: "the-shop", predicate: "coin", object: 0, t: "seed:0011" });

  await doing({ root: world, subject: "a-lantern", predicate: "naming", object: "a brass lantern", t: "seed:0020" });
  await doing({ root: world, subject: "a-lantern", predicate: "price", object: 120, t: "seed:0021" });
  await doing({ root: world, subject: "a-lantern", predicate: "weight", object: 3, t: "seed:0022" });
  await doing({ root: world, subject: "a-lantern", predicate: "located-in", object: "the-shop", t: "seed:0023" });

  // an un-priced bit of clutter in the shop (must NOT appear in wares).
  await doing({ root: world, subject: "a-crate", predicate: "naming", object: "an empty crate", t: "seed:0030" });
  await doing({ root: world, subject: "a-crate", predicate: "located-in", object: "the-shop", t: "seed:0031" });

  // a pricier item the buyer can't afford.
  await doing({ root: world, subject: "a-throne", predicate: "naming", object: "a gilt throne", t: "seed:0040" });
  await doing({ root: world, subject: "a-throne", predicate: "price", object: 9000, t: "seed:0041" });
  await doing({ root: world, subject: "a-throne", predicate: "located-in", object: "the-shop", t: "seed:0042" });

  // --- purse: pure formatting ----------------------------------------------------------------
  await ok("purse formats pennies: >=100 as $X.YYp, else Np", async () => {
    assert.equal(purse(380), "$3.80p");
    assert.equal(purse(80), "80p");
    assert.equal(purse(100), "$1.00p");
    assert.equal(purse(0), "0p");
    assert.equal(purse(1205), "$12.05p");
  });

  // --- coin / weight / capacity reads --------------------------------------------------------
  await ok("coinOf reads the latest purse; default 0 for a coinless id", async () => {
    assert.equal(await coinOf(world, "buyer"), 500);
    assert.equal(await coinOf(world, "the-shop"), 0);
    assert.equal(await coinOf(world, "nobody"), 0);
  });

  await ok("weightOf reads the item weight; default 1 when absent", async () => {
    assert.equal(await weightOf(world, "a-lantern"), 3);
    assert.equal(await weightOf(world, "a-crate"), 1);
  });

  await ok("carryCapacity scales with attr:str (15 -> 300); default str 10 -> 200", async () => {
    assert.equal(await carryCapacity(world, "buyer"), 300);
    assert.equal(await carryCapacity(world, "the-shop"), 200);
  });

  await ok("priceOf returns pennies or null", async () => {
    assert.equal(await priceOf(world, "a-lantern"), 120);
    assert.equal(await priceOf(world, "a-crate"), null);
  });

  // --- waresOf: priced contents only, sorted by id -------------------------------------------
  await ok("waresOf lists only priced contained items, sorted by id", async () => {
    const wares = await waresOf(world, "the-shop");
    assert.deepEqual(wares.map((w) => w.id), ["a-lantern", "a-throne"]);
    const lantern = wares.find((w) => w.id === "a-lantern");
    assert.equal(lantern.name, "a brass lantern");
    assert.equal(lantern.price, 120);
    assert.ok(!wares.some((w) => w.id === "a-crate"), "the un-priced crate is not a ware");
  });

  // --- buy: success moves the ware and shifts both purses ------------------------------------
  await ok("buy: affordable ware -> ok, lantern moves to buyer, purses shift", async () => {
    const r = await buy(world, "buyer", "the-shop", "a-lantern", "tick:1/buy:1");
    assert.equal(r.ok, true);
    assert.equal(r.paid, 120);
    assert.equal(r.coin, 380);
    assert.equal(await coinOf(world, "buyer"), 380);     // 500 - 120
    assert.equal(await coinOf(world, "the-shop"), 120);  // 0 + 120
    const carried = await containedBy(world, "buyer");
    assert.ok(carried.includes("a-lantern"), "the lantern is now contained by the buyer");
    const shopHas = await containedBy(world, "the-shop");
    assert.ok(!shopHas.includes("a-lantern"), "the lantern left the shop");
  });

  // --- burden: sums carried weight -----------------------------------------------------------
  await ok("burdenOf reflects the carried lantern's weight (3); not overburdened", async () => {
    assert.equal(await burdenOf(world, "buyer"), 3);
    assert.equal(await overburdened(world, "buyer"), false);
  });

  // --- buy: unaffordable fails with a reason, no coin change ---------------------------------
  await ok("buy: unaffordable ware -> ok:false with reason, no coin change", async () => {
    const before = await coinOf(world, "buyer");
    const r = await buy(world, "buyer", "the-shop", "a-throne", "tick:1/buy:2");
    assert.equal(r.ok, false);
    assert.ok(r.reason, "a failure carries a reason");
    assert.equal(await coinOf(world, "buyer"), before, "the buyer's coin is unchanged");
    const carried = await containedBy(world, "buyer");
    assert.ok(!carried.includes("a-throne"), "the throne did not move");
  });

  await ok("buy: a non-ware id fails with a reason", async () => {
    const r = await buy(world, "buyer", "the-shop", "a-crate", "tick:1/buy:3");
    assert.equal(r.ok, false);
    assert.ok(r.reason);
  });

  // --- sell: the lantern back to the shop ----------------------------------------------------
  await ok("sell: carried lantern -> seller credited, lantern back in the shop", async () => {
    const sellerBefore = await coinOf(world, "buyer");   // 380
    const r = await sell(world, "buyer", "the-shop", "a-lantern", "tick:2/sell:1");
    assert.equal(r.ok, true);
    assert.equal(r.paid, 120);                            // the lantern's price
    assert.equal(r.coin, sellerBefore + 120);
    assert.equal(await coinOf(world, "buyer"), sellerBefore + 120);
    assert.equal(await coinOf(world, "the-shop"), 0);     // 120 - 120
    const shopHas = await containedBy(world, "the-shop");
    assert.ok(shopHas.includes("a-lantern"), "the lantern is back in the shop");
    const carried = await containedBy(world, "buyer");
    assert.ok(!carried.includes("a-lantern"), "the buyer no longer carries the lantern");
    assert.equal(await burdenOf(world, "buyer"), 0, "the buyer's burden drops back to 0");
  });

  await ok("sell: an uncarried item -> ok:false with reason", async () => {
    const r = await sell(world, "buyer", "the-shop", "a-throne", "tick:2/sell:2");
    assert.equal(r.ok, false);
    assert.ok(r.reason);
  });

  // default export carries the same surface.
  await ok("default export exposes the market surface", async () => {
    assert.equal(typeof market.buy, "function");
    assert.equal(market.purse(380), "$3.80p");
  });

  console.log(`\n${pass} market checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
