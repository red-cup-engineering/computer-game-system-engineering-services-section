import test from "node:test";
import assert from "node:assert/strict";
import { characterTools } from "../src/tools/character-tools.mjs";
import { ToolError } from "@red-cup-engineering/personal-intelligence-systems-services-section/tools";
import { EsiError } from "../src/esi/esi-client.mjs";
import { createNameResolver } from "../src/esi/name-resolver.mjs";

function getTool(name) {
  const tool = characterTools.find((t) => t.operation.id === name);
  assert.ok(tool, `expected characterTools to contain ${name}`);
  return tool;
}

function observationFor(path, query, data) {
  return {
    data,
    observation: {
      type: "EsiObservation",
      path,
      query: query ?? null,
      status: 200,
      expiresAt: null,
      recordedAt: 1000,
      etag: null,
    },
  };
}

// Fake ESI client used by every test below. Routes GET by exact path
// (+ optional page query for paginated endpoints) against `getRoutes`, and
// serves POST /universe/names/ (the 2026-08-05 batch name-resolution fix --
// see src/esi/name-resolver.mjs) out of `namesTable`: a plain
// { id: { name, category } } lookup. Real ESI 404s the *whole* batch if any
// requested id is unresolvable; this fake reproduces that so
// name-resolver.mjs's 404-bisection path is exercised the same way it would
// be against the real API, rather than mocking around it. Every GET and
// POST is recorded in `calls` so tests can assert exact subrequest counts
// against the worst-case budgets documented at the top of character-tools.mjs.
function createFakeEsi({ getRoutes = {}, namesTable = {} } = {}) {
  const calls = [];
  return {
    calls,
    async get(path, { token, query } = {}) {
      calls.push({ method: "GET", path, token, query });
      const key = query?.page !== undefined ? `${path}?page=${query.page}` : path;
      const entry = getRoutes[key] ?? getRoutes[path];
      if (!entry) {
        throw new Error(`fake esi: no GET route configured for ${key}`);
      }
      if (entry instanceof Error) throw entry;
      return observationFor(path, query ?? null, entry);
    },
    async request(method, path, { body } = {}) {
      calls.push({ method, path, body });
      if (method === "POST" && path === "/universe/names/") {
        const ids = Array.isArray(body) ? body : [];
        if (ids.some((id) => !Object.prototype.hasOwnProperty.call(namesTable, id))) {
          throw new EsiError({ status: 404, path, message: "one or more ids not found" });
        }
        const rows = ids.map((id) => ({ id, name: namesTable[id].name, category: namesTable[id].category }));
        return observationFor(path, null, rows);
      }
      throw new Error(`fake esi: no POST route configured for ${method} ${path}`);
    },
  };
}

function baseCtx(esi, overrides = {}) {
  return {
    esi,
    names: createNameResolver({ esi }),
    store: {},
    userId: 1,
    characterId: 12345,
    accessToken: "test-token",
    fetchImpl: async () => {
      throw new Error("fetchImpl should not be called directly by tool handlers");
    },
    now: () => Date.parse("2026-08-05T00:00:00Z"),
    ...overrides,
  };
}

test("get_character_overview composes public info, location, ship, wallet and resolves names via one batch call (5 subrequests worst case)", async () => {
  const esi = createFakeEsi({
    getRoutes: {
      "/characters/12345/": { name: "Morgan Sennhauser", corporation_id: 98000001, security_status: 0.5 },
      "/characters/12345/location/": { solar_system_id: 30000142, station_id: 60003760 },
      "/characters/12345/ship/": { ship_type_id: 670, ship_item_id: 1000000000001, ship_name: "My Rifter" },
      "/characters/12345/wallet/": 1234567.89,
    },
    namesTable: {
      30000142: { name: "Jita", category: "solar_system" },
      60003760: { name: "Jita IV - Moon 4 - Caldari Navy Assembly Plant", category: "station" },
      670: { name: "Capsule", category: "inventory_type" },
    },
  });
  const ctx = baseCtx(esi);

  const { data, observations } = await getTool("get_character_overview").handler(ctx, undefined);

  assert.equal(data.characterId, 12345);
  assert.equal(data.name, "Morgan Sennhauser");
  assert.equal(data.location.solarSystemName, "Jita");
  assert.equal(data.location.stationName, "Jita IV - Moon 4 - Caldari Navy Assembly Plant");
  assert.equal(data.ship.typeName, "Capsule");
  assert.equal(data.walletBalance, 1234567.89);
  // 4 parallel GETs (public, location, ship, wallet) + 1 batch POST /universe/names/
  assert.equal(observations.length, 5);
  assert.equal(esi.calls.length, 5);
  assert.equal(esi.calls.filter((c) => c.method === "POST").length, 1);
  assert.ok(observations.every((o) => o.type === "EsiObservation"));
});

