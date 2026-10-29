// src/cataloging/catalog.mjs
//
// Generic keyed collection with faceted lookup. Deliberately EVE-agnostic and
// deliberately not import-coupled to any sibling src/ dir except
// src/addressing (not used here — this module needs no content-addressing of
// its own; each item's identity is supplied by the caller's `key` function).
// Intended to be extracted verbatim into its own @red-cup-engineering
// package: no EVE names, no hardcoded domain vocabulary, every behavior
// parameterized by the options passed to createCatalog.
//
// Web APIs only: Map/Set/Array, no node:fs, no node:*. Runs under Node 24 and
// Cloudflare Workers alike.

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
}

function requireFunction(value, label) {
  if (typeof value !== "function") {
    throw new TypeError(`${label} must be a function`);
  }
}

/**
 * Normalizes a facet function's return value into a string array.
 *
 * Facet functions may return a single string (single-valued facet, e.g.
 * "region") or an array of strings (multi-valued facet, e.g. "tags"). Any
 * other return shape is a bug in the facet function, not caller-input error,
 * so it throws a TypeError naming the facet and the offending item's key.
 */
function normalizeFacetValues(raw, facetName, itemKey) {
  const values = Array.isArray(raw) ? raw : [raw];
  for (const value of values) {
    if (typeof value !== "string" || value.length === 0) {
      throw new TypeError(
        `Facet "${facetName}" must return a non-empty string or array of non-empty strings (item key "${itemKey}")`,
      );
    }
  }
  return values;
}

/**
 * Creates a typed keyed collection with optional faceted lookup.
 *
 * Options:
 * - name: non-empty string, carried through toJSON/round-trips for
 *   provenance; not otherwise interpreted.
 * - key(item) -> string: derives each item's identity. Required.
 * - facets?: { [facetName]: (item) -> string | string[] }. Each facet
 *   function projects an item onto one or more facet values (e.g. an array
 *   return means the item is filed under every value — a multi-valued
 *   facet like tags).
 * - validate?(item): called before an item is added; throw to reject it.
 *   Runs before the dedup/key check, so a rejected item never reaches the
 *   store even if its key would have collided.
 *
 * Returns a catalog object; see individual method docs below.
 */
export function createCatalog({ name, key, facets = {}, validate } = {}) {
  requireNonEmptyString(name, "createCatalog: name");
  requireFunction(key, "createCatalog: key");
  if (facets === null || typeof facets !== "object" || Array.isArray(facets)) {
    throw new TypeError("createCatalog: facets must be a plain object of facetName -> function");
  }
  for (const [facetName, facetFn] of Object.entries(facets)) {
    requireFunction(facetFn, `createCatalog: facets["${facetName}"]`);
  }
  if (validate !== undefined) {
    requireFunction(validate, "createCatalog: validate");
  }

  // Insertion-ordered store of key -> item.
  const items = new Map();

  function deriveKey(item) {
    const derived = key(item);
    requireNonEmptyString(derived, `createCatalog("${name}"): key(item) result`);
    return derived;
  }

  /**
   * Adds items (an array), skipping any whose key already exists in the
   * catalog (append-only, dedup-by-key — mirrors the network's
   * skip-on-replay convention used elsewhere, e.g. ledger dedupeAgainst).
   * `validate`, if supplied, runs on every candidate item and throws to
   * reject the whole batch.
   *
   * Two passes, deliberately (atomic-mutation convention: stage, then
   * commit — never leave a partially-applied batch behind). Pass 1 runs
   * validate and derives keys for every item without touching the store; if
   * anything throws, the catalog is untouched, including items earlier in
   * the batch that would otherwise have been valid. Pass 2 commits the
   * items that passed and were not replays.
   *
   * Returns { added, replayed }: counts, not the items themselves, per the
   * network's "derive, never assert" convention — callers that need the
   * items back call all()/get() afterward.
   */
  function add(newItems) {
    if (!Array.isArray(newItems)) {
      throw new TypeError(`createCatalog("${name}").add requires an array of items`);
    }
    const staged = newItems.map((item) => {
      if (validate) validate(item);
      return { item, itemKey: deriveKey(item) };
    });
    let added = 0;
    let replayed = 0;
    for (const { item, itemKey } of staged) {
      if (items.has(itemKey)) {
        replayed += 1;
        continue;
      }
      items.set(itemKey, item);
      added += 1;
    }
    return { added, replayed };
  }

  function all() {
    return Array.from(items.values());
  }

  function get(itemKey) {
    requireNonEmptyString(itemKey, `createCatalog("${name}").get: itemKey`);
    return items.has(itemKey) ? items.get(itemKey) : null;
  }

  function size() {
    return items.size;
  }

  /**
   * Builds a Map(facetValue -> item[]) for the named facet, computed fresh
   * from the current item set each call (derive, never cache-and-drift). An
   * item whose facet function returns an array is filed under every value
   * in that array. Throws if facetName was not declared at createCatalog
   * time.
   */
  function facet(facetName) {
    requireNonEmptyString(facetName, `createCatalog("${name}").facet: facetName`);
    const facetFn = facets[facetName];
    if (typeof facetFn !== "function") {
      throw new TypeError(`createCatalog("${name}"): unknown facet "${facetName}"`);
    }
    const grouped = new Map();
    for (const [itemKey, item] of items) {
      const values = normalizeFacetValues(facetFn(item), facetName, itemKey);
      for (const value of values) {
        if (!grouped.has(value)) grouped.set(value, []);
        grouped.get(value).push(item);
      }
    }
    return grouped;
  }

  /**
   * Same grouping as facet(), collapsed to counts and sorted descending by
   * count (ties broken by facet value, ascending, for deterministic output).
   */
  function facetCounts(facetName) {
    const grouped = facet(facetName);
    return Array.from(grouped.entries(), ([value, list]) => ({ value, count: list.length })).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.value < b.value ? -1 : a.value > b.value ? 1 : 0;
    });
  }

  function filter(predicate) {
    requireFunction(predicate, `createCatalog("${name}").filter: predicate`);
    return all().filter(predicate);
  }

  /**
   * Serializes the catalog to a plain JSON-compatible object: { name,
   * items }. Facet/validate/key functions are not serialized — they are
   * behavior, supplied fresh by the caller on the fromJSON side via
   * `options` (see createCatalogFromJson), matching the network convention
   * that behavior is code, not data.
   */
  function toJSON() {
    return { name, items: all() };
  }

  return { add, all, get, size, facet, facetCounts, filter, toJSON };
}

/**
 * Rebuilds a catalog from createCatalog(...).toJSON() output plus the same
 * kind of options createCatalog takes (key/facets/validate — behavior isn't
 * serialized, so it must be supplied again here). `json.name` is used unless
 * `options.name` overrides it; `json.items` are re-added through the normal
 * add() path, so validate (if supplied) still runs and duplicate keys within
 * json.items still dedupe (last write wins is not possible: dedup keeps the
 * first occurrence, matching add()'s replay semantics).
 */
export function createCatalogFromJson(json, options = {}) {
  if (json === null || typeof json !== "object" || Array.isArray(json)) {
    throw new TypeError("createCatalogFromJson requires a plain object (catalog toJSON() output)");
  }
  if (!Array.isArray(json.items)) {
    throw new TypeError("createCatalogFromJson: json.items must be an array");
  }
  const name = options.name ?? json.name;
  const catalog = createCatalog({ ...options, name });
  catalog.add(json.items);
  return catalog;
}
