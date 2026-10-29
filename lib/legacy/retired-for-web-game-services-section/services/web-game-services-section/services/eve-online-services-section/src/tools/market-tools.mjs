// src/tools/market-tools.mjs — public-market and reference-data tools.
// None require ctx.accessToken. Contract: handler: async (ctx, args) =>
// { data, observations }, the pinned EsiObservation shape. search_types
// uses esi-client's additive request(method, path, {...body}) for POST
// /universe/ids/. Known untouched costs: compare_hubs up to 25 subrequests
// (no batch order-book alternative); get_route is 1 + N per-system GETs
// (batch /universe/names/ omits security_status).

import { ToolError, assistOperation } from "@red-cup-engineering/personal-intelligence-systems-services-section/tools";
import { explainTermTool } from "@red-cup-engineering/personal-intelligence-systems-services-section/glossary";
import { EsiError } from "../esi/esi-client.mjs";
import {
  THE_FORGE,
  DOMAIN,
  SINQ_LAISON,
  HEIMATAR,
  METROPOLIS,
  marketOrders,
  marketHistory,
  route as routeEndpoint,
  systemKills,
  status as statusEndpoint,
  universeIds,
  systemInfo,
} from '../esi/endpoints.mjs';
import eveNewbieGlossary from '../../data/records/eve-newbie-glossary.json' with { type: 'json' };

const DEFAULT_USER_AGENT =
  'EVE Assist (decision-support tool; https://eve-assist.561.group)';

// The five classic empire trade hub regions, keyed off endpoints.mjs's
// shared region-ID constants so this file can't drift from what the rest of
// the package considers "the hubs". regionName is display-only reference
// data endpoints.mjs doesn't carry.
const HUBS = [
  { name: 'Jita', regionId: THE_FORGE, regionName: 'The Forge' },
  { name: 'Amarr', regionId: DOMAIN, regionName: 'Domain' },
  { name: 'Dodixie', regionId: SINQ_LAISON, regionName: 'Sinq Laison' },
  { name: 'Rens', regionId: HEIMATAR, regionName: 'Heimatar' },
  { name: 'Hek', regionId: METROPOLIS, regionName: 'Metropolis' },
];

const MAX_MARKET_ORDER_PAGES = 5;

// The brief for this tool speaks safe|shortest; ESI's /route/ flag values
// are shortest|secure|insecure (see endpoints.mjs's routeEndpoint). "safe"
// maps to ESI's "secure".
const ROUTE_FLAG_MAP = { safe: 'secure', shortest: 'shortest' };

function toolError(message, code) {
  return new ToolError(message, code);
}

function requirePositiveInteger(value, label) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw toolError(`${label} must be a positive integer`, 'invalid_argument');
  }
  return value;
}

function requireNames(names) {
  if (!Array.isArray(names) || names.length === 0) {
    throw toolError('names must be a non-empty array of strings', 'invalid_argument');
  }
  if (names.length > 20) {
    // ESI's /universe/ids/ endpoint accepts far more, but this tool is meant
    // for a handful of candidate item/character/system names per call, not
    // bulk import.
    throw toolError('names must contain 20 or fewer entries', 'invalid_argument');
  }
  return names.map((name, index) => {
    if (typeof name !== 'string' || name.trim().length === 0) {
      throw toolError(`names[${index}] must be a non-empty string`, 'invalid_argument');
    }
    return name.trim();
  });
}

function resolveFetch(ctx) {
  return ctx?.fetchImpl ?? fetch;
}

function resolveNow(ctx) {
  return typeof ctx?.now === 'function' ? ctx.now : Date.now;
}

