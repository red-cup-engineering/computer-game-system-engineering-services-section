// Character-scoped ESI tool definitions for the analyst tool registry.
// Per-id name lookups go through ctx.names (src/esi/name-resolver.mjs),
// not per-id GET builders, to stay under Workers' 50-subrequest cap; see
// name-resolver.mjs's MAX_BISECT_ATTEMPTS for the 404-bisection budget.
// Worst-case subrequests per tool (cold ctx.names): get_character_overview
// 5, get_skill_queue 2, get_skills 2, get_wallet_journal 2,
// get_assets_summary up to 4.
import {
  characterPublic as characterPublicInfo,
  location as characterLocation,
  ship as characterShip,
  wallet as characterWalletBalance,
  walletJournal as characterWalletJournal,
  skills as characterSkills,
  skillQueue as characterSkillQueue,
  assets as characterAssets,
} from "../esi/endpoints.mjs";
// ToolError comes from the upstream generic registry package (not
// ./registry.mjs, which imports this file at top level -- importing back
// would be circular). Constructor: new ToolError(message, code).
import { ToolError, assistOperation } from "@red-cup-engineering/personal-intelligence-systems-services-section/tools";
import { EsiError } from "../esi/esi-client.mjs";

const ASSETS_MAX_PAGES = 3;
const ASSETS_PAGE_SIZE = 1000;
const ASSETS_NOTABLE_PER_LOCATION = 5;
const WALLET_JOURNAL_DEFAULT_LIMIT = 50;
const WALLET_JOURNAL_MAX_LIMIT = 1000;

const REQUIRED_SCOPES = {
  get_character_overview: [
    "esi-location.read_location.v1",
    "esi-location.read_ship_type.v1",
    "esi-wallet.read_character_wallet.v1",
  ],
  get_skill_queue: ["esi-skills.read_skillqueue.v1"],
  get_skills: ["esi-skills.read_skills.v1"],
  get_wallet_journal: ["esi-wallet.read_character_wallet.v1"],
  get_assets_summary: ["esi-assets.read_assets.v1"],
};

function requireContext(ctx, toolName) {
  if (!ctx || typeof ctx !== "object") {
    throw new TypeError(`${toolName}: ctx must be an object`);
  }
  if (!ctx.esi || typeof ctx.esi.get !== "function") {
    throw new TypeError(`${toolName}: ctx.esi must be an ESI client exposing get()`);
  }
  if (!ctx.names || typeof ctx.names.resolve !== "function") {
    throw new TypeError(`${toolName}: ctx.names must be a name resolver exposing resolve() (see src/esi/name-resolver.mjs)`);
  }
  if (!Number.isInteger(ctx.characterId)) {
    throw new TypeError(`${toolName}: ctx.characterId must be an integer`);
  }
  if (typeof ctx.accessToken !== "string" || ctx.accessToken.length === 0) {
    throw new ToolError(
      `${toolName}: requires ctx.accessToken (no ESI access token on context)`,
      "missing_token",
    );
  }
}

function validateNoArgs(args, toolName) {
  if (args !== undefined && args !== null && (typeof args !== "object" || Array.isArray(args))) {
    throw new ToolError(`${toolName}: expected no arguments, received ${typeof args}`, "bad_args");
  }
}

function validateLimit(args, toolName, defaultValue, maxValue) {
  if (args === undefined || args === null) return defaultValue;
  if (typeof args !== "object" || Array.isArray(args)) {
    throw new ToolError(`${toolName}: args must be an object`, "bad_args");
  }
  if (args.limit === undefined) return defaultValue;
  if (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > maxValue) {
    throw new ToolError(
      `${toolName}: limit must be an integer between 1 and ${maxValue}`,
      "bad_args",
    );
  }
  return args.limit;
}

// Takes a { path, query? } descriptor as produced by src/esi/endpoints.mjs's
// builder functions (not a bare path string) and extracts path/query from
// it before calling the esi-client's get(path, { token, query }).
//
// ESI reports missing/insufficient OAuth scope as a 401/403; translate that
// specific case into ToolError('missing_scope', ...) per the tool-registry
// contract, and let every other EsiError (rate limit, 5xx, etc.) propagate
// unchanged so callers can distinguish "fix your grant" from "retry later".
async function esiGet(ctx, toolName, descriptor) {
  try {
    return await ctx.esi.get(descriptor.path, { token: ctx.accessToken, query: descriptor.query });
  } catch (err) {
    if (err instanceof EsiError && (err.status === 401 || err.status === 403)) {
      const scopes = REQUIRED_SCOPES[toolName]?.join(", ") ?? "unknown";
      throw new ToolError(
        `${toolName}: ESI rejected the request (status ${err.status}) at ${descriptor.path} — required scope(s): ${scopes}`,
        "missing_scope",
      );
    }
    throw err;
  }
}

