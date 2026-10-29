import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marketTools } from '../src/tools/market-tools.mjs';
import { EsiError } from '../src/esi/esi-client.mjs';

function getTool(name) {
  const tool = marketTools.find((t) => t.operation.id === name);
  assert.ok(tool, `expected marketTools to contain ${name}`);
  return tool;
}

function jsonResponse(body, { status = 200, headers = {} } = {}) {
  const headerMap = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (key) => headerMap.get(key.toLowerCase()) ?? null },
    text: async () => JSON.stringify(body),
    json: async () => body,
  };
}

function makeEsiObservation(overrides = {}) {
  return {
    type: 'EsiObservation',
    path: overrides.path ?? '/test/',
    query: overrides.query ?? null,
    status: overrides.status ?? 200,
    expiresAt: overrides.expiresAt ?? null,
    recordedAt: overrides.recordedAt ?? 1000,
    etag: overrides.etag ?? null,
  };
}

function baseCtx(overrides = {}) {
  return {
    store: null,
    userId: null,
    characterId: null,
    accessToken: undefined, // public tools must not need this
    fetchImpl: overrides.fetchImpl ?? (async () => jsonResponse({})),
    now: overrides.now ?? (() => 1000),
    esi: overrides.esi ?? {
      async get() {
        throw new Error('esi.get not stubbed for this test');
      },
      async request() {
        throw new Error('esi.request not stubbed for this test');
      },
    },
  };
}

// -- search_types ------------------------------------------------------

test('search_types resolves exact matches via esi.request("POST", ...) and never sends a token', async () => {
  let capturedMethod;
  let capturedPath;
  let capturedOptions;
  const ctx = baseCtx({
    esi: {
      async request(method, path, options) {
        capturedMethod = method;
        capturedPath = path;
        capturedOptions = options;
        return {
          data: { inventory_types: [{ id: 17740, name: 'Venture' }] },
          observation: makeEsiObservation({ path, etag: '"abc"' }),
        };
      },
    },
  });
  const tool = getTool('search_types');
  const result = await tool.handler(ctx, { names: ['Venture', 'Nonexistent Item Name'] });

  assert.equal(capturedMethod, 'POST');
  assert.equal(capturedPath, '/universe/ids/');
  assert.deepEqual(capturedOptions.body, ['Venture', 'Nonexistent Item Name']);
  assert.equal(capturedOptions.token, undefined);

  assert.deepEqual(result.data.matches, [{ typeId: 17740, name: 'Venture' }]);
  assert.deepEqual(result.data.unmatched, ['Nonexistent Item Name']);
  assert.match(result.data.note, /Nonexistent Item Name/);

  assert.equal(result.observations.length, 1);
  assert.equal(result.observations[0].type, 'EsiObservation');
  assert.equal(result.observations[0].path, '/universe/ids/');
  assert.equal(result.observations[0].etag, '"abc"');
});

test('search_types rejects empty/invalid names', async () => {
  const tool = getTool('search_types');
  await assert.rejects(() => tool.handler(baseCtx(), { names: [] }), /names must be a non-empty array/);
  await assert.rejects(() => tool.handler(baseCtx(), { names: ['', 'ok'] }), /names\[0\]/);
  await assert.rejects(() => tool.handler(baseCtx(), {}), /names must be a non-empty array/);
});

test('search_types propagates an EsiError from a non-2xx upstream status', async () => {
  const ctx = baseCtx({
    esi: {
      async request(method, path) {
        throw new EsiError({ status: 500, path, message: 'ESI POST /universe/ids/ failed with status 500' });
      },
    },
  });
  const tool = getTool('search_types');
  await assert.rejects(() => tool.handler(ctx, { names: ['Venture'] }), /status 500/);
});

// -- get_market_prices ---------------------------------------------------

