import test from "node:test";
import assert from "node:assert/strict";
import { createEsiClient, EsiError } from "../src/esi/esi-client.mjs";

function fakeResponse({ status = 200, body = {}, headers = {} } = {}) {
  const headerMap = new Map(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  return {
    status,
    headers: {
      get(name) {
        return headerMap.has(name.toLowerCase()) ? headerMap.get(name.toLowerCase()) : null;
      },
    },
    async text() {
      return body === null ? "" : JSON.stringify(body);
    },
  };
}

test("get() resolves data + observation on success, with Expires/etag parsed", async () => {
  let capturedUrl;
  let capturedInit;
  const fetchImpl = async (url, init) => {
    capturedUrl = url;
    capturedInit = init;
    return fakeResponse({
      status: 200,
      body: { balance: 123.45 },
      headers: {
        Expires: "Tue, 05 Aug 2026 21:00:00 GMT",
        ETag: '"abc123"',
        "X-Esi-Error-Limit-Remain": "90",
        "X-Esi-Error-Limit-Reset": "30",
      },
    });
  };
  const client = createEsiClient({ fetchImpl, userAgent: "eve-assist-test/1.0 (test@example.com)", now: () => 1754433600000 });

  const { data, observation } = await client.get("/characters/123/wallet/", { token: "tok", query: { page: 2 } });

  assert.deepEqual(data, { balance: 123.45 });
  assert.equal(observation.type, "EsiObservation");
  assert.equal(observation.path, "/characters/123/wallet/");
  assert.deepEqual(observation.query, { page: 2 });
  assert.equal(observation.status, 200);
  assert.equal(observation.recordedAt, 1754433600000);
  assert.equal(observation.etag, '"abc123"');
  assert.equal(observation.expiresAt, Date.parse("Tue, 05 Aug 2026 21:00:00 GMT"));

  assert.equal(String(capturedUrl), "https://esi.evetech.net/latest/characters/123/wallet/?page=2");
  assert.equal(capturedInit.headers.Authorization, "Bearer tok");
  assert.equal(capturedInit.headers["User-Agent"], "eve-assist-test/1.0 (test@example.com)");
});

test("get() defaults observation.query to null when no query given", async () => {
  const fetchImpl = async () => fakeResponse({ status: 200, body: { ok: true } });
  const client = createEsiClient({ fetchImpl, userAgent: "ua" });
  const { observation } = await client.get("/status/");
  assert.equal(observation.query, null);
  assert.equal(observation.expiresAt, null);
  assert.equal(observation.etag, null);
});

test("get() throws EsiError with status/path/error-limit fields on non-2xx", async () => {
  const fetchImpl = async () =>
    fakeResponse({
      status: 420,
      body: { error: "Error limited!" },
      headers: { "X-Esi-Error-Limit-Remain": "0", "X-Esi-Error-Limit-Reset": "45" },
    });
  // remain=0 is at/below the backoff threshold, so this response must also
  // back off (not just throw) -- see "backs off before throwing" below for
  // the assertion that sleepImpl actually runs; a real timer here would
  // otherwise stall this test for 45 real seconds.
  let sleptMs = null;
  const client = createEsiClient({
    fetchImpl,
    userAgent: "ua",
    sleepImpl: async (ms) => {
      sleptMs = ms;
    },
  });

  await assert.rejects(
    () => client.get("/characters/123/wallet/"),
    (error) => {
      assert.ok(error instanceof EsiError);
      assert.equal(error.status, 420);
      assert.equal(error.path, "/characters/123/wallet/");
      assert.equal(error.errorLimitRemain, 0);
      assert.equal(error.errorLimitReset, 45);
      return true;
    },
  );
  assert.equal(sleptMs, 45000);
});

test("get() backs off before throwing when an error response itself is close to the error-limit ban", async () => {
  // The error-limit header is decremented by error responses, so an error
  // response with a low remain is exactly the case backoff exists for --
  // previously the client only checked/backed off on the 2xx path and threw
  // immediately (with no backoff) for any non-2xx status.
  const fetchImpl = async () =>
    fakeResponse({
      status: 500,
      body: { error: "internal error" },
      headers: { "X-Esi-Error-Limit-Remain": "2", "X-Esi-Error-Limit-Reset": "10" },
    });
  let sleptMs = null;
  const client = createEsiClient({
    fetchImpl,
    userAgent: "ua",
    sleepImpl: async (ms) => {
      sleptMs = ms;
    },
  });

  await assert.rejects(() => client.get("/status/"), EsiError);
  assert.equal(sleptMs, 10000);
});

test("get() throws the real error status (not a synthetic error-limit error) when an error response has no reset window", async () => {
  const fetchImpl = async () =>
    fakeResponse({
      status: 503,
      body: { error: "service unavailable" },
      headers: { "X-Esi-Error-Limit-Remain": "1" },
    });
  const client = createEsiClient({ fetchImpl, userAgent: "ua" });

  await assert.rejects(
    () => client.get("/status/"),
    (error) => {
      assert.ok(error instanceof EsiError);
      assert.equal(error.status, 503);
      return true;
    },
  );
});

test("get() delays (does not throw) when error limit remain is low but reset is present", async () => {
  const fetchImpl = async () =>
    fakeResponse({
      status: 200,
      body: { ok: true },
      headers: { "X-Esi-Error-Limit-Remain": "3", "X-Esi-Error-Limit-Reset": "12" },
    });
  let sleptMs = null;
  const sleepImpl = async (ms) => {
    sleptMs = ms;
  };
  const client = createEsiClient({ fetchImpl, userAgent: "ua", sleepImpl });

  const { data } = await client.get("/status/");
  assert.deepEqual(data, { ok: true });
  assert.equal(sleptMs, 12000);
});

test("get() throws when error limit remain is low and no reset window is given", async () => {
  const fetchImpl = async () =>
    fakeResponse({ status: 200, body: { ok: true }, headers: { "X-Esi-Error-Limit-Remain": "1" } });
  const client = createEsiClient({ fetchImpl, userAgent: "ua" });

  await assert.rejects(() => client.get("/status/"), EsiError);
});

test("get() does not throttle when error limit remain is comfortably high", async () => {
  const fetchImpl = async () =>
    fakeResponse({ status: 200, body: { ok: true }, headers: { "X-Esi-Error-Limit-Remain": "80" } });
  let slept = false;
  const client = createEsiClient({ fetchImpl, userAgent: "ua", sleepImpl: async () => { slept = true; } });

  await client.get("/status/");
  assert.equal(slept, false);
});

test("get() handles empty response bodies as null data", async () => {
  const fetchImpl = async () => fakeResponse({ status: 200, body: null });
  const client = createEsiClient({ fetchImpl, userAgent: "ua" });
  const { data } = await client.get("/status/");
  assert.equal(data, null);
});

test("createEsiClient requires a userAgent", () => {
  assert.throws(() => createEsiClient({}), TypeError);
  assert.throws(() => createEsiClient({ userAgent: "" }), TypeError);
});

test("get() validates path shape", async () => {
  const client = createEsiClient({ fetchImpl: async () => fakeResponse(), userAgent: "ua" });
  await assert.rejects(() => client.get("no-leading-slash"), TypeError);
  await assert.rejects(() => client.get(42), TypeError);
});

test("request() supports non-GET methods with a body (e.g. universe/ids POST)", async () => {
  let capturedInit;
  const fetchImpl = async (url, init) => {
    capturedInit = init;
    return fakeResponse({ status: 200, body: { characters: [] } });
  };
  const client = createEsiClient({ fetchImpl, userAgent: "ua" });
  const { data } = await client.request("POST", "/universe/ids/", { body: ["CCP Bartender"] });
  assert.deepEqual(data, { characters: [] });
  assert.equal(capturedInit.method, "POST");
  assert.equal(capturedInit.headers["Content-Type"], "application/json");
  assert.equal(capturedInit.body, JSON.stringify(["CCP Bartender"]));
});

// The 2026-08-05 subrequest-budget fix (see ROADMAP.md Decisions and
// src/esi/name-resolver.mjs) batches per-id name lookups through this exact
// POST. get() alone (GET-only) cannot make this request; request() -- the
// same additive, non-pinned method the /universe/ids/ test above exercises
// -- is what name-resolver.mjs calls, and observation.path must still read
// the plain endpoint path (not e.g. a method-prefixed variant) so downstream
// consumers of observations don't need to special-case POST-shaped calls.
test("request() POSTs to /universe/names/ and the observation records the plain path", async () => {
  let capturedUrl;
  let capturedInit;
  const fetchImpl = async (url, init) => {
    capturedUrl = url;
    capturedInit = init;
    return fakeResponse({
      status: 200,
      body: [{ id: 30000142, name: "Jita", category: "solar_system" }],
    });
  };
  const client = createEsiClient({ fetchImpl, userAgent: "ua" });
  const { data, observation } = await client.request("POST", "/universe/names/", { body: [30000142] });

  assert.deepEqual(data, [{ id: 30000142, name: "Jita", category: "solar_system" }]);
  assert.equal(String(capturedUrl), "https://esi.evetech.net/latest/universe/names/");
  assert.equal(capturedInit.method, "POST");
  assert.equal(capturedInit.body, JSON.stringify([30000142]));
  assert.equal(observation.type, "EsiObservation");
  assert.equal(observation.path, "/universe/names/");
});
