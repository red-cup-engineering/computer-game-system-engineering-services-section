// test/cataloging.test.mjs
//
// Exercises src/cataloging/catalog.mjs: dedup/replay counts, multi-valued
// facets, facetCounts ordering, the validate hook, and toJSON/fromJSON
// round-tripping. Uses a small invented "widget" domain — this module is
// EVE-agnostic and must be tested that way.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createCatalog, createCatalogFromJson } from "../src/cataloging/catalog.mjs";

function makeWidgetCatalog(overrides = {}) {
  return createCatalog({
    name: "widgets",
    key: (item) => item.id,
    facets: {
      color: (item) => item.color,
      tags: (item) => item.tags,
    },
    ...overrides,
  });
}

// --- construction validation -----------------------------------------------

test("createCatalog rejects missing/invalid name", () => {
  assert.throws(() => createCatalog({ key: (i) => i.id }), TypeError);
  assert.throws(() => createCatalog({ name: "", key: (i) => i.id }), TypeError);
});

test("createCatalog rejects missing key function", () => {
  assert.throws(() => createCatalog({ name: "widgets" }), TypeError);
  assert.throws(() => createCatalog({ name: "widgets", key: "not-a-function" }), TypeError);
});

test("createCatalog rejects non-function facet entries", () => {
  assert.throws(
    () => createCatalog({ name: "widgets", key: (i) => i.id, facets: { color: "red" } }),
    TypeError,
  );
});

test("createCatalog rejects non-function validate", () => {
  assert.throws(
    () => createCatalog({ name: "widgets", key: (i) => i.id, validate: "nope" }),
    TypeError,
  );
});

// --- add(): dedup / replay counts ------------------------------------------

test("add reports added count on first insert and replayed count on re-add by key", () => {
  const catalog = makeWidgetCatalog();
  const first = catalog.add([
    { id: "w1", color: "red", tags: ["small"] },
    { id: "w2", color: "blue", tags: ["large"] },
  ]);
  assert.deepEqual(first, { added: 2, replayed: 0 });

  const second = catalog.add([
    { id: "w1", color: "red", tags: ["small"] }, // replay
    { id: "w3", color: "green", tags: ["small", "shiny"] }, // new
  ]);
  assert.deepEqual(second, { added: 1, replayed: 1 });
  assert.equal(catalog.size(), 3);
});

test("add keeps the first-seen item on replay (does not overwrite)", () => {
  const catalog = makeWidgetCatalog();
  catalog.add([{ id: "w1", color: "red", tags: ["small"] }]);
  catalog.add([{ id: "w1", color: "blue", tags: ["large"] }]);
  assert.equal(catalog.get("w1").color, "red");
});

test("add rejects non-array input", () => {
  const catalog = makeWidgetCatalog();
  assert.throws(() => catalog.add({ id: "w1" }), TypeError);
});

test("get returns null for unknown key and throws for a bad key argument", () => {
  const catalog = makeWidgetCatalog();
  assert.equal(catalog.get("nope"), null);
  assert.throws(() => catalog.get(""), TypeError);
});

// --- facets: multi-valued and single-valued --------------------------------

test("facet groups items under every value of a multi-valued (array) facet", () => {
  const catalog = makeWidgetCatalog();
  catalog.add([
    { id: "w1", color: "red", tags: ["small", "shiny"] },
    { id: "w2", color: "blue", tags: ["large"] },
    { id: "w3", color: "red", tags: ["shiny"] },
  ]);

  const byTag = catalog.facet("tags");
  assert.deepEqual(
    byTag.get("shiny").map((w) => w.id).sort(),
    ["w1", "w3"],
  );
  assert.deepEqual(byTag.get("small").map((w) => w.id), ["w1"]);
  assert.deepEqual(byTag.get("large").map((w) => w.id), ["w2"]);

  const byColor = catalog.facet("color");
  assert.deepEqual(byColor.get("red").map((w) => w.id).sort(), ["w1", "w3"]);
});

test("facet throws for an undeclared facet name", () => {
  const catalog = makeWidgetCatalog();
  assert.throws(() => catalog.facet("nonexistent"), TypeError);
});