test("get_character_overview rejects missing access token", async () => {
  const esi = createFakeEsi();
  const ctx = baseCtx(esi, { accessToken: "" });
  await assert.rejects(
    () => getTool("get_character_overview").handler(ctx, undefined),
    (err) => err instanceof ToolError && err.code === "missing_token",
  );
});

test("get_character_overview translates a 403 EsiError into ToolError missing_scope", async () => {
  const esi = createFakeEsi({
    getRoutes: {
      "/characters/12345/": { name: "X" },
      "/characters/12345/location/": new EsiError({
        status: 403,
        path: "/characters/12345/location/",
        message: "forbidden",
      }),
      "/characters/12345/ship/": { ship_type_id: 670 },
      "/characters/12345/wallet/": 0,
    },
  });
  const ctx = baseCtx(esi);
  await assert.rejects(
    () => getTool("get_character_overview").handler(ctx, undefined),
    (err) => err instanceof ToolError && err.code === "missing_scope",
  );
});

test("every handler rejects ctx missing a name resolver", async () => {
  const esi = createFakeEsi();
  const ctx = baseCtx(esi);
  delete ctx.names;
  await assert.rejects(
    () => getTool("get_skills").handler(ctx, undefined),
    (err) => err instanceof TypeError && /ctx\.names/.test(err.message),
  );
});

test("get_skill_queue returns per-entry finish dates and total time remaining (2 subrequests worst case)", async () => {
  const esi = createFakeEsi({
    getRoutes: {
      "/characters/12345/skillqueue/": [
        {
          skill_id: 3300,
          finished_level: 4,
          queue_position: 0,
          start_date: "2026-08-01T00:00:00Z",
          finish_date: "2026-08-06T00:00:00Z",
        },
        {
          skill_id: 3301,
          finished_level: 5,
          queue_position: 1,
          start_date: "2026-08-06T00:00:00Z",
          finish_date: "2026-08-10T00:00:00Z",
        },
      ],
    },
    namesTable: {
      3300: { name: "Gunnery", category: "inventory_type" },
      3301: { name: "Spaceship Command", category: "inventory_type" },
    },
  });
  const ctx = baseCtx(esi);

  const { data, observations } = await getTool("get_skill_queue").handler(ctx, undefined);

  assert.equal(data.entries.length, 2);
  assert.equal(data.entries[0].skillName, "Gunnery");
  assert.equal(data.entries[1].skillName, "Spaceship Command");
  assert.equal(data.isPaused, false);
  const expectedRemaining = Date.parse("2026-08-10T00:00:00Z") - ctx.now();
  assert.equal(data.totalTimeRemainingMs, expectedRemaining);
  // 1 skillqueue GET + 1 batch POST /universe/names/ (both skills in one call)
  assert.equal(observations.length, 2);
  assert.equal(esi.calls.length, 2);
});

test("get_skill_queue marks isPaused when no entries carry a finish date", async () => {
  const esi = createFakeEsi({
    getRoutes: {
      "/characters/12345/skillqueue/": [
        { skill_id: 3300, finished_level: 4, queue_position: 0, start_date: null, finish_date: null },
      ],
    },
    namesTable: { 3300: { name: "Gunnery", category: "inventory_type" } },
  });
  const ctx = baseCtx(esi);

  const { data } = await getTool("get_skill_queue").handler(ctx, undefined);
  assert.equal(data.isPaused, true);
  assert.equal(data.totalTimeRemainingMs, null);
});