// Thin wrapper around ctx.names.resolve(): filters to valid positive
// integers first (raw ESI rows can carry null/undefined ids -- e.g. an asset
// with no station, a skill queue entry with a malformed id -- and the
// resolver's own validation rejects anything that isn't a clean positive
// integer array). One call here is one batched POST /universe/names/ for
// however many distinct ids are still unresolved on this invocation's
// resolver (see src/esi/name-resolver.mjs), replacing what used to be one
// GET per id.
async function resolveNames(ctx, ids) {
  const validIds = ids.filter((id) => Number.isInteger(id) && id > 0);
  if (validIds.length === 0) return { names: new Map(), observations: [] };
  return ctx.names.resolve(validIds);
}

// Exported (beyond this file's own use in getWalletJournalHandler) so
// src/tools/ledger-tools.mjs's export_wallet_ledger can label raw ESI
// wallet-journal rows the same way get_wallet_journal does, without
// duplicating the word-splitting/title-casing logic.
export function humanizeRefType(refType) {
  if (typeof refType !== "string" || refType.length === 0) return "Unknown";
  return refType
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

async function getCharacterOverviewHandler(ctx, args) {
  requireContext(ctx, "get_character_overview");
  validateNoArgs(args, "get_character_overview");
  const observations = [];

  const [pub, loc, ship, wallet] = await Promise.all([
    esiGet(ctx, "get_character_overview", characterPublicInfo(ctx.characterId)),
    esiGet(ctx, "get_character_overview", characterLocation(ctx.characterId)),
    esiGet(ctx, "get_character_overview", characterShip(ctx.characterId)),
    esiGet(ctx, "get_character_overview", characterWalletBalance(ctx.characterId)),
  ]);
  observations.push(pub.observation, loc.observation, ship.observation, wallet.observation);

  // One batched POST /universe/names/ for every id this overview needs a
  // display name for -- system, station, ship type are different ESI
  // categories, but the batch resolver handles mixed categories in a single
  // request, so there is no reason to keep them as three separate calls.
  const idsNeedingNames = [
    loc.data?.solar_system_id,
    loc.data?.station_id,
    ship.data?.ship_type_id,
  ].filter((id) => Number.isInteger(id));
  const { names, observations: nameObs } = await resolveNames(ctx, idsNeedingNames);
  observations.push(...nameObs);

  const data = {
    characterId: ctx.characterId,
    name: pub.data?.name ?? null,
    corporationId: pub.data?.corporation_id ?? null,
    securityStatus: pub.data?.security_status ?? null,
    location: {
      solarSystemId: loc.data?.solar_system_id ?? null,
      solarSystemName: Number.isInteger(loc.data?.solar_system_id)
        ? names.get(loc.data.solar_system_id)?.name ?? null
        : null,
      stationId: loc.data?.station_id ?? null,
      stationName: Number.isInteger(loc.data?.station_id)
        ? names.get(loc.data.station_id)?.name ?? null
        : null,
      structureId: loc.data?.structure_id ?? null,
    },
    ship: {
      itemId: ship.data?.ship_item_id ?? null,
      typeId: ship.data?.ship_type_id ?? null,
      typeName: Number.isInteger(ship.data?.ship_type_id)
        ? names.get(ship.data.ship_type_id)?.name ?? null
        : null,
      name: ship.data?.ship_name ?? null,
    },
    walletBalance: typeof wallet.data === "number" ? wallet.data : null,
  };

  return { data, observations };
}

async function getSkillQueueHandler(ctx, args) {
  requireContext(ctx, "get_skill_queue");
  validateNoArgs(args, "get_skill_queue");
  const observations = [];

  const queue = await esiGet(ctx, "get_skill_queue", characterSkillQueue(ctx.characterId));
  observations.push(queue.observation);
  const entries = Array.isArray(queue.data) ? queue.data : [];

  const { names: skillNames, observations: nameObs } = await resolveNames(
    ctx,
    entries.map((entry) => entry.skill_id),
  );
  observations.push(...nameObs);

  const now = typeof ctx.now === "function" ? ctx.now() : Date.now();
  const sorted = [...entries].sort((a, b) => (a.queue_position ?? 0) - (b.queue_position ?? 0));

  const mapped = sorted.map((entry) => {
    const finishDate = entry.finish_date ?? null;
    const finishMs = finishDate ? Date.parse(finishDate) : NaN;
    return {
      skillId: entry.skill_id,
      skillName: skillNames.get(entry.skill_id)?.name ?? null,
      finishedLevel: entry.finished_level ?? null,
      queuePosition: entry.queue_position ?? null,
      startDate: entry.start_date ?? null,
      finishDate,
      trainingTimeRemainingMs: Number.isFinite(finishMs) ? Math.max(0, finishMs - now) : null,
    };
  });

  const last = mapped[mapped.length - 1] ?? null;
  const totalTimeRemainingMs = last ? last.trainingTimeRemainingMs : null;
  const isPaused = mapped.length > 0 && mapped.every((entry) => entry.finishDate === null);

  return {
    data: { entries: mapped, totalTimeRemainingMs, isPaused },
    observations,
  };
}

// This is the tool the live production incident this file's header comment
// documents was about: with the old per-skill-type resolveTypeInfo() (one
// GET /universe/types/{id}/ per *distinct* trained skill type, needed for
// both the name and the group_id used to bucket skills into categories), a
// character with a large, varied trained-skill list could alone exceed
// Cloudflare Workers' 50-subrequest invocation cap.
//
// ESI has no batched type -> group endpoint (/universe/names/ returns only
// {id, name, category}, not a type's group_id), so there is no batched way
// to keep the old group/category bucketing without reintroducing a
// per-distinct-type GET loop. Per this file's evidence-provenance
// principle (ROADMAP.md product principle #4: don't flatten or invent),
// fabricating a hardcoded skill-type -> group-id table without a verified
// source would be worse than not having it, so category bucketing is
// dropped here rather than faked. data.note says so explicitly for anyone
// consuming this tool's output.
async function getSkillsHandler(ctx, args) {
  requireContext(ctx, "get_skills");
  validateNoArgs(args, "get_skills");
  const observations = [];

  const skills = await esiGet(ctx, "get_skills", characterSkills(ctx.characterId));
  observations.push(skills.observation);
  const rows = Array.isArray(skills.data?.skills) ? skills.data.skills : [];

  const { names: skillNames, observations: nameObs } = await resolveNames(
    ctx,
    rows.map((row) => row.skill_id),
  );
  observations.push(...nameObs);

  const skillsOut = rows.map((row) => ({
    skillId: row.skill_id,
    skillName: skillNames.get(row.skill_id)?.name ?? null,
    trainedLevel: row.trained_skill_level ?? null,
    activeLevel: row.active_skill_level ?? null,
    skillpointsInSkill: row.skillpoints_in_skill ?? 0,
  }));

  return {
    data: {
      totalSp: skills.data?.total_sp ?? 0,
      unallocatedSp: skills.data?.unallocated_sp ?? 0,
      skills: skillsOut,
      note:
        "Per-skill category (skill group) bucketing is not included: ESI has " +
        "no batched skill-type-to-group lookup, and resolving it per distinct " +
        "trained skill type would reintroduce the per-id subrequest cost that " +
        "used to exceed Cloudflare Workers' 50-subrequest invocation cap on " +
        "characters with many distinct trained skills.",
    },
    observations,
  };
}

async function getWalletJournalHandler(ctx, args) {
  requireContext(ctx, "get_wallet_journal");
  const limit = validateLimit(
    args,
    "get_wallet_journal",
    WALLET_JOURNAL_DEFAULT_LIMIT,
    WALLET_JOURNAL_MAX_LIMIT,
  );
  const observations = [];

  const page = await esiGet(
    ctx,
    "get_wallet_journal",
    characterWalletJournal(ctx.characterId, { page: 1 }),
  );
  observations.push(page.observation);
  const rows = Array.isArray(page.data) ? page.data : [];

  const sorted = [...rows].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const limited = sorted.slice(0, limit);

  // Party ids can be characters, corporations, or (system-generated entries
  // like bounty prizes) absent entirely -- resolveNames tolerates any mix
  // via the same batch /universe/names/ call regardless of category.
  const partyIds = limited.flatMap((row) => [row.first_party_id, row.second_party_id]);
  const { names: partyNames, observations: nameObs } = await resolveNames(ctx, partyIds);
  observations.push(...nameObs);

  const entries = limited.map((row) => ({
    id: row.id,
    date: row.date,
    amount: row.amount ?? null,
    balance: row.balance ?? null,
    refType: row.ref_type ?? null,
    refTypeLabel: humanizeRefType(row.ref_type),
    description: row.description ?? null,
    firstPartyId: row.first_party_id ?? null,
    firstPartyName: Number.isInteger(row.first_party_id)
      ? partyNames.get(row.first_party_id)?.name ?? null
      : null,
    secondPartyId: row.second_party_id ?? null,
    secondPartyName: Number.isInteger(row.second_party_id)
      ? partyNames.get(row.second_party_id)?.name ?? null
      : null,
    reason: row.reason ?? null,
  }));

  return {
    data: { entries, count: entries.length, totalFetched: rows.length },
    observations,
  };
}

async function getAssetsSummaryHandler(ctx, args) {
  requireContext(ctx, "get_assets_summary");
  validateNoArgs(args, "get_assets_summary");
  const observations = [];

  const items = [];
  let pagesFetched = 0;
  let lastPageWasFull = false;
  for (let page = 1; page <= ASSETS_MAX_PAGES; page += 1) {
    const result = await esiGet(ctx, "get_assets_summary", characterAssets(ctx.characterId, page));
    observations.push(result.observation);
    const rows = Array.isArray(result.data) ? result.data : [];
    items.push(...rows);
    pagesFetched += 1;
    lastPageWasFull = rows.length === ASSETS_PAGE_SIZE;
    if (!lastPageWasFull) break;
  }
  // No X-Pages total is available through the pinned EsiObservation shape, so
  // a full final page at the fetch cap is the only signal that more assets
  // may exist beyond what was retrieved; a short final page means we saw it all.
  const truncated = lastPageWasFull && pagesFetched === ASSETS_MAX_PAGES;

  const byLocation = new Map();
  for (const item of items) {
    const key = item.location_id;
    const bucket = byLocation.get(key) ?? {
      locationId: key,
      itemCount: 0,
      totalQuantity: 0,
      items: [],
    };
    bucket.itemCount += 1;
    bucket.totalQuantity += Number.isFinite(item.quantity) ? item.quantity : 0;
    bucket.items.push(item);
    byLocation.set(key, bucket);
  }

  const withNotable = [...byLocation.values()].map((bucket) => {
    const notable = [...bucket.items]
      .sort((a, b) => (b.quantity ?? 0) - (a.quantity ?? 0) || (a.type_id ?? 0) - (b.type_id ?? 0))
      .slice(0, ASSETS_NOTABLE_PER_LOCATION);
    return { ...bucket, notable };
  });

  // One batch resolve for both notable item type names *and* location names
  // (station/structure ids -- a mixed-category request the batch resolver
  // handles in the same call as the type ids). Player-owned structure ids
  // are not resolvable via this public endpoint and come back null via the
  // resolver's 404-bisection path rather than failing the whole call.
  const notableTypeIds = withNotable.flatMap((bucket) => bucket.notable.map((it) => it.type_id));
  const locationIds = withNotable.map((bucket) => bucket.locationId);
  const { names, observations: nameObs } = await resolveNames(ctx, [...notableTypeIds, ...locationIds]);
  observations.push(...nameObs);

  const locations = withNotable
    .map(({ items: _items, notable, locationId, ...rest }) => ({
      ...rest,
      locationId,
      locationName: Number.isInteger(locationId) ? names.get(locationId)?.name ?? null : null,
      notableItems: notable.map((it) => ({
        typeId: it.type_id,
        typeName: names.get(it.type_id)?.name ?? null,
        quantity: it.quantity ?? null,
        isSingleton: it.is_singleton ?? null,
      })),
    }))
    .sort((a, b) => b.itemCount - a.itemCount);

  return {
    data: {
      totalItems: items.length,
      pagesFetched,
      truncated,
      locations,
    },
    observations,
  };
}

export const characterTools = [
  assistOperation({
    id: "get_character_overview",
    description:
      "Public info, current location, active ship, and wallet balance for the authenticated character, composed from several ESI calls.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    effects: ["network"],
    handler: getCharacterOverviewHandler,
  }),
  assistOperation({
    id: "get_skill_queue",
    description:
      "The character's training queue with per-entry finish dates and total time remaining.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    effects: ["network"],
    handler: getSkillQueueHandler,
  }),
  assistOperation({
    id: "get_skills",
    description:
      "All trained skills with names, trained/active levels, and skillpoints, plus total and " +
      "unallocated skill points. Not bucketed by skill category/group -- see data.note.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    effects: ["network"],
    handler: getSkillsHandler,
  }),
  assistOperation({
    id: "get_wallet_journal",
    description:
      "Recent wallet journal entries with a human-readable label for each ref_type and resolved " +
      "first/second-party names.",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "integer",
          minimum: 1,
          maximum: WALLET_JOURNAL_MAX_LIMIT,
          description: `Maximum number of recent entries to return (default ${WALLET_JOURNAL_DEFAULT_LIMIT}).`,
        },
      },
      additionalProperties: false,
    },
    effects: ["network"],
    handler: getWalletJournalHandler,
  }),
  assistOperation({
    id: "get_assets_summary",
    description:
      "Asset counts and notable items (with resolved item and location names) grouped by " +
      "location, fetched up to 3 pages (see data.truncated). Location names may be null for " +
      "player-owned structures ESI cannot publicly resolve.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    effects: ["network"],
    handler: getAssetsSummaryHandler,
  }),
];
