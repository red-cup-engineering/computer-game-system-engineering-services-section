// src/esi/name-resolver.mjs
//
// Why this exists (live production incident, 2026-08-05): Cloudflare
// Workers' free plan caps a single Worker invocation at 50 external
// subrequests, and "one chat turn = one Worker invocation". Tool handlers
// used to resolve every id (skill type, asset type, location, character,
// system) to a display name with its own GET — get_character_overview cost
// ~7 fetches, and get_skills (one GET per distinct trained skill type) blew
// straight through the cap: "Too many subrequests by single Worker
// invocation." ESI's POST /universe/names/ (src/esi/endpoints.mjs's
// universeNames()) resolves up to 1000 mixed ids -- characters,
// corporations, alliances, types, systems, stations, constellations,
// regions, factions -- in one request. This module is the batching layer
// tool handlers call instead of looping per-id GETs.
//
// createNameResolver({ esi }) returns one resolver meant to live for exactly
// one tool-context lifetime: one buildToolCtx() call = one chat turn / one
// MCP request = one Worker invocation. src/application.mjs's buildToolCtx
// wires a *fresh* resolver into ctx.names per call, so:
//   - memoization is scoped to a single invocation (repeated tool calls
//     within one chat turn -- e.g. get_skills then get_assets_summary --
//     share hits, but nothing leaks across users or across turns), and
//   - the resolver never needs its own eviction policy; it just lives and
//     dies with the ctx that holds it.
//
// Deliberate deviation from a Map-only return: resolve(ids) returns
// { names, observations } rather than a bare Map. A memoized hit produces no
// new EsiObservation (no fetch happened, so citing one would misrepresent
// when the data was actually retrieved -- the same "an observation exists
// only where a fetch happened" rule src/tools/character-tools.mjs's
// pre-existing resolveNames() follows). A handler that calls resolve() more
// than once per invocation (get_skills resolves skill names, then may
// resolve group ids) needs to know which observations are *new* from *this*
// call, not the resolver's full lifetime history, to avoid double-citing
// evidence already surfaced by an earlier call in the same handler. A bare
// Map can't carry that; { names, observations } can, and it matches the
// existing tool-handler pattern (`{ data, observations }` composition) call
// sites already use.

import { universeNames } from "./endpoints.mjs";

// ESI's documented cap on ids per /universe/names/ request.
const MAX_IDS_PER_REQUEST = 1000;

// Hard ceiling on additional 404-recovery subrequests per resolve() call,
// across every bisection split. ESI returns a whole-batch 404 if *any* id in
// the request is unresolvable, with no per-id detail in the body -- the only
// way to isolate which id(s) are bad is to bisect and retry the halves. But
// bisecting all the way to singletons for a chunk that is *mostly* bad ids
// would cost close to one subrequest per id, reintroducing exactly the
// explosion this module exists to prevent. This budget bounds recovery cost
// to a small constant regardless of how many ids in the chunk turn out bad:
// once exhausted, whatever remains unresolved is labeled null rather than
// fetched further.
const MAX_BISECT_ATTEMPTS = 8;

function requireIdsArray(ids, label) {
  if (!Array.isArray(ids)) {
    throw new TypeError(`${label} must be an array`);
  }
  for (const id of ids) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new TypeError(`${label} must contain only positive integers, got ${JSON.stringify(id)}`);
    }
  }
}

/**
 * @param {object} deps
 * @param {{ request: (method: string, path: string, options?: object) => Promise<{data: unknown, observation: object}> }} deps.esi
 *   An ESI client exposing request() (createEsiClient's additive method,
 *   src/esi/esi-client.mjs) -- /universe/names/ is a POST, so get() alone is
 *   not enough.
 */
export function createNameResolver({ esi } = {}) {
  if (!esi || typeof esi.request !== "function") {
    throw new TypeError("createNameResolver: esi must expose request(method, path, options)");
  }

  // id -> { name, category } | null. null means "confirmed unresolvable by
  // ESI", cached the same as a real hit so a repeat resolve() for that id
  // never refetches.
  const cache = new Map();

  async function fetchAndCache(ids, observations) {
    const descriptor = universeNames(ids);
    const { data, observation } = await esi.request(descriptor.method, descriptor.path, { body: descriptor.body });
    observations.push(observation);
    const rows = Array.isArray(data) ? data : [];
    const resolved = new Set();
    for (const row of rows) {
      if (Number.isInteger(row?.id)) {
        cache.set(row.id, { name: row.name ?? null, category: row.category ?? null });
        resolved.add(row.id);
      }
    }
    // ESI silently omitting an id from a 2xx response body (as opposed to
    // 404ing the whole batch) is distinct from the bisection case below, but
    // still needs a terminal cache entry so a repeat resolve() doesn't retry
    // forever.
    for (const id of ids) {
      if (!resolved.has(id)) cache.set(id, null);
    }
  }

  // budget is a { attempts } object shared across one top-level chunk's
  // whole recursion tree, so MAX_BISECT_ATTEMPTS bounds total recovery
  // subrequests for that chunk regardless of split depth or fan-out.
  async function resolveWithRecovery(ids, observations, budget, isTopLevelAttempt) {
    if (!isTopLevelAttempt) {
      if (budget.attempts >= MAX_BISECT_ATTEMPTS) {
        for (const id of ids) cache.set(id, null);
        return;
      }
      budget.attempts += 1;
    }
    try {
      await fetchAndCache(ids, observations);
    } catch (err) {
      if (err?.status !== 404) throw err;
      if (ids.length === 1) {
        // Isolated a single bad id: label it and stop -- this is the base
        // case of the bisection, not a failure to surface further.
        cache.set(ids[0], null);
        return;
      }
      const mid = Math.ceil(ids.length / 2);
      await resolveWithRecovery(ids.slice(0, mid), observations, budget, false);
      await resolveWithRecovery(ids.slice(mid), observations, budget, false);
    }
  }

  return {
    /**
     * Resolve `ids` to { name, category }, deduping and reusing anything
     * already memoized on this resolver instance (a second resolve() call
     * for ids already seen makes zero fetches).
     *
     * @param {number[]} ids
     * @returns {Promise<{ names: Map<number, {name: string|null, category: string|null}|null>, observations: object[] }>}
     *   names covers every id in the input (deduped on the way in, but the
     *   Map is keyed by the original ids so callers can .get(id) directly);
     *   unresolvable ids map to null. observations carries only the
     *   EsiObservation records this call's own fetches produced.
     */
    async resolve(ids) {
      requireIdsArray(ids, "resolve: ids");
      const unique = [...new Set(ids)];
      const observations = [];
      const missing = unique.filter((id) => !cache.has(id));
      for (let i = 0; i < missing.length; i += MAX_IDS_PER_REQUEST) {
        const chunk = missing.slice(i, i + MAX_IDS_PER_REQUEST);
        const budget = { attempts: 0 };
        // eslint-disable-next-line no-await-in-loop -- chunks share the
        // resolver's cache and must not race on the same ids
        await resolveWithRecovery(chunk, observations, budget, true);
      }
      const names = new Map();
      for (const id of unique) names.set(id, cache.get(id) ?? null);
      return { names, observations };
    },
  };
}
