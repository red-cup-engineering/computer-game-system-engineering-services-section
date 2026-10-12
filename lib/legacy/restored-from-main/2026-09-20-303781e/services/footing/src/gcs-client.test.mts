// Tests gcs-client.mjs directly: the atomic single-request getObject (generation off the
// alt=media response's own x-goog-generation header, no separate metadata GET) and the
// opt-in retry wiring createGcsClient's `retry` option turns on.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createGcsClient } from "./gcs-client.mjs";

const API_BASE = "https://fake-gcs.test";
const BUCKET = "test-bucket";

function fakeGcs() {
  const objects = new Map<string, { text: string; generation: number }>();
  let nextGeneration = 1;
  const requestLog: string[] = [];

  async function request(url: string, init: RequestInit = {}): Promise<Response> {
    const u = new URL(url);
    requestLog.push(`${init.method ?? "GET"} ${u.pathname}${u.search}`);
    const storageRoot = `${API_BASE}/storage/v1/b/${BUCKET}/o`;

    if (u.pathname === `${new URL(`${API_BASE}/upload/storage/v1/b/${BUCKET}/o`).pathname}` && init.method === "POST") {
      const name = decodeURIComponent(u.searchParams.get("name") ?? "");
      const ifGenerationMatch = u.searchParams.get("ifGenerationMatch");
      const current = objects.get(name);
      const currentGen = current?.generation ?? 0;
      if (String(currentGen) !== ifGenerationMatch) return new Response(null, { status: 412 });
      const generation = nextGeneration++;
      const text = typeof init.body === "string" ? init.body : String(init.body);
      objects.set(name, { text, generation });
      return Response.json({ generation: String(generation) });
    }

    if (u.pathname.startsWith(`${new URL(storageRoot).pathname}/`) && u.searchParams.get("alt") === "media") {
      const name = decodeURIComponent(u.pathname.slice(new URL(storageRoot).pathname.length + 1));
      const obj = objects.get(name);
      if (!obj) return new Response(null, { status: 404 });
      return new Response(obj.text, { status: 200, headers: { "x-goog-generation": String(obj.generation) } });
    }

    return new Response(null, { status: 404 });
  }

  return { request, requestLog };
}

test("getObject: a single alt=media request carries both content and generation", async () => {
  const gcs = fakeGcs();
  const client = createGcsClient({ bucket: BUCKET, apiBase: API_BASE, request: gcs.request });
  await client.putObject("world.json", '{"a":1}', "0");
  gcs.requestLog.length = 0;
  const found = await client.getObject("world.json");
  assert.deepEqual(found, { text: '{"a":1}', generation: "1" });
  assert.equal(gcs.requestLog.length, 1, "getObject must make exactly one request, not a metadata-then-content pair");
});

test("getObject: a missing object is null, not thrown", async () => {
  const gcs = fakeGcs();
  const client = createGcsClient({ bucket: BUCKET, apiBase: API_BASE, request: gcs.request });
  assert.equal(await client.getObject("absent.json"), null);
});

test("createGcsClient: retry is opt-in -- a transient 503 is not retried unless `retry` is passed", async () => {
  let calls = 0;
  const flaky = async () => {
    calls++;
    return calls === 1 ? new Response(null, { status: 503 }) : Response.json({ generation: "1" });
  };
  const client = createGcsClient({ bucket: BUCKET, apiBase: API_BASE, request: flaky });
  await assert.rejects(() => client.putObject("x.json", "{}", "0"), /HTTP 503/);
  assert.equal(calls, 1, "no retry option means the first 503 surfaces immediately, no second attempt");
});

test("createGcsClient: `retry: {...}` wraps every call in gcs-retry's bounded backoff", async () => {
  let calls = 0;
  const flaky = async () => {
    calls++;
    return calls < 3 ? new Response(null, { status: 503 }) : Response.json({ generation: "1" });
  };
  const client = createGcsClient({
    bucket: BUCKET,
    apiBase: API_BASE,
    request: flaky,
    retry: { sleep: async () => {}, onRetry: () => {}, onExhausted: () => {} },
  });
  const result = await client.putObject("x.json", "{}", "0");
  assert.equal(result.ok, true);
  assert.equal(calls, 3);
});