test("facet throws when a facet function returns a non-string / empty-string value", () => {
  const catalog = createCatalog({
    name: "widgets",
    key: (i) => i.id,
    facets: { bad: () => 42 },
  });
  catalog.add([{ id: "w1" }]);
  assert.throws(() => catalog.facet("bad"), TypeError);
});

// --- facetCounts: sort order -------------------------------------------------

test("facetCounts sorts by count descending, ties broken by value ascending", () => {
  const catalog = makeWidgetCatalog();
  catalog.add([
    { id: "w1", color: "red", tags: ["a"] },
    { id: "w2", color: "red", tags: ["a"] },
    { id: "w3", color: "blue", tags: ["a"] },
    { id: "w4", color: "green", tags: ["a"] },
  ]);
  const counts = catalog.facetCounts("color");
  assert.deepEqual(counts, [
    { value: "red", count: 2 },
    { value: "blue", count: 1 }, // tie with green, "blue" < "green"
    { value: "green", count: 1 },
  ]);
});

// --- validate hook -----------------------------------------------------------

test("validate hook rejects an invalid item and the batch throws before mutating the catalog", () => {
  const catalog = makeWidgetCatalog({
    validate: (item) => {
      if (!item.color) throw new Error(`widget "${item.id}" is missing a color`);
    },
  });
  assert.throws(
    () => catalog.add([{ id: "w1", color: "red", tags: [] }, { id: "w2", tags: [] }]),
    /missing a color/,
  );
  // The whole batch is rejected: even the valid w1 that preceded the bad
  // item in iteration order must not have been committed.
  assert.equal(catalog.size(), 0);
});

test("validate hook runs before the dedup check (a rejected item never reaches the store)", () => {
  let calls = 0;
  const catalog = makeWidgetCatalog({
    validate: () => {
      calls += 1;
      throw new Error("always rejects");
    },
  });
  assert.throws(() => catalog.add([{ id: "w1", color: "red", tags: [] }]));
  assert.equal(calls, 1);
  assert.equal(catalog.size(), 0);
});

// --- filter / all / size -----------------------------------------------------

test("filter and all reflect current contents", () => {
  const catalog = makeWidgetCatalog();
  catalog.add([
    { id: "w1", color: "red", tags: [] },
    { id: "w2", color: "blue", tags: [] },
  ]);
  assert.equal(catalog.all().length, 2);
  assert.deepEqual(
    catalog.filter((w) => w.color === "blue").map((w) => w.id),
    ["w2"],
  );
});

// --- toJSON / fromJSON round-trip -------------------------------------------

test("toJSON / createCatalogFromJson round-trips items and preserves dedup semantics", () => {
  const catalog = makeWidgetCatalog();
  catalog.add([
    { id: "w1", color: "red", tags: ["small"] },
    { id: "w2", color: "blue", tags: ["large", "shiny"] },
  ]);
  const json = catalog.toJSON();
  assert.equal(json.name, "widgets");
  assert.equal(json.items.length, 2);

  const restored = createCatalogFromJson(json, {
    key: (item) => item.id,
    facets: { color: (item) => item.color, tags: (item) => item.tags },
  });
  assert.equal(restored.size(), 2);
  assert.deepEqual(restored.get("w1"), { id: "w1", color: "red", tags: ["small"] });
  assert.deepEqual(restored.toJSON(), json);

  // Re-adding through the restored catalog still dedupes by key.
  const replay = restored.add([{ id: "w1", color: "red", tags: ["small"] }]);
  assert.deepEqual(replay, { added: 0, replayed: 1 });
});

test("createCatalogFromJson rejects malformed input", () => {
  assert.throws(() => createCatalogFromJson(null, { key: (i) => i.id }), TypeError);
  assert.throws(() => createCatalogFromJson({ name: "x" }, { key: (i) => i.id }), TypeError);
});

test("createCatalogFromJson allows overriding the serialized name", () => {
  const catalog = makeWidgetCatalog();
  catalog.add([{ id: "w1", color: "red", tags: [] }]);
  const json = catalog.toJSON();
  const restored = createCatalogFromJson(json, { name: "renamed-widgets", key: (item) => item.id });
  assert.equal(restored.toJSON().name, "renamed-widgets");
});