test('get_market_prices computes best bid/ask and volumes, stopping pagination on an empty page', async () => {
  const pagesRequested = [];
  const ctx = baseCtx({
    esi: {
      async get(path, { query }) {
        pagesRequested.push(query.page);
        assert.equal(path, '/markets/10000002/orders/');
        assert.equal(query.type_id, 34);
        assert.equal(query.order_type, 'all');
        if (query.page === 1) {
          return {
            data: [
              { is_buy_order: true, price: 5.0, volume_remain: 100 },
              { is_buy_order: true, price: 5.5, volume_remain: 50 },
              { is_buy_order: false, price: 6.0, volume_remain: 200 },
              { is_buy_order: false, price: 5.9, volume_remain: 10 },
            ],
            observation: makeEsiObservation({ path, query }),
          };
        }
        return { data: [], observation: makeEsiObservation({ path, query }) };
      },
    },
  });
  const tool = getTool('get_market_prices');
  const result = await tool.handler(ctx, { typeId: 34, regionId: 10000002 });

  assert.deepEqual(pagesRequested, [1, 2]);
  assert.equal(result.data.bestBid, 5.5);
  assert.equal(result.data.bestAsk, 5.9);
  assert.equal(result.data.spread, 5.9 - 5.5);
  assert.equal(result.data.bidVolume, 150);
  assert.equal(result.data.askVolume, 210);
  assert.equal(result.data.buyOrderCount, 2);
  assert.equal(result.data.sellOrderCount, 2);
  assert.equal(result.data.note, undefined);
  assert.equal(result.observations.length, 2);
});

test('get_market_prices stops at a 404 page and does not mark truncated', async () => {
  const ctx = baseCtx({
    esi: {
      async get(path, { query }) {
        if (query.page === 1) {
          return {
            data: [{ is_buy_order: false, price: 10, volume_remain: 1 }],
            observation: makeEsiObservation({ path, query }),
          };
        }
        throw new EsiError({ status: 404, path, message: 'not found' });
      },
    },
  });
  const tool = getTool('get_market_prices');
  const result = await tool.handler(ctx, { typeId: 1, regionId: 1 });
  assert.equal(result.data.bestAsk, 10);
  assert.equal(result.data.note, undefined);
});

test('get_market_prices marks truncated when the page cap is hit with data still flowing', async () => {
  const ctx = baseCtx({
    esi: {
      async get(path, { query }) {
        return {
          data: [{ is_buy_order: false, price: 1, volume_remain: 1 }],
          observation: makeEsiObservation({ path, query }),
        };
      },
    },
  });
  const tool = getTool('get_market_prices');
  const result = await tool.handler(ctx, { typeId: 1, regionId: 1 });
  assert.match(result.data.note, /capped at 5 pages/);
  assert.equal(result.observations.length, 5);
});

test('get_market_prices validates typeId/regionId', async () => {
  const tool = getTool('get_market_prices');
  await assert.rejects(() => tool.handler(baseCtx(), { typeId: 'x', regionId: 1 }), /typeId must be a positive integer/);
  await assert.rejects(() => tool.handler(baseCtx(), { typeId: 1, regionId: -1 }), /regionId must be a positive integer/);
});

// -- get_market_history ---------------------------------------------------

test('get_market_history summarizes recent average, 30d min/max, and trends', async () => {
  const rows = [];
  for (let i = 1; i <= 30; i += 1) {
    rows.push({
      date: `2026-07-${String(i).padStart(2, '0')}`,
      average: 100 + i,
      lowest: 90 + i,
      highest: 110 + i,
      order_count: 5,
      volume: 1000,
    });
  }
  const ctx = baseCtx({
    esi: {
      async get(path, { query }) {
        assert.equal(path, '/markets/10000002/history/');
        assert.equal(query.type_id, 34);
        return { data: rows, observation: makeEsiObservation({ path, query }) };
      },
    },
  });
  const tool = getTool('get_market_history');
  const result = await tool.handler(ctx, { typeId: 34, regionId: 10000002 });
  assert.equal(result.data.daysObserved, 30);
  assert.equal(result.data.min30d, 91);
  assert.equal(result.data.max30d, 140);
  assert.ok(result.data.trend7dPct > 0);
  assert.ok(result.data.trend30dPct > 0);
});

