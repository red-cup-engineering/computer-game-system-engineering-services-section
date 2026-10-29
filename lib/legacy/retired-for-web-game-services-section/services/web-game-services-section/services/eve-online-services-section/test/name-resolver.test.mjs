import test from "node:test";
import assert from "node:assert/strict";
import { createNameResolver } from "../src/esi/name-resolver.mjs";
import { EsiError } from "../src/esi/esi-client.mjs";

function observationFor(path, body) {
  return {
    type: "EsiObservation",
    path,
    query: null,
    status: 200,
    expiresAt: null,
    recordedAt: 1000,
    etag: null,
    _bodyLength: body.length, // test-only extra field, harmless on a plain object
  };
}

// Fake ESI client exposing only request() (the resolver's pinned dependency
// shape). `namesTable` maps id -> {name, category}; requesting an id not in
// the table 404s the *whole* batch, matching real ESI's documented
// behavior for /universe/names/.
function createFakeEsi(namesTable) {
  const requests = [];
  return {
    requests,
    async request(method, path, { body } = {}) {
      requests.push({ method, path, ids: [...body] });
      assert.equal(method, "POST");
      assert.equal(path, "/universe/names/");
      if (body.some((id) => !Object.prototype.hasOwnProperty.call(namesTable, id))) {
        throw new EsiError({ status: 404, path, message: "one or more ids not found" });
      }
      const rows = body.map((id) => ({ id, name: namesTable[id].name, category: namesTable[id].category }));
      return { data: rows, observation: observationFor(path, body) };
    },
  };
}

test("createNameResolver requires an esi client exposing request()", () => {
  assert.throws(() => createNameResolver({}), TypeError);
  assert.throws(() => createNameResolver({ esi: { get: async () => {} } }), TypeError);
});

test("resolve() rejects a non-array or non-positive-integer ids argument", async () => {
  const resolver = createNameResolver({ esi: createFakeEsi({}) });
  await assert.rejects(() => resolver.resolve("not-an-array"), TypeError);
  await assert.rejects(() => resolver.resolve([1, 0, 2]), TypeError);
  await assert.rejects(() => resolver.resolve([1, -5]), TypeError);
  await assert.rejects(() => resolver.resolve([1, 1.5]), TypeError);
});

test("resolve() returns an empty Map and makes no fetch for an empty ids array", async () => {
  const esi = createFakeEsi({});
  const resolver = createNameResolver({ esi });
  const { names, observations } = await resolver.resolve([]);
  assert.equal(names.size, 0);
  assert.deepEqual(observations, []);
  assert.equal(esi.requests.length, 0);
});

test("resolve() dedupes ids before fetching: one POST body has each id once", async () => {
  const esi = createFakeEsi({
    30000142: { name: "Jita", category: "solar_system" },
  });
  const resolver = createNameResolver({ esi });
  const { names, observations } = await resolver.resolve([30000142, 30000142, 30000142]);
  assert.equal(esi.requests.length, 1);
  assert.deepEqual(esi.requests[0].ids, [30000142]);
  assert.equal(names.size, 1);
  assert.deepEqual(names.get(30000142), { name: "Jita", category: "solar_system" });
  assert.equal(observations.length, 1);
});

test("resolve() memoizes across two calls on the same resolver instance: two calls, one fetch", async () => {
  const esi = createFakeEsi({
    30000142: { name: "Jita", category: "solar_system" },
    60003760: { name: "Jita IV - Moon 4", category: "station" },
  });
  const resolver = createNameResolver({ esi });

  const first = await resolver.resolve([30000142]);
  assert.equal(esi.requests.length, 1);
  assert.equal(first.observations.length, 1);

  // Second call overlaps (30000142, already memoized) and adds one new id
  // (60003760): only the new id should be fetched.
  const second = await resolver.resolve([30000142, 60003760]);
  assert.equal(esi.requests.length, 2);
  assert.deepEqual(esi.requests[1].ids, [60003760]);
  assert.equal(second.observations.length, 1, "only the newly-fetched id should produce an observation on this call");
  assert.equal(second.names.get(30000142).name, "Jita");
  assert.equal(second.names.get(60003760).name, "Jita IV - Moon 4");

  // A third call for ids already seen makes zero fetches and surfaces zero
  // new observations.
  const third = await resolver.resolve([30000142, 60003760]);
  assert.equal(esi.requests.length, 2, "fully memoized resolve() must not fetch again");
  assert.deepEqual(third.observations, []);
});