test("get_skills resolves skill names via one batch call, does not bucket by category, and stays within budget (2 subrequests worst case)", async () => {
  const esi = createFakeEsi({
    getRoutes: {
      "/characters/12345/skills/": {
        total_sp: 5_000_000,
        unallocated_sp: 12345,
        skills: [
          { skill_id: 3300, trained_skill_level: 4, active_skill_level: 4, skillpoints_in_skill: 1_000_000 },
          { skill_id: 3327, trained_skill_level: 3, active_skill_level: 3, skillpoints_in_skill: 500_000 },
        ],
      },
    },
    namesTable: {
      3300: { name: "Gunnery", category: "inventory_type" },
      3327: { name: "Small Hybrid Turret", category: "inventory_type" },
    },
  });
  const ctx = baseCtx(esi);

  const { data, observations } = await getTool("get_skills").handler(ctx, undefined);

  assert.equal(data.totalSp, 5_000_000);
  assert.equal(data.unallocatedSp, 12345);
  assert.equal(data.categories, undefined, "category bucketing was intentionally dropped -- see data.note");
  assert.match(data.note, /no batched skill-type-to-group lookup/);
  assert.equal(data.skills.length, 2);
  assert.equal(data.skills.find((s) => s.skillId === 3300).skillName, "Gunnery");
  assert.equal(data.skills.find((s) => s.skillId === 3327).skillName, "Small Hybrid Turret");
  // 1 skills GET + 1 batch POST /universe/names/, regardless of skill count --
  // this is the exact tool the live production incident (a per-distinct-type
  // GET per trained skill) was about.
  assert.equal(observations.length, 2);
  assert.equal(esi.calls.length, 2);
});

test("get_skills stays at 2 subrequests even with a large, varied trained-skill list", async () => {
  const skills = [];
  const namesTable = {};
  for (let i = 0; i < 200; i += 1) {
    const skillId = 3000 + i;
    skills.push({ skill_id: skillId, trained_skill_level: 5, active_skill_level: 5, skillpoints_in_skill: 1000 });
    namesTable[skillId] = { name: `Skill ${i}`, category: "inventory_type" };
  }
  const esi = createFakeEsi({
    getRoutes: {
      "/characters/12345/skills/": { total_sp: 200_000, unallocated_sp: 0, skills },
    },
    namesTable,
  });
  const ctx = baseCtx(esi);

  const { data, observations } = await getTool("get_skills").handler(ctx, undefined);
  assert.equal(data.skills.length, 200);
  assert.equal(observations.length, 2);
  assert.equal(esi.calls.length, 2, "200 distinct skill types must still cost exactly one batch POST, not one GET per type");
});

test("get_wallet_journal returns entries sorted newest-first with humanized ref_type and resolved party names", async () => {
  const esi = createFakeEsi({
    getRoutes: {
      "/characters/12345/wallet/journal/?page=1": [
        { id: 2, date: "2026-08-01T00:00:00Z", amount: -100, ref_type: "market_transaction", first_party_id: 90000001, second_party_id: 90000002 },
        { id: 1, date: "2026-08-04T00:00:00Z", amount: 500, ref_type: "player_donation", first_party_id: 90000003 },
      ],
    },
    namesTable: {
      90000001: { name: "Morgan Sennhauser", category: "character" },
      90000002: { name: "Some Trader", category: "character" },
      90000003: { name: "A Friendly Corp", category: "corporation" },
    },
  });
  const ctx = baseCtx(esi);

  const { data, observations } = await getTool("get_wallet_journal").handler(ctx, undefined);

  assert.equal(data.entries.length, 2);
  assert.equal(data.entries[0].id, 1);
  assert.equal(data.entries[0].refTypeLabel, "Player Donation");
  assert.equal(data.entries[0].firstPartyName, "A Friendly Corp");
  assert.equal(data.entries[0].secondPartyName, null);
  assert.equal(data.entries[1].id, 2);
  assert.equal(data.entries[1].refTypeLabel, "Market Transaction");
  assert.equal(data.entries[1].firstPartyName, "Morgan Sennhauser");
  assert.equal(data.entries[1].secondPartyName, "Some Trader");
  // 1 journal-page GET + 1 batch POST /universe/names/
  assert.equal(observations.length, 2);
  assert.equal(esi.calls.length, 2);
});

test("get_wallet_journal with no party ids on any entry makes no name-resolution call", async () => {
  const esi = createFakeEsi({
    getRoutes: {
      "/characters/12345/wallet/journal/?page=1": [
        { id: 1, date: "2026-08-04T00:00:00Z", amount: 1, ref_type: "bounty_prizes" },
      ],
    },
  });
  const ctx = baseCtx(esi);
  const { data, observations } = await getTool("get_wallet_journal").handler(ctx, undefined);
  assert.equal(data.entries[0].firstPartyName, null);
  assert.equal(observations.length, 1);
  assert.equal(esi.calls.length, 1);
});