// -- search_types -------------------------------------------------------
async function searchTypesHandler(ctx, args) {
  const names = requireNames(args?.names);
  const descriptor = universeIds(names);
  const { data: body, observation } = await ctx.esi.request(descriptor.method, descriptor.path, {
    body: descriptor.body,
  });
  const matches = Array.isArray(body?.inventory_types) ? body.inventory_types : [];
  const matchedNames = new Set(matches.map((match) => match.name));
  const unmatched = names.filter((name) => !matchedNames.has(name));
  const data = {
    matches: matches.map((match) => ({ typeId: match.id, name: match.name })),
    unmatched,
  };
  if (unmatched.length > 0) {
    data.note =
      `ESI's exact-name lookup found no match for: ${unmatched.join(', ')}. ` +
      'It only matches full item names exactly (case-sensitive); check spelling ' +
      'and capitalization, drop qualifiers like faction/meta-level suffixes, or ' +
      'try the in-game market search for a partial match.';
  }
  return { data, observations: [observation] };
}

// -- get_market_prices / compare_hubs (shared pagination) ----------------
async function fetchOrderPages(ctx, regionId, typeId, orderType) {
  const observations = [];
  const orders = [];
  let truncated = false;
  for (let page = 1; page <= MAX_MARKET_ORDER_PAGES; page += 1) {
    const descriptor = marketOrders(regionId, { typeId, page, orderType });
    let data;
    let observation;
    try {
      // eslint-disable-next-line no-await-in-loop -- pages must be fetched in order
      ({ data, observation } = await ctx.esi.get(descriptor.path, { query: descriptor.query }));
    } catch (err) {
      // Some ESI list endpoints 404 once you page past the last available
      // page rather than returning an empty array; treat that the same as
      // "no more data". The pinned EsiObservation shape doesn't carry the
      // X-Pages header ESI uses for list pagination, so there's no way to
      // read a page count up front.
      if (err instanceof EsiError && err.status === 404) {
        break;
      }
      throw err;
    }
    observations.push(observation);
    const rows = Array.isArray(data) ? data : [];
    orders.push(...rows);
    if (rows.length === 0) {
      break;
    }
    if (page === MAX_MARKET_ORDER_PAGES) {
      truncated = true;
    }
  }
  return { orders, observations, truncated };
}

function summarizeOrders(orders) {
  let bestBid = null;
  let bestAsk = null;
  let bidVolume = 0;
  let askVolume = 0;
  let buyOrderCount = 0;
  let sellOrderCount = 0;
  for (const order of orders) {
    if (order.is_buy_order) {
      buyOrderCount += 1;
      bidVolume += order.volume_remain ?? 0;
      if (bestBid === null || order.price > bestBid) {
        bestBid = order.price;
      }
    } else {
      sellOrderCount += 1;
      askVolume += order.volume_remain ?? 0;
      if (bestAsk === null || order.price < bestAsk) {
        bestAsk = order.price;
      }
    }
  }
  return { bestBid, bestAsk, bidVolume, askVolume, buyOrderCount, sellOrderCount };
}

async function getMarketPricesHandler(ctx, args) {
  const typeId = requirePositiveInteger(args?.typeId, 'typeId');
  const regionId = requirePositiveInteger(args?.regionId, 'regionId');
  const { orders, observations, truncated } = await fetchOrderPages(ctx, regionId, typeId, 'all');
  const summary = summarizeOrders(orders);
  const data = {
    typeId,
    regionId,
    bestBid: summary.bestBid,
    bestAsk: summary.bestAsk,
    spread:
      summary.bestBid !== null && summary.bestAsk !== null
        ? summary.bestAsk - summary.bestBid
        : null,
    bidVolume: summary.bidVolume,
    askVolume: summary.askVolume,
    buyOrderCount: summary.buyOrderCount,
    sellOrderCount: summary.sellOrderCount,
  };
  if (truncated) {
    data.note = `Order pagination capped at ${MAX_MARKET_ORDER_PAGES} pages; results may be incomplete for very liquid markets.`;
  }
  return { data, observations };
}

// -- get_market_history ---------------------------------------------------
function pctChange(rows) {
  if (rows.length < 2) {
    return null;
  }
  const first = rows[0].average;
  const last = rows[rows.length - 1].average;
  if (!first) {
    return null;
  }
  return ((last - first) / first) * 100;
}