test("resolve() chunks more than 1000 ids into multiple batches of at most 1000", async () => {
  const namesTable = {};
  const ids = [];
  for (let i = 1; i <= 1500; i += 1) {
    ids.push(i);
    namesTable[i] = { name: `Item ${i}`, category: "inventory_type" };
  }
  const esi = createFakeEsi(namesTable);
  const resolver = createNameResolver({ esi });

  const { names, observations } = await resolver.resolve(ids);

  assert.equal(esi.requests.length, 2);
  assert.equal(esi.requests[0].ids.length, 1000);
  assert.equal(esi.requests[1].ids.length, 500);
  assert.equal(names.size, 1500);
  assert.equal(names.get(750).name, "Item 750");
  assert.equal(observations.length, 2);
});

test("resolve() bisects on a whole-batch 404 to isolate exactly one bad id among good ones", async () => {
  const esi = createFakeEsi({
    1: { name: "Good One", category: "inventory_type" },
    2: { name: "Good Two", category: "inventory_type" },
    // 3 is deliberately absent -- the one bad id
    4: { name: "Good Four", category: "inventory_type" },
  });
  const resolver = createNameResolver({ esi });

  const { names, observations } = await resolver.resolve([1, 2, 3, 4]);

  assert.equal(names.get(1).name, "Good One");
  assert.equal(names.get(2).name, "Good Two");
  assert.equal(names.get(3), null, "the one unresolvable id must be labeled null, not dropped");
  assert.equal(names.get(4).name, "Good Four");
  // Successful sub-batches each produce an observation; the failed
  // whole-batch attempt and the failed singleton attempt for id 3 do not
  // (matches the rest of the codebase's rule: an observation exists only
  // where a fetch actually succeeded -- see esi-client.mjs's request(),
  // which never returns an observation on a non-2xx response).
  assert.ok(observations.length >= 1);
  assert.ok(observations.every((o) => o.type === "EsiObservation"));
  // Recovery must not degrade into one request per id: 4 ids, at most a
  // small constant number of bisection attempts beyond the first.
  assert.ok(esi.requests.length <= 1 + 8, `expected bounded recovery, got ${esi.requests.length} requests`);
});

test("resolve() caps total 404-recovery subrequests: an all-bad chunk does not approach one request per id", async () => {
  const namesTable = {}; // every id is unresolvable
  const ids = Array.from({ length: 200 }, (_, i) => i + 1);
  const esi = createFakeEsi(namesTable);
  const resolver = createNameResolver({ esi });

  const { names, observations } = await resolver.resolve(ids);

  assert.equal(names.size, 200);
  for (const id of ids) assert.equal(names.get(id), null);
  assert.deepEqual(observations, []);
  // The whole point of the recovery budget: 200 all-bad ids must not cost
  // anywhere near 200 subrequests.
  assert.ok(esi.requests.length < 20, `expected a bounded recovery cost, got ${esi.requests.length} requests`);
});

test("resolve() propagates a non-404 EsiError (e.g. rate limiting) without swallowing it", async () => {
  const esi = {
    async request() {
      throw new EsiError({ status: 420, path: "/universe/names/", message: "error limited" });
    },
  };
  const resolver = createNameResolver({ esi });
  await assert.rejects(() => resolver.resolve([1, 2, 3]), (err) => err instanceof EsiError && err.status === 420);
});

test("resolve() labels ids ESI silently omits from a 2xx response body as null", async () => {
  const esi = {
    requests: [],
    async request(method, path, { body }) {
      this.requests.push(body);
      // Real ESI: a 2xx response can carry fewer rows than requested ids in
      // some edge cases (documented as possible, distinct from the 404 case).
      return {
        data: [{ id: 1, name: "Only One", category: "inventory_type" }],
        observation: observationFor(path, body),
      };
    },
  };
  const resolver = createNameResolver({ esi });
  const { names } = await resolver.resolve([1, 2]);
  assert.equal(names.get(1).name, "Only One");
  assert.equal(names.get(2), null);
});