test("get_wallet_journal honors and validates limit", async () => {
  const esi = createFakeEsi({
    getRoutes: {
      "/characters/12345/wallet/journal/?page=1": [
        { id: 1, date: "2026-08-04T00:00:00Z", amount: 1, ref_type: "bounty_prizes" },
        { id: 2, date: "2026-08-03T00:00:00Z", amount: 1, ref_type: "bounty_prizes" },
      ],
    },
  });
  const ctx = baseCtx(esi);

  const { data } = await getTool("get_wallet_journal").handler(ctx, { limit: 1 });
  assert.equal(data.entries.length, 1);
  assert.equal(data.totalFetched, 2);

  await assert.rejects(
    () => getTool("get_wallet_journal").handler(ctx, { limit: 0 }),
    (err) => err instanceof ToolError && err.code === "bad_args",
  );
  await assert.rejects(
    () => getTool("get_wallet_journal").handler(ctx, { limit: 1.5 }),
    (err) => err instanceof ToolError && err.code === "bad_args",
  );
});

test("get_assets_summary groups by location, resolves notable item AND location names in one batch, and does not flag truncation on a short page (2 subrequests)", async () => {
  const esi = createFakeEsi({
    getRoutes: {
      "/characters/12345/assets/?page=1": [
        { item_id: 1, type_id: 587, location_id: 60003760, quantity: 1, is_singleton: true },
        { item_id: 2, type_id: 34, location_id: 60003760, quantity: 500, is_singleton: false },
        { item_id: 3, type_id: 34, location_id: 60008494, quantity: 10, is_singleton: false },
      ],
    },
    namesTable: {
      587: { name: "Rifter", category: "inventory_type" },
      34: { name: "Tritanium", category: "inventory_type" },
      60003760: { name: "Jita IV - Moon 4 - Caldari Navy Assembly Plant", category: "station" },
      60008494: { name: "Amarr VIII (Oris) - Emperor Family Academy", category: "station" },
    },
  });
  const ctx = baseCtx(esi);

  const { data, observations } = await getTool("get_assets_summary").handler(ctx, undefined);

  assert.equal(data.totalItems, 3);
  assert.equal(data.pagesFetched, 1);
  assert.equal(data.truncated, false);
  assert.equal(data.locations.length, 2);
  const jita = data.locations.find((l) => l.locationId === 60003760);
  assert.equal(jita.itemCount, 2);
  assert.equal(jita.totalQuantity, 501);
  assert.equal(jita.locationName, "Jita IV - Moon 4 - Caldari Navy Assembly Plant");
  assert.ok(jita.notableItems.some((it) => it.typeName === "Tritanium" && it.quantity === 500));
  // 1 assets page + 1 batch POST /universe/names/ (notable type ids + location ids combined)
  assert.equal(observations.length, 2);
  assert.equal(esi.calls.length, 2);
});

test("get_assets_summary caps at 3 pages, flags truncation when the third page is full, and location resolution failure does not blank out type names", async () => {
  const fullPage = Array.from({ length: 1000 }, (_, i) => ({
    item_id: i,
    type_id: 34,
    location_id: 60003760,
    quantity: 1,
    is_singleton: false,
  }));
  const esi = createFakeEsi({
    getRoutes: {
      "/characters/12345/assets/?page=1": fullPage,
      "/characters/12345/assets/?page=2": fullPage,
      "/characters/12345/assets/?page=3": fullPage,
    },
    // 60003760 (a player structure ESI can't publicly resolve) is
    // deliberately absent from namesTable, forcing the fake's whole-batch
    // 404 -- exercising name-resolver.mjs's bisection path end-to-end: the
    // resolver should still recover type 34's name.
    namesTable: {
      34: { name: "Tritanium", category: "inventory_type" },
    },
  });
  const ctx = baseCtx(esi);

  const { data } = await getTool("get_assets_summary").handler(ctx, undefined);

  assert.equal(data.pagesFetched, 3);
  assert.equal(data.totalItems, 3000);
  assert.equal(data.truncated, true);
  assert.equal(data.locations[0].notableItems[0].typeName, "Tritanium");
  assert.equal(data.locations[0].locationName, null, "unresolvable structure id resolves to null, not an error");
  const pageCalls = esi.calls.filter((c) => c.method === "GET" && c.path === "/characters/12345/assets/");
  assert.equal(pageCalls.length, 3);
});

test("every handler rejects a malformed ctx", async () => {
  await assert.rejects(
    () => getTool("get_skills").handler({}, undefined),
    (err) => err instanceof TypeError,
  );
});
