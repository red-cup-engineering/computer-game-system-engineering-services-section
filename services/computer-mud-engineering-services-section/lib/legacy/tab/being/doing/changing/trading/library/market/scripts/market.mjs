// market — money, shops, and burden read off settled fibers. `market/` nests under `trading/`
// because a purchase IS a trade leg: the bought item's `located-in` moves to the buyer (a
// `changing`, attributed to the buyer as the acquiring agent), exactly as trade.mjs files a leg.
// What market adds over a bare give/take is the COIN accounting and the WARES reading the economy
// wants: a price tag on an item, a purse of pennies on an actor, the weight an actor bears.
//
// The model is all cells, no ledger object — the accounting IS the EAVT, read by settling:
//   - `coin` on an actor is an integer of PENNIES (100 pennies = 1 dollar). FUNCTIONAL: the latest
//     coin cell is the actor's balance; debits/credits append a new total and supersede the old.
//   - `weight` on an item is an integer (absent ⇒ 1). An actor's BURDEN is the sum of the weights
//     of the items it contains (containedBy); its CAPACITY scales with `attr:str` (str * 20).
//   - `price` on an item (integer pennies) makes it a WARE when the item is contained by a shop.
//   - `attr:str` is the actor's strength attribute (absent ⇒ 10). FUNCTIONAL.
//
// Reads are pure settles; the two acts (buy/sell) move the item with `changing` and re-file the
// two purses with `changing` on `coin`. No Date.now(), no Math.random() — `t` is passed in and
// per-leg times derive deterministically from it.
//
// API:
//   coinOf(root, id) -> int pennies (default 0)            purse(pennies) -> display string (pure)
//   weightOf(root, itemId) -> int (default 1)              burdenOf(root, id) -> sum over contents
//   carryCapacity(root, id) -> attr:str * 20 (default 200) overburdened(root, id) -> burden > cap
//   priceOf(root, itemId) -> int | null                   waresOf(root, shop) -> [{id,name,price}]
//   buy(root, buyer, shop, itemId, t)  -> { ok, paid, coin } | { ok:false, reason }
//   sell(root, seller, shop, itemId, t)-> { ok, paid, coin } | { ok:false, reason }

import changing from "#changing";
import { settle, containedBy, FUNCTIONAL } from "#substrate";
import { holds } from "#value";

// MARKET_FUNCTIONAL — the substrate's functional set PLUS the per-actor money/strength cells, so
// settling an actor supersedes their coin/strength history to the LATEST value (debits and credits
// leave an append-only trail). `weight`/`price`/`naming` are read off the item's settled fiber and
// need no extra membership (we take the latest holding cell directly).
export const MARKET_FUNCTIONAL = new Set([...FUNCTIONAL, "coin", "attr:str"]);

// latestInt — the integer object of the latest holding cell for `predicate` on a settled fiber,
// or `fallback` if none holds. With a functional settle there is at most one such cell.
function latestInt(thing, predicate, fallback) {
  let best = null;
  for (const c of thing.fiber) {
    if (c.predicate !== predicate) continue;
    if (!holds(c.value)) continue;
    const n = Math.trunc(Number(c.object));
    if (Number.isNaN(n)) continue;
    best = n; // functional settle ⇒ one survivor; if more, last in sorted fiber wins deterministically
  }
  return best === null ? fallback : best;
}

// coinOf — an actor's purse in pennies (default 0), read off a money-functional settle.
export async function coinOf(root, id) {
  const thing = await settle(root, id, { functional: MARKET_FUNCTIONAL });
  return latestInt(thing, "coin", 0);
}

// purse — pure display of a penny count: `$X.YYp` once it reaches a dollar, else `Np`.
// e.g. 380 -> "$3.80p", 80 -> "80p", 100 -> "$1.00p".
export function purse(pennies) {
  const n = Math.trunc(Number(pennies)) || 0;
  if (n < 100) return `${n}p`;
  const dollars = Math.trunc(n / 100);
  const rem = n % 100;
  return `$${dollars}.${String(rem).padStart(2, "0")}p`;
}

// weightOf — an item's weight (default 1), read off its settled fiber.
export async function weightOf(root, itemId) {
  const thing = await settle(root, itemId, { functional: MARKET_FUNCTIONAL });
  return latestInt(thing, "weight", 1);
}

// burdenOf — the total weight an actor bears: the sum of weightOf over the items it contains.
export async function burdenOf(root, id) {
  const held = await containedBy(root, id);
  let total = 0;
  for (const item of held) total += await weightOf(root, item);
  return total;
}

// carryCapacity — how much weight an actor can bear: attr:str * 20 (default str 10 ⇒ 200).
export async function carryCapacity(root, id) {
  const thing = await settle(root, id, { functional: MARKET_FUNCTIONAL });
  const str = latestInt(thing, "attr:str", 10);
  return str * 20;
}

// overburdened — is the actor carrying more than it can bear?
export async function overburdened(root, id) {
  return (await burdenOf(root, id)) > (await carryCapacity(root, id));
}

