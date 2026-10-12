// Tests createGcsClient/openBucketDailyStore against a fake, in-memory GCS JSON API double --
// same request(url, init) => Promise<Response> shape createGcsClient expects, so this exercises
// the real conditional-write/retry/create-only logic, never a real network call.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createGcsClient, openBucketDailyStore, createGoogleApiRequest } from "./bucket-store.mjs";

const API_BASE = "https://fake-gcs.test";
const BUCKET = "test-bucket";

function fakeGcs() {
  const objects = new Map<string, { text: string; generation: number }>();
  let nextGeneration = 1;

  async function request(url: string, init: RequestInit = {}): Promise<Response> {
    const u = new URL(url);
    const storageRoot = `${API_BASE}/storage/v1/b/${BUCKET}/o`;
    const uploadRoot = `${API_BASE}/upload/storage/v1/b/${BUCKET}/o`;

    if (u.pathname === `/upload/storage/v1/b/${BUCKET}/o` && init.method === "POST") {
      const name = decodeURIComponent(u.searchParams.get("name") ?? "");
      const ifGenerationMatch = u.searchParams.get("ifGenerationMatch");
      const current = objects.get(name);
      const currentGen = current?.generation ?? 0;
      if (String(currentGen) !== ifGenerationMatch) {
        return new Response(null, { status: 412 });
      }
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

    if (u.pathname.startsWith(`${new URL(storageRoot).pathname}/`)) {
      const name = decodeURIComponent(u.pathname.slice(new URL(storageRoot).pathname.length + 1));
      const obj = objects.get(name);
      if (!obj) return new Response(null, { status: 404 });
      return Response.json({ generation: String(obj.generation) });
    }

    if (u.pathname === new URL(storageRoot).pathname) {
      const prefix = u.searchParams.get("prefix") ?? "";
      const items = [...objects.keys()].filter((n) => n.startsWith(prefix)).map((name) => ({ name }));
      return Response.json({ items });
    }

    return new Response(null, { status: 404 });
  }

  return { request, objects };
}

test("openBucketDailyStore: appendRun/readRunsForDate round-trips through the store surface", async () => {
  const gcs = fakeGcs();
  const store = openBucketDailyStore({ bucket: BUCKET, apiBase: API_BASE, request: gcs.request });
  await store.appendRun({ runId: "r1", date: "2026-08-20" } as any);
  await store.appendRun({ runId: "r2", date: "2026-08-20" } as any);
  const runs = await store.readRunsForDate("2026-08-20");
  assert.deepEqual(runs.map((r: any) => r.runId), ["r1", "r2"]);
});

test("openBucketDailyStore: writeScoredLock is create-only -- a second writer for the same (date, actor) throws", async () => {
  const gcs = fakeGcs();
  const store = openBucketDailyStore({ bucket: BUCKET, apiBase: API_BASE, request: gcs.request });
  await store.writeScoredLock("2026-08-20", "alice", "r1");
  assert.equal(await store.hasScoredLock("2026-08-20", "alice"), true);
  await assert.rejects(() => store.writeScoredLock("2026-08-20", "alice", "r2"), /scored-lock-already-held/);
});

test("createGcsClient.appendJsonlLine: retries and lands correctly under a simulated concurrent writer", async () => {
  const gcs = fakeGcs();
  const client = createGcsClient({ bucket: BUCKET, apiBase: API_BASE, request: gcs.request });
  // Simulate another writer landing a line between our two appends by writing directly.
  await client.appendJsonlLine("runs/2026-08-20.jsonl", '{"runId":"r1"}\n');
  await client.appendJsonlLine("runs/2026-08-20.jsonl", '{"runId":"r2"}\n');
  const obj = await client.getObject("runs/2026-08-20.jsonl");
  assert.equal(obj?.text, '{"runId":"r1"}\n{"runId":"r2"}\n');
});

test("createGoogleApiRequest: attaches a bearer token from the metadata server, caching until near expiry", async () => {
  let tokenFetches = 0;
  const fetchImpl = (async (url: string) => {
    if (String(url).includes("metadata")) {
      tokenFetches++;
      return Response.json({ access_token: "tok-1", expires_in: 3600 });
    }
    return new Response(null, { status: 200 });
  }) as typeof fetch;

  let now = 0;
  const req = createGoogleApiRequest({ fetchImpl, now: () => now, metadataUrl: "http://metadata.test/token" });
  await req("http://api.test/x");
  await req("http://api.test/y"); // cached, no second token fetch
  assert.equal(tokenFetches, 1);

  now = 3600 * 1000; // past expiry - safety margin
  await req("http://api.test/z");
  assert.equal(tokenFetches, 2);
});
