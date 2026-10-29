# cataloging

Generic keyed collection with faceted lookup, in a single dependency-free
module: `catalog.mjs`. No EVE-specific or otherwise domain-specific code —
this doc and the module are written so `src/cataloging/` can be lifted
verbatim into its own `@red-cup-engineering/cataloging` package later; that
extraction is a mechanical move, not a rewrite.

## What it is

A `Catalog` is an insertion-ordered set of items keyed by a caller-supplied
`key(item) -> string` function, with:

- **dedup-by-key on add** — re-adding an item whose key already exists is a
  no-op that counts as a "replay" rather than an error or an overwrite. This
  mirrors the append-only, skip-on-replay convention used elsewhere in this
  network (see the ledgering package's `dedupeAgainst`).
- **facets** — named projections `facetName -> (item) -> string | string[]`
  declared at creation time. A facet function may return a single string
  (the item files under one value) or an array of strings (the item files
  under every value — e.g. a `tags` facet).
- **validation** — an optional `validate(item)` hook that runs on every
  candidate item before it is added; throwing rejects the whole batch.

Nothing is cached: `facet()`/`facetCounts()` are recomputed from the current
item set on every call, per the network's "derive, never assert" convention.
There is no update or remove operation — this module models an append-only
catalog. If you need mutation, build it on top (e.g. by re-creating the
catalog from a filtered `toJSON()`), keeping this primitive simple.

## API

### `createCatalog({ name, key, facets?, validate? })`

- `name: string` — required, non-empty. Carried through `toJSON()` for
  provenance; not otherwise interpreted.
- `key(item) -> string` — required. Must return a non-empty string for every
  item, or `add` throws `TypeError`.
- `facets?: { [facetName]: (item) -> string | string[] }` — optional. Each
  function must return a non-empty string, or an array of non-empty strings,
  for every item, or `facet()`/`facetCounts()` throw `TypeError` when they
  encounter the bad value (lazily, at read time, not at add time).
- `validate?(item)` — optional. Throw from here to reject an item; the whole
  `add()` batch is rejected (nothing is partially committed), so a caller
  never has to reconcile a half-applied batch.

Returns a catalog object:

- `add(items: item[]) -> { added: number, replayed: number }` — items whose
  key already exists are skipped and counted as `replayed`; the first-seen
  item for a given key always wins (no overwrite-on-replay). Throws if
  `items` is not an array, if `validate` rejects any item, or if `key(item)`
  does not return a non-empty string.
- `all() -> item[]` — every item, in insertion order.
- `get(key: string) -> item | null` — `null` for an unknown key (not an
  error — a missing lookup is an expected outcome, not exceptional).
- `size() -> number`.
- `facet(facetName: string) -> Map<string, item[]>` — grouped by the named
  facet's value(s), recomputed from current contents each call.
- `facetCounts(facetName: string) -> { value: string, count: number }[]` —
  same grouping, collapsed to counts, sorted by count descending; ties are
  broken by `value` ascending so output order is deterministic.
- `filter(predicate: (item) -> boolean) -> item[]`.
- `toJSON() -> { name: string, items: item[] }` — behavior (`key`, `facets`,
  `validate`) is never serialized, only data; see `createCatalogFromJson`
  for the read side.

### `createCatalogFromJson(json, options)`

Rebuilds a catalog from `catalog.toJSON()` output. `options` takes the same
shape as `createCatalog` (`key` is required; `facets`/`validate` optional) —
behavior has to be supplied again, since it wasn't serialized. `json.name` is
used unless `options.name` overrides it. Items are re-added through the
normal `add()` path, so `validate` (if supplied) still runs and duplicate
keys within `json.items` still dedupe to the first occurrence.

## Example

```js
import { createCatalog } from "./catalog.mjs";

const modules = createCatalog({
  name: "fitted-modules",
  key: (m) => m.typeId,
  facets: {
    slot: (m) => m.slot,          // single-valued
    tags: (m) => m.tags ?? [],    // multi-valued
  },
  validate: (m) => {
    if (!m.typeId) throw new Error("module is missing typeId");
  },
});

modules.add([
  { typeId: "1405", slot: "high", tags: ["weapon", "hybrid"] },
  { typeId: "1978", slot: "mid", tags: ["tank"] },
]);

modules.facetCounts("slot");
// [{ value: "high", count: 1 }, { value: "mid", count: 1 }]
```

## Guarantees / limits

- No remove/update operation; this is an append-only, dedup-on-replay
  collection by design.
- Facet and validate functions are called by this module — if they throw
  something other than `Error`/`TypeError`, that value propagates unchanged.
- `Map` iteration order (insertion order) is what `all()` and `facet()`
  return items in; there is no separate sort step.
- Zero dependencies; only `Map`/`Set`/`Array`/`Object` — runs identically
  under Node 24 and Cloudflare Workers.

## Tests

`test/cataloging.test.mjs` (run via `npm test` at the package root) covers:
dedup/replay counts including first-write-wins on replay, multi-valued facet
grouping, `facetCounts` sort/tie-break order, the `validate` hook rejecting
a whole batch and running before the dedup check, and `toJSON` /
`createCatalogFromJson` round-tripping including dedup semantics on the
restored catalog.