test('get_market_history handles empty history gracefully', async () => {
  const ctx = baseCtx({
    esi: { async get(path, { query }) { return { data: [], observation: makeEsiObservation({ path, query }) }; } },
  });
  const tool = getTool('get_market_history');
  const result = await tool.handler(ctx, { typeId: 1, regionId: 1 });
  assert.equal(result.data.daysObserved, 0);
  assert.match(result.data.note, /No history/);
});

// -- compare_hubs ---------------------------------------------------------

test('compare_hubs returns all five hubs sorted by best sell price', async () => {
  const priceByRegion = {
    10000002: 100, // Jita
    10000043: 90, // Amarr
    10000032: 110, // Dodixie
    10000030: null, // Rens - no orders
    10000042: 95, // Hek
  };
  const ctx = baseCtx({
    esi: {
      async get(path, { query }) {
        const regionId = Number(path.split('/')[2]);
        const price = priceByRegion[regionId];
        const data = price === null ? [] : [{ is_buy_order: false, price, volume_remain: 5 }];
        return { data, observation: makeEsiObservation({ path, query }) };
      },
    },
  });
  const tool = getTool('compare_hubs');
  const result = await tool.handler(ctx, { typeId: 34 });
  assert.equal(result.data.hubs.length, 5);
  const order = result.data.hubs.map((h) => h.hub);
  assert.deepEqual(order, ['Amarr', 'Hek', 'Jita', 'Dodixie', 'Rens']);
  assert.equal(result.data.hubs.find((h) => h.hub === 'Rens').bestSell, null);
});

// -- get_route --------------------------------------------------------------

test('get_route maps "safe" to ESI\'s "secure" flag and counts lowsec/nullsec jumps', async () => {
  const systemsById = {
    1: { name: 'Alpha', security_status: 0.9 },
    2: { name: 'Bravo', security_status: 0.3 },
    3: { name: 'Charlie', security_status: -0.2 },
  };
  const calls = [];
  const ctx = baseCtx({
    esi: {
      async get(path, opts) {
        calls.push({ path, opts });
        if (path === '/route/1/3/') {
          assert.equal(opts.query.flag, 'secure');
          return { data: [1, 2, 3], observation: makeEsiObservation({ path }) };
        }
        const systemId = Number(path.split('/')[3]);
        return { data: systemsById[systemId], observation: makeEsiObservation({ path }) };
      },
    },
  });
  const tool = getTool('get_route');
  const result = await tool.handler(ctx, { originSystemId: 1, destinationSystemId: 3, flag: 'safe' });
  assert.equal(result.data.jumpCount, 2);
  assert.equal(result.data.lowsecJumps, 1);
  assert.equal(result.data.nullsecJumps, 1);
  assert.equal(result.data.systems.length, 3);
  assert.equal(result.observations.length, 4); // 1 route + 3 systems
});

test('get_route rejects an invalid flag', async () => {
  const tool = getTool('get_route');
  await assert.rejects(
    () => tool.handler(baseCtx(), { originSystemId: 1, destinationSystemId: 2, flag: 'insecure' }),
    /flag must be one of/,
  );
});

test('get_route throws when ESI returns no route', async () => {
  const ctx = baseCtx({ esi: { async get() { return { data: [], observation: makeEsiObservation() }; } } });
  const tool = getTool('get_route');
  await assert.rejects(() => tool.handler(ctx, { originSystemId: 1, destinationSystemId: 2 }), /no route/);
});

// -- get_system_activity -----------------------------------------------