async function getMarketHistoryHandler(ctx, args) {
  const typeId = requirePositiveInteger(args?.typeId, 'typeId');
  const regionId = requirePositiveInteger(args?.regionId, 'regionId');
  const descriptor = marketHistory(regionId, typeId);
  const { data: rows, observation } = await ctx.esi.get(descriptor.path, { query: descriptor.query });
  const observations = [observation];
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      data: { typeId, regionId, daysObserved: 0, series: [], note: 'No history returned for this type/region.' },
      observations,
    };
  }
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const last7 = sorted.slice(-7);
  const last30 = sorted.slice(-30);
  const recentAverage =
    last7.reduce((sum, row) => sum + row.average, 0) / last7.length;
  const data = {
    typeId,
    regionId,
    daysObserved: sorted.length,
    recentAverage,
    min30d: Math.min(...last30.map((row) => row.lowest)),
    max30d: Math.max(...last30.map((row) => row.highest)),
    trend7dPct: pctChange(last7),
    trend30dPct: pctChange(last30),
    // Daily {date, average} series, most-recent 90 days -- additive beyond
    // the original summary-only contract, so a chart (or any other
    // series-shaped consumer) can be built directly off this tool's output
    // instead of re-fetching /markets/{region}/history/ itself. See
    // src/application.mjs's GET /api/charts/market-history, which renders
    // this with src/charting's renderLineChart.
    series: sorted.slice(-90).map((row) => ({ date: row.date, average: row.average })),
  };
  return { data, observations };
}

// -- compare_hubs -----------------------------------------------------------
async function compareHubsHandler(ctx, args) {
  const typeId = requirePositiveInteger(args?.typeId, 'typeId');
  const results = [];
  const observations = [];
  for (const hub of HUBS) {
    // eslint-disable-next-line no-await-in-loop -- five hubs, sequential is fine and keeps observations attributable
    const { orders, observations: hubObservations } = await fetchOrderPages(
      ctx,
      hub.regionId,
      typeId,
      'sell',
    );
    observations.push(...hubObservations);
    const bestSell = orders.reduce(
      (min, order) => (min === null || order.price < min ? order.price : min),
      null,
    );
    results.push({
      hub: hub.name,
      regionId: hub.regionId,
      regionName: hub.regionName,
      bestSell,
      sellOrderCount: orders.length,
    });
  }
  results.sort((a, b) => {
    if (a.bestSell === null) return 1;
    if (b.bestSell === null) return -1;
    return a.bestSell - b.bestSell;
  });
  return { data: { typeId, hubs: results }, observations };
}

// -- get_route ----------------------------------------------------------
async function getRouteHandler(ctx, args) {
  const origin = requirePositiveInteger(args?.originSystemId, 'originSystemId');
  const destination = requirePositiveInteger(args?.destinationSystemId, 'destinationSystemId');
  const flagArg = args?.flag ?? 'shortest';
  if (!Object.prototype.hasOwnProperty.call(ROUTE_FLAG_MAP, flagArg)) {
    throw toolError(`flag must be one of: ${Object.keys(ROUTE_FLAG_MAP).join(', ')}`, 'invalid_argument');
  }
  const routeDescriptor = routeEndpoint(origin, destination, ROUTE_FLAG_MAP[flagArg]);
  const { data: systemIds, observation: routeObservation } = await ctx.esi.get(routeDescriptor.path, {
    query: routeDescriptor.query,
  });
  if (!Array.isArray(systemIds) || systemIds.length === 0) {
    throw toolError('ESI returned no route between the given systems', 'no_route');
  }
  const observations = [routeObservation];
  const systems = [];
  for (const systemId of systemIds) {
    const systemDescriptor = systemInfo(systemId);
    // eslint-disable-next-line no-await-in-loop -- route systems are typically few and order matters for the reply
    const { data: system, observation } = await ctx.esi.get(systemDescriptor.path);
    observations.push(observation);
    systems.push({
      systemId,
      name: system?.name ?? null,
      securityStatus: typeof system?.security_status === 'number' ? system.security_status : null,
    });
  }
  const lowsecJumps = systems.filter(
    (system) => system.securityStatus !== null && system.securityStatus > 0.0 && system.securityStatus < 0.5,
  ).length;
  const nullsecJumps = systems.filter(
    (system) => system.securityStatus !== null && system.securityStatus <= 0.0,
  ).length;
  const data = {
    originSystemId: origin,
    destinationSystemId: destination,
    flag: flagArg,
    jumpCount: systems.length - 1,
    systems,
    lowsecJumps,
    nullsecJumps,
  };
  return { data, observations };
}

