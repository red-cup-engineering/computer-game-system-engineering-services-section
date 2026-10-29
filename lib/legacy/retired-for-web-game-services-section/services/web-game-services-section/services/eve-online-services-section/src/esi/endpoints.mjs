// Catalog of named ESI endpoint builders. Each function validates its
// arguments and returns a plain { path, query?, method?, body? } descriptor —
// no fetching here. Tool handlers pass the descriptor to the esi-client
// (createEsiClient().get for GET-shaped descriptors, .request(method, ...)
// for the rest).

// Trade hub region IDs (public EVE Online static data, stable identifiers).
export const THE_FORGE = 10000002; // Jita
export const DOMAIN = 10000043; // Amarr
export const SINQ_LAISON = 10000032; // Dodixie
export const HEIMATAR = 10000030; // Rens
export const METROPOLIS = 10000042; // Hek

// The system each hub region's trade hub sits in (also public static data).
export const HUB_SYSTEMS = {
  [THE_FORGE]: 30000142, // Jita
  [DOMAIN]: 30002187, // Amarr
  [SINQ_LAISON]: 30002659, // Dodixie
  [HEIMATAR]: 30002510, // Rens
  [METROPOLIS]: 30002053, // Hek
};

const ROUTE_FLAGS = new Set(["shortest", "secure", "insecure"]);
const ORDER_TYPES = new Set(["buy", "sell", "all"]);

function requirePositiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive integer, got ${JSON.stringify(value)}`);
  }
  return value;
}

export function characterPublic(characterId) {
  requirePositiveInteger(characterId, "characterId");
  return { path: `/characters/${characterId}/` };
}

export function wallet(characterId) {
  requirePositiveInteger(characterId, "characterId");
  return { path: `/characters/${characterId}/wallet/` };
}

export function walletJournal(characterId, { page } = {}) {
  requirePositiveInteger(characterId, "characterId");
  const query = {};
  if (page !== undefined) query.page = requirePositiveInteger(page, "page");
  return { path: `/characters/${characterId}/wallet/journal/`, query };
}

export function skills(characterId) {
  requirePositiveInteger(characterId, "characterId");
  return { path: `/characters/${characterId}/skills/` };
}

export function skillQueue(characterId) {
  requirePositiveInteger(characterId, "characterId");
  return { path: `/characters/${characterId}/skillqueue/` };
}

export function location(characterId) {
  requirePositiveInteger(characterId, "characterId");
  return { path: `/characters/${characterId}/location/` };
}

export function ship(characterId) {
  requirePositiveInteger(characterId, "characterId");
  return { path: `/characters/${characterId}/ship/` };
}

export function assets(characterId, page = 1) {
  requirePositiveInteger(characterId, "characterId");
  requirePositiveInteger(page, "page");
  return { path: `/characters/${characterId}/assets/`, query: { page } };
}

export function marketOrders(regionId, { typeId, page, orderType = "all" } = {}) {
  requirePositiveInteger(regionId, "regionId");
  if (!ORDER_TYPES.has(orderType)) {
    throw new TypeError(`orderType must be one of ${[...ORDER_TYPES].join(", ")}, got ${JSON.stringify(orderType)}`);
  }
  const query = { order_type: orderType };
  if (typeId !== undefined) query.type_id = requirePositiveInteger(typeId, "typeId");
  if (page !== undefined) query.page = requirePositiveInteger(page, "page");
  return { path: `/markets/${regionId}/orders/`, query };
}

export function marketHistory(regionId, typeId) {
  requirePositiveInteger(regionId, "regionId");
  requirePositiveInteger(typeId, "typeId");
  return { path: `/markets/${regionId}/history/`, query: { type_id: typeId } };
}

export function route(originId, destinationId, flag = "shortest") {
  requirePositiveInteger(originId, "originId");
  requirePositiveInteger(destinationId, "destinationId");
  if (!ROUTE_FLAGS.has(flag)) {
    throw new TypeError(`flag must be one of ${[...ROUTE_FLAGS].join(", ")}, got ${JSON.stringify(flag)}`);
  }
  return { path: `/route/${originId}/${destinationId}/`, query: { flag } };
}

export function systemKills() {
  return { path: "/universe/system_kills/" };
}

export function status() {
  return { path: "/status/" };
}

export function universeIds(names) {
  if (!Array.isArray(names) || names.length === 0 || !names.every((name) => typeof name === "string" && name.trim() !== "")) {
    throw new TypeError("names must be a non-empty array of non-empty strings");
  }
  return { path: "/universe/ids/", method: "POST", body: names };
}

// Additive (2026-08-05, subrequest-budget fix — see ROADMAP.md Decisions and
// src/esi/name-resolver.mjs): ESI's bulk id->name resolver. Up to 1000 mixed
// ids (characters, corporations, alliances, types, systems, stations,
// constellations, regions, factions) in a single POST, returning
// [{ id, name, category }]. Distinct from universeIds() above (which goes
// the other direction, name -> id, via /universe/ids/); this is the
// counterpart every per-id GET name lookup in src/tools/*.mjs was refactored
// to use instead of one GET per id.
export function universeNames(ids) {
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => Number.isInteger(id) && id > 0)) {
    throw new TypeError("ids must be a non-empty array of positive integers");
  }
  if (ids.length > 1000) {
    throw new TypeError(`ids must contain 1000 or fewer entries (ESI's /universe/names/ batch limit), got ${ids.length}`);
  }
  return { path: "/universe/names/", method: "POST", body: ids };
}

export function typeInfo(typeId) {
  requirePositiveInteger(typeId, "typeId");
  return { path: `/universe/types/${typeId}/` };
}

export function systemInfo(systemId) {
  requirePositiveInteger(systemId, "systemId");
  return { path: `/universe/systems/${systemId}/` };
}

export function regionInfo(regionId) {
  requirePositiveInteger(regionId, "regionId");
  return { path: `/universe/regions/${regionId}/` };
}

export function characterOrders(characterId) {
  requirePositiveInteger(characterId, "characterId");
  return { path: `/characters/${characterId}/orders/` };
}

// Additive (not in the original 17-builder list): needed by
// src/tools/character-tools.mjs to resolve skill-group and station names.
// Same shape/validation convention as the rest of this catalog.
export function universeGroup(groupId) {
  requirePositiveInteger(groupId, "groupId");
  return { path: `/universe/groups/${groupId}/` };
}

export function universeStation(stationId) {
  requirePositiveInteger(stationId, "stationId");
  return { path: `/universe/stations/${stationId}/` };
}