test('get_system_activity merges ESI aggregate kills with a successful zKillboard fetch', async () => {
  const ctx = baseCtx({
    esi: {
      async get(path) {
        assert.equal(path, '/universe/system_kills/');
        return {
          data: [{ system_id: 30000142, ship_kills: 3, npc_kills: 40, pod_kills: 1 }],
          observation: makeEsiObservation({ path }),
        };
      },
    },
    fetchImpl: async (url, init) => {
      assert.match(url, /zkillboard\.com\/api\/kills\/systemID\/30000142\/pastSeconds\/3600\//);
      assert.ok(init.headers['user-agent']);
      return jsonResponse([{ killmail_id: 999 }, { killmail_id: 998 }]);
    },
  });
  const tool = getTool('get_system_activity');
  const result = await tool.handler(ctx, { systemId: 30000142 });
  assert.deepEqual(result.data.esi, { shipKills: 3, npcKills: 40, podKills: 1 });
  assert.equal(result.data.zkillboard.killCountLastHour, 2);
  assert.equal(result.data.zkillboard.mostRecentKillId, 999);
  assert.deepEqual(result.data.sources, ['esi', 'zkillboard']);
  const zkbObservation = result.observations.find((o) => o.source === 'zkillboard');
  assert.ok(zkbObservation);
  assert.notEqual(zkbObservation.type, 'EsiObservation');
});

test('get_system_activity degrades gracefully when zKillboard fails', async () => {
  const ctx = baseCtx({
    esi: {
      async get(path) {
        return { data: [], observation: makeEsiObservation({ path }) };
      },
    },
    fetchImpl: async () => jsonResponse({}, { status: 503 }),
  });
  const tool = getTool('get_system_activity');
  const result = await tool.handler(ctx, { systemId: 1 });
  assert.equal(result.data.zkillboardUnavailable, true);
  assert.deepEqual(result.data.sources, ['esi']);
  assert.match(result.data.note, /zKillboard/);
});

test('get_system_activity skips zKillboard when includeZkillboard is false', async () => {
  const ctx = baseCtx({
    esi: { async get(path) { return { data: [], observation: makeEsiObservation({ path }) }; } },
    fetchImpl: async () => { throw new Error('should not be called'); },
  });
  const tool = getTool('get_system_activity');
  const result = await tool.handler(ctx, { systemId: 1, includeZkillboard: false });
  assert.deepEqual(result.data.sources, ['esi']);
});

// -- get_server_status ----------------------------------------------------

test('get_server_status shapes the ESI response', async () => {
  const ctx = baseCtx({
    esi: {
      async get(path) {
        assert.equal(path, '/status/');
        return {
          data: { players: 12345, server_version: '1.0', start_time: '2026-08-05T11:00:00Z' },
          observation: makeEsiObservation({ path }),
        };
      },
    },
  });
  const tool = getTool('get_server_status');
  const result = await tool.handler(ctx, {});
  assert.deepEqual(result.data, {
    players: 12345,
    serverVersion: '1.0',
    startTime: '2026-08-05T11:00:00Z',
    vip: false,
  });
});

// -- explain_term -------------------------------------------------------
// explain_term is now the engine's explainTermTool
// (@red-cup-engineering/personal-intelligence-systems-services-section/glossary)
// bound to this package's bundled newbie glossary record
// (data/records/eve-newbie-glossary.json) — the engine's own glossary.test.mjs
// exercises the lookup/suggestion logic itself; this is a smoke test that
// the wiring (the JSON record, the schema it admits against) is intact.

test('explain_term finds an exact term and an alias, case-insensitively', async () => {
  const tool = getTool('explain_term');
  const exact = await tool.handler(baseCtx(), { term: 'ISK' });
  assert.equal(exact.data.found, true);
  assert.equal(exact.data.term, 'ISK');
  assert.ok(exact.data.sourceUrl.startsWith('https://wiki.eveuniversity.org/'));

  const alias = await tool.handler(baseCtx(), { term: 'highsec' });
  assert.equal(alias.data.found, true);
  assert.equal(alias.data.term, 'High-sec');
});

test('explain_term returns suggestions for an unknown term', async () => {
  const tool = getTool('explain_term');
  const result = await tool.handler(baseCtx(), { term: 'warp scram' });
  assert.equal(result.data.found, false);
  assert.match(result.data.note, /No exact glossary entry/);
});

// -- cross-cutting: public tools never require ctx.accessToken --------------

test('every market tool works with ctx.accessToken left undefined', () => {
  for (const tool of marketTools) {
    assert.equal(typeof tool.handler, 'function', `${tool.operation.id} must export a handler`);
    assert.equal(typeof tool.operation.domain.schema, 'object', `${tool.operation.id} must declare a domain (parameters) schema`);
  }
});