// priceOf — an item's price in pennies, or null if it bears no price cell.
export async function priceOf(root, itemId) {
  const thing = await settle(root, itemId, { functional: MARKET_FUNCTIONAL });
  const p = latestInt(thing, "price", null);
  return p === null ? null : p;
}

// nameOf — the item's latest naming, falling back to its id.
async function nameOf(root, itemId) {
  const thing = await settle(root, itemId, { functional: MARKET_FUNCTIONAL });
  let name = null;
  for (const c of thing.fiber) {
    if (c.predicate === "naming" && holds(c.value)) name = c.object;
  }
  return name == null ? itemId : name;
}

// waresOf — the shop's priced wares: its contained items that bear a price cell, as
// [{ id, name, price }] sorted by id. Items without a price are not for sale.
export async function waresOf(root, shop) {
  const contained = await containedBy(root, shop);
  const wares = [];
  for (const id of contained) {
    const price = await priceOf(root, id);
    if (price === null) continue;
    wares.push({ id, name: await nameOf(root, id), price });
  }
  return wares.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

// move — relocate an item to a new holder by filing a `changing` on its located-in, attributed to
// the acquiring agent (mirrors trade.mjs's leg). The dual-filed relational row IS the accounting.
async function move(root, agent, item, to, t) {
  await changing({ root, agent, subject: item, predicate: "located-in", object: to, t });
}

// setCoin — re-file an actor's coin balance (FUNCTIONAL; the new total supersedes the old).
async function setCoin(root, agent, actor, pennies, t) {
  await changing({ root, agent, subject: actor, predicate: "coin", object: pennies, t });
}

// buy — the buyer purchases a ware from the shop. Succeeds only when the item is one of the shop's
// wares (contained by the shop AND priced) and the buyer's purse covers the price. On success the
// item moves into the buyer (a located-in change attributed to the buyer), the buyer's coin is
// debited and the shop's coin credited by the price. Returns { ok, paid, coin: newBuyerCoin }.
export async function buy(root, buyer, shop, itemId, t) {
  if (!root || buyer == null || shop == null || itemId == null || t == null) {
    throw new TypeError("buy: root, buyer, shop, itemId, t are required");
  }
  const wares = await waresOf(root, shop);
  const ware = wares.find((w) => w.id === itemId);
  if (!ware) return { ok: false, reason: "not-a-ware" };
  const price = ware.price;
  const buyerCoin = await coinOf(root, buyer);
  if (buyerCoin < price) return { ok: false, reason: "insufficient-coin" };

  // Move the item into the buyer (acquiring agent = buyer), then settle the two purses.
  await move(root, buyer, itemId, buyer, `${t}/move`);
  const newBuyerCoin = buyerCoin - price;
  const shopCoin = await coinOf(root, shop);
  await setCoin(root, buyer, buyer, newBuyerCoin, `${t}/debit`);
  await setCoin(root, shop, shop, shopCoin + price, `${t}/credit`);
  return { ok: true, paid: price, coin: newBuyerCoin };
}

// sell — the seller sells an item they CARRY to the shop. The shop pays the seller the item's
// priceOf, or a default of 1p when the item bears no price cell. The item moves into the shop, the
// seller is credited and the shop debited. SHOP-COIN POLICY: the shop's coin MAY go NEGATIVE — a
// shop's purse is a hook for downstream restocking/solvency logic, not a hard wall, so a sale never
// fails on the shop's balance. (To make insolvency a hard wall instead, guard on shopCoin >= pay.)
export async function sell(root, seller, shop, itemId, t) {
  if (!root || seller == null || shop == null || itemId == null || t == null) {
    throw new TypeError("sell: root, seller, shop, itemId, t are required");
  }
  const carried = await containedBy(root, seller);
  if (!carried.includes(itemId)) return { ok: false, reason: "not-carried" };
  const price = await priceOf(root, itemId);
  const pay = price === null ? 1 : price;

  await move(root, shop, itemId, shop, `${t}/move`);
  const sellerCoin = await coinOf(root, seller);
  const shopCoin = await coinOf(root, shop);
  const newSellerCoin = sellerCoin + pay;
  await setCoin(root, seller, seller, newSellerCoin, `${t}/credit`);
  await setCoin(root, shop, shop, shopCoin - pay, `${t}/debit`);
  return { ok: true, paid: pay, coin: newSellerCoin };
}

const market = {
  coinOf, purse, weightOf, burdenOf, carryCapacity, overburdened,
  priceOf, waresOf, buy, sell, MARKET_FUNCTIONAL,
};
export default market;

if (import.meta.url === `file://${process.argv[1]}`) {
  const [world, shop] = process.argv.slice(2);
  if (!world || !shop) {
    console.error("usage: node market.mjs <world> <shop>");
    process.exit(2);
  }
  console.log(JSON.stringify(await waresOf(world, shop), null, 2));
}