// -- get_system_activity ------------------------------------------------
async function getSystemActivityHandler(ctx, args) {
  const systemId = requirePositiveInteger(args?.systemId, 'systemId');
  const includeZkillboard = args?.includeZkillboard ?? true;
  const descriptor = systemKills();
  const { data: allKills, observation } = await ctx.esi.get(descriptor.path);
  const observations = [observation];
  const entry = Array.isArray(allKills)
    ? allKills.find((kills) => kills.system_id === systemId)
    : null;
  const data = {
    systemId,
    esi: {
      shipKills: entry?.ship_kills ?? 0,
      npcKills: entry?.npc_kills ?? 0,
      podKills: entry?.pod_kills ?? 0,
    },
    // ESI's system_kills is an hourly-updated aggregate with no per-kill
    // recency; sources tracks provenance so callers (and the analyst) never
    // flatten an ESI aggregate and a zKillboard live feed into one kind of
    // evidence (ROADMAP.md product principle #4).
    sources: ['esi'],
  };
  if (includeZkillboard) {
    const fetchImpl = resolveFetch(ctx);
    const now = resolveNow(ctx);
    const path = `/api/kills/systemID/${systemId}/pastSeconds/3600/`;
    const url = `https://zkillboard.com${path}`;
    try {
      const response = await fetchImpl(url, {
        headers: { 'user-agent': DEFAULT_USER_AGENT, accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`zKillboard responded with status ${response.status}`);
      }
      const kills = await response.json();
      const recordedAt = now();
      const killList = Array.isArray(kills) ? kills : [];
      data.zkillboard = {
        killCountLastHour: killList.length,
        mostRecentKillId: killList.length > 0 ? killList[0].killmail_id ?? null : null,
      };
      data.sources.push('zkillboard');
      observations.push({
        // Not an EsiObservation: this is a distinct evidence kind from a
        // different, lower-authority public source (ROADMAP.md principle
        // #4) and must not be flattened into the ESI shape.
        type: 'PublicObservation',
        source: 'zkillboard',
        path,
        query: null,
        status: response.status,
        expiresAt: null,
        recordedAt,
        etag: null,
      });
    } catch (err) {
      data.zkillboardUnavailable = true;
      data.note = `zKillboard lookup failed (${err.message}); this summary is ESI-only.`;
    }
  }
  return { data, observations };
}

// -- get_server_status ----------------------------------------------------
async function getServerStatusHandler(ctx) {
  const descriptor = statusEndpoint();
  const { data, observation } = await ctx.esi.get(descriptor.path);
  const result = {
    players: data?.players ?? null,
    serverVersion: data?.server_version ?? null,
    startTime: data?.start_time ?? null,
    vip: Boolean(data?.vip),
  };
  return { data: result, observations: [observation] };
}

// -- registry entries -----------------------------------------------------
export const marketTools = [
  assistOperation({
    id: 'search_types',
    description:
      'Resolve one or more exact item/entity names to EVE type IDs via ESI\'s bulk ' +
      'name lookup. Exact match only; unmatched names come back with guidance in ' +
      'data.note rather than a fuzzy guess.',
    parameters: {
      type: 'object',
      properties: {
        names: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 20,
          description: 'Candidate exact names to resolve, e.g. ["Venture", "Tritanium"].',
        },
      },
      required: ['names'],
      additionalProperties: false,
    },
    effects: ['network'],
    handler: searchTypesHandler,
  }),
  assistOperation({
    id: 'get_market_prices',
    description:
      'Best bid/ask and order-book volume for a type in a region, from public ESI ' +
      'market orders.',
    parameters: {
      type: 'object',
      properties: {
        typeId: { type: 'integer', minimum: 1, description: 'EVE type ID of the item.' },
        regionId: { type: 'integer', minimum: 1, description: 'EVE region ID to query.' },
      },
      required: ['typeId', 'regionId'],
      additionalProperties: false,
    },
    effects: ['network'],
    handler: getMarketPricesHandler,
  }),
  assistOperation({
    id: 'get_market_history',
    description:
      'Summarize a region\'s recent daily market history for a type: recent average, ' +
      '30-day min/max, 7-/30-day price trend, and the underlying daily average-price series ' +
      '(up to 90 days).',
    parameters: {
      type: 'object',
      properties: {
        typeId: { type: 'integer', minimum: 1, description: 'EVE type ID of the item.' },
        regionId: { type: 'integer', minimum: 1, description: 'EVE region ID to query.' },
      },
      required: ['typeId', 'regionId'],
      additionalProperties: false,
    },
    effects: ['network'],
    handler: getMarketHistoryHandler,
  }),
  assistOperation({
    id: 'compare_hubs',
    description:
      'Best sell price for a type across the five major empire trade hubs (Jita, ' +
      'Amarr, Dodixie, Rens, Hek), sorted cheapest first.',
    parameters: {
      type: 'object',
      properties: {
        typeId: { type: 'integer', minimum: 1, description: 'EVE type ID of the item.' },
      },
      required: ['typeId'],
      additionalProperties: false,
    },
    effects: ['network'],
    handler: compareHubsHandler,
  }),
  assistOperation({
    id: 'get_route',
    description:
      'Systems on the route between two solar systems, with security status per ' +
      'system and a count of lowsec/nullsec jumps.',
    parameters: {
      type: 'object',
      properties: {
        originSystemId: { type: 'integer', minimum: 1 },
        destinationSystemId: { type: 'integer', minimum: 1 },
        flag: {
          type: 'string',
          enum: ['safe', 'shortest'],
          description: '"safe" prefers highsec (maps to ESI\'s "secure" flag); "shortest" is fewest jumps.',
        },
      },
      required: ['originSystemId', 'destinationSystemId'],
      additionalProperties: false,
    },
    effects: ['network'],
    handler: getRouteHandler,
  }),
  assistOperation({
    id: 'get_system_activity',
    description:
      'Recent kill activity for a solar system: ESI\'s hourly ship/NPC/pod kill ' +
      'counts, optionally supplemented with zKillboard\'s public last-hour feed. ' +
      'Degrades gracefully to ESI-only if zKillboard is unreachable.',
    parameters: {
      type: 'object',
      properties: {
        systemId: { type: 'integer', minimum: 1 },
        includeZkillboard: { type: 'boolean', description: 'Defaults to true.' },
      },
      required: ['systemId'],
      additionalProperties: false,
    },
    effects: ['network'],
    handler: getSystemActivityHandler,
  }),
  assistOperation({
    id: 'get_server_status',
    description: 'Current Tranquility server status: player count, version, start time.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    effects: ['network'],
    handler: getServerStatusHandler,
  }),
  // explain_term is the engine's one term-explanation tool
  // (src/glossary/glossary-tool.mjs) bound to this package's bundled newbie
  // glossary record (data/records/eve-newbie-glossary.json) — not a
  // package-local handler. See that module for lookup/suggestion behavior.
  explainTermTool(eveNewbieGlossary),
];
