import test from "node:test";
import assert from "node:assert/strict";
import * as endpoints from "../src/esi/endpoints.mjs";

test("characterPublic builds the expected path", () => {
  assert.deepEqual(endpoints.characterPublic(123), { path: "/characters/123/" });
});

test("wallet and walletJournal", () => {
  assert.deepEqual(endpoints.wallet(123), { path: "/characters/123/wallet/" });
  assert.deepEqual(endpoints.walletJournal(123), { path: "/characters/123/wallet/journal/", query: {} });
  assert.deepEqual(endpoints.walletJournal(123, { page: 2 }), {
    path: "/characters/123/wallet/journal/",
    query: { page: 2 },
  });
});

test("skills, skillQueue, location, ship", () => {
  assert.deepEqual(endpoints.skills(1), { path: "/characters/1/skills/" });
  assert.deepEqual(endpoints.skillQueue(1), { path: "/characters/1/skillqueue/" });
  assert.deepEqual(endpoints.location(1), { path: "/characters/1/location/" });
  assert.deepEqual(endpoints.ship(1), { path: "/characters/1/ship/" });
});

test("assets defaults to page 1 and accepts an explicit page", () => {
  assert.deepEqual(endpoints.assets(1), { path: "/characters/1/assets/", query: { page: 1 } });
  assert.deepEqual(endpoints.assets(1, 3), { path: "/characters/1/assets/", query: { page: 3 } });
});

test("marketOrders defaults order_type to all and includes optional typeId/page", () => {
  assert.deepEqual(endpoints.marketOrders(endpoints.THE_FORGE), {
    path: "/markets/10000002/orders/",
    query: { order_type: "all" },
  });
  assert.deepEqual(endpoints.marketOrders(endpoints.THE_FORGE, { typeId: 34, page: 2 }), {
    path: "/markets/10000002/orders/",
    query: { order_type: "all", type_id: 34, page: 2 },
  });
  assert.throws(() => endpoints.marketOrders(endpoints.THE_FORGE, { orderType: "bogus" }), TypeError);
});

test("marketHistory requires regionId and typeId", () => {
  assert.deepEqual(endpoints.marketHistory(endpoints.THE_FORGE, 34), {
    path: "/markets/10000002/history/",
    query: { type_id: 34 },
  });
  assert.throws(() => endpoints.marketHistory(endpoints.THE_FORGE), TypeError);
});

test("route validates the flag and defaults to shortest", () => {
  assert.deepEqual(endpoints.route(30000142, 30002187), {
    path: "/route/30000142/30002187/",
    query: { flag: "shortest" },
  });
  assert.deepEqual(endpoints.route(30000142, 30002187, "secure"), {
    path: "/route/30000142/30002187/",
    query: { flag: "secure" },
  });
  assert.throws(() => endpoints.route(30000142, 30002187, "bogus"), TypeError);
});

test("systemKills and status take no arguments", () => {
  assert.deepEqual(endpoints.systemKills(), { path: "/universe/system_kills/" });
  assert.deepEqual(endpoints.status(), { path: "/status/" });
});

test("universeIds is a POST with a names array body", () => {
  assert.deepEqual(endpoints.universeIds(["Jita", "Amarr"]), {
    path: "/universe/ids/",
    method: "POST",
    body: ["Jita", "Amarr"],
  });
  assert.throws(() => endpoints.universeIds([]), TypeError);
  assert.throws(() => endpoints.universeIds(["ok", ""]), TypeError);
  assert.throws(() => endpoints.universeIds("not-an-array"), TypeError);
});

test("universeNames is a POST with an ids array body, capped at 1000 ids", () => {
  assert.deepEqual(endpoints.universeNames([30000142, 60003760]), {
    path: "/universe/names/",
    method: "POST",
    body: [30000142, 60003760],
  });
  assert.throws(() => endpoints.universeNames([]), TypeError);
  assert.throws(() => endpoints.universeNames([1, 0]), TypeError);
  assert.throws(() => endpoints.universeNames([1, -1]), TypeError);
  assert.throws(() => endpoints.universeNames([1, 1.5]), TypeError);
  assert.throws(() => endpoints.universeNames("not-an-array"), TypeError);
  assert.throws(() => endpoints.universeNames(Array.from({ length: 1001 }, (_, i) => i + 1)), TypeError);
  assert.doesNotThrow(() => endpoints.universeNames(Array.from({ length: 1000 }, (_, i) => i + 1)));
});

test("typeInfo, systemInfo, regionInfo, characterOrders", () => {
  assert.deepEqual(endpoints.typeInfo(34), { path: "/universe/types/34/" });
  assert.deepEqual(endpoints.systemInfo(30000142), { path: "/universe/systems/30000142/" });
  assert.deepEqual(endpoints.regionInfo(endpoints.THE_FORGE), { path: "/universe/regions/10000002/" });
  assert.deepEqual(endpoints.characterOrders(1), { path: "/characters/1/orders/" });
});

test("hub region constants and HUB_SYSTEMS map are consistent", () => {
  assert.equal(endpoints.THE_FORGE, 10000002);
  assert.equal(endpoints.DOMAIN, 10000043);
  assert.equal(endpoints.SINQ_LAISON, 10000032);
  assert.equal(endpoints.HEIMATAR, 10000030);
  assert.equal(endpoints.METROPOLIS, 10000042);
  for (const region of [endpoints.THE_FORGE, endpoints.DOMAIN, endpoints.SINQ_LAISON, endpoints.HEIMATAR, endpoints.METROPOLIS]) {
    assert.equal(typeof endpoints.HUB_SYSTEMS[region], "number");
  }
});

test("id-taking builders reject non-positive-integer input", () => {
  assert.throws(() => endpoints.characterPublic(0), TypeError);
  assert.throws(() => endpoints.characterPublic(-1), TypeError);
  assert.throws(() => endpoints.characterPublic(1.5), TypeError);
  assert.throws(() => endpoints.characterPublic("123"), TypeError);
});
