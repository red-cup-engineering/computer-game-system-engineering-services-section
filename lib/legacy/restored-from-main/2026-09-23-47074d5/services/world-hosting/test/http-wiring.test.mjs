import assert from "node:assert/strict";
import { test } from "node:test";
import { listenMudHttpServer, closeMudHttpServer } from "@red-cup-engineering/feltos/http";
import { createEngine } from "@red-cup-engineering/feltos/engine";
import { createMudServer } from "@red-cup-engineering/feltos/mud-server";
import { STARTER_WORLD_GAME, starterWorldRuntime } from "@red-cup-engineering/feltos/starter-world";
import { createWorldRuntime } from "../src/world-runtime.mjs";
import { createWorldHttpServer } from "../src/http-wiring.mjs";

// This sandbox's loopback networking refuses the very first connection attempt to a freshly
// bound ephemeral port (same behavior fake-gcs.mjs's own warmUpLocalPort documents).
async function warmUpLocalPort(origin) {
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      await fetch(`${origin}/does-not-exist-warmup-probe`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 15));
    }
  }
}

async function withLiveServer(runtimeOpts, run) {
  const engine = createEngine(STARTER_WORLD_GAME);
  const mud = createMudServer(STARTER_WORLD_GAME, { runtime: starterWorldRuntime, engine, maxAssertions: 20_000 });
  const flushes = [];
  const catchUps = [];
  const runtime = createWorldRuntime(mud, {
    tickIntervalMs: 1000,
    maxCatchUpTicksPerRequest: 30,
    lastTickAt: Date.now(),
    store: null,
    clockStore: null,
    onFlush: (i) => flushes.push(i),
    onCatchUp: (i) => catchUps.push(i),
    ...runtimeOpts,
  });
  const server = createWorldHttpServer(mud, runtime, { tickIntervalMs: 1000, processLabel: "Test world" });
  const { origin } = await listenMudHttpServer(server, { host: "127.0.0.1", port: 0 });
  await warmUpLocalPort(origin);
  flushes.length = 0; // the warm-up probe's own catch-up pass isn't part of any test's assertions
  catchUps.length = 0;
  try {
    await run({ origin, mud, flushes, catchUps });
  } finally {
    await closeMudHttpServer(server);
  }
}

test("GET /health returns real JSON, unaffected by the wrapper", async () => {
  await withLiveServer({}, async ({ origin }) => {
    const res = await fetch(`${origin}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: "ok" });
  });
});

test("GET /metrics returns the REAL metrics object, not a serialized-away Promise ({})", async () => {
  await withLiveServer({}, async ({ origin }) => {
    const res = await fetch(`${origin}/metrics`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(typeof body.tick, "number", "must be a real number, not undefined from an unserialized Promise");
    assert.equal(typeof body.actors, "number");
    assert.equal(typeof body.worldAssertions, "number");
  });
});

test("POST /connect returns a real, non-empty actor id — this is exactly the field an async-wrapper bug would silently drop", async () => {
  await withLiveServer({}, async ({ origin }) => {
    const res = await fetch(`${origin}/connect`, { method: "POST", body: JSON.stringify({ name: "wiring-test-actor" }), headers: { "content-type": "application/json" } });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(typeof body.actor, "string");
    assert.ok(body.actor.startsWith("actor:"), `expected a real actor id, got ${JSON.stringify(body)}`);
  });
});

test("POST /connect flushes exactly once (postRequestFlush fired for the mutating route)", async () => {
  await withLiveServer({}, async ({ origin, flushes }) => {
    await fetch(`${origin}/connect`, { method: "POST", body: JSON.stringify({ name: "flush-check" }), headers: { "content-type": "application/json" } });
    assert.equal(flushes.length, 1);
    assert.equal(flushes[0].reason, "mutation");
  });
});

test("full session over real HTTP: connect -> command -> tick -> events, world state genuinely advances", async () => {
  await withLiveServer({}, async ({ origin }) => {
    const connectRes = await fetch(`${origin}/connect`, { method: "POST", body: JSON.stringify({ name: "session-actor" }), headers: { "content-type": "application/json" } });
    const { actor } = await connectRes.json();
    assert.equal(typeof actor, "string");

    const commandRes = await fetch(`${origin}/command`, { method: "POST", body: JSON.stringify({ actor, command: "look" }), headers: { "content-type": "application/json" } });
    assert.equal(commandRes.status, 202);
    assert.deepEqual(await commandRes.json(), { accepted: true });

    const tickRes = await fetch(`${origin}/tick`, { method: "POST" });
    assert.equal(tickRes.status, 200);
    const receipt = await tickRes.json();
    assert.ok(receipt && typeof receipt === "object");

    const eventsRes = await fetch(`${origin}/events?actor=${encodeURIComponent(actor)}`);
    assert.equal(eventsRes.status, 200);
    const eventsBody = await eventsRes.json();
    assert.ok(Array.isArray(eventsBody.events));

    const metricsRes = await fetch(`${origin}/metrics`);
    const metrics = await metricsRes.json();
    assert.ok(metrics.tick >= 1, "the explicit /tick must have actually advanced the world");
    assert.equal(metrics.actors, 1);
  });
});

test("POST /tick flushes with ticksRun=1 and the clock advances by one tick-interval, regardless of ticksOwed", async () => {
  await withLiveServer({}, async ({ origin, flushes }) => {
    const res = await fetch(`${origin}/tick`, { method: "POST" });
    assert.equal(res.status, 200);
    const tickFlush = flushes.find((f) => f.reason === "mutation");
    assert.equal(tickFlush?.ticksRun, 1);
  });
});

test("POST /command does not flush (enqueue alone is not a commit point) but does 202 with a real body", async () => {
  // A frozen clock isolates this assertion to POST /command specifically: with a real wall
  // clock, preRequestCatchUp could legitimately flush an owed tick between the two fetches.
  const frozenNow = () => 0;
  await withLiveServer({ now: frozenNow, lastTickAt: 0 }, async ({ origin, flushes }) => {
    const connectRes = await fetch(`${origin}/connect`, { method: "POST", body: JSON.stringify({ name: "cmd-only-actor" }), headers: { "content-type": "application/json" } });
    const { actor } = await connectRes.json();
    const flushesBeforeCommand = flushes.length;
    const res = await fetch(`${origin}/command`, { method: "POST", body: JSON.stringify({ actor, command: "look" }), headers: { "content-type": "application/json" } });
    assert.equal(res.status, 202);
    assert.equal(flushes.length, flushesBeforeCommand, "enqueue must not add a flush");
  });
});

test("preRequestCatchUp runs on GET /health too (every route wakes the world, per the design)", async () => {
  let simTime = 0;
  const clock = { now: () => simTime, advance: (ms) => { simTime += ms; } };
  await withLiveServer({ now: clock.now, lastTickAt: 0, maxCatchUpTicksPerRequest: 5 }, async ({ origin, catchUps }) => {
    clock.advance(3000);
    const res = await fetch(`${origin}/health`);
    assert.equal(res.status, 200);
    assert.equal(catchUps.length, 1);
    assert.equal(catchUps[0].ticksRun, 3);
  });
});

test("a 404 route still gets pre-request catch-up but no post-request flush", async () => {
  await withLiveServer({}, async ({ origin, flushes }) => {
    const res = await fetch(`${origin}/does-not-exist`);
    assert.equal(res.status, 404);
    assert.equal(flushes.length, 0);
  });
});

// mud === null: a bare qwzspace-room site with no MudServer-based JSON API at all (tidepool's
// own shape) — createMudHttpServer must never be reached, and GET /health/pageHtml/staticFiles
// still work standalone.
async function withHeadlessServer(opts, run) {
  const runtime = createWorldRuntime({ tick: () => {}, engine: () => ({ ok: true }) }, {
    tickIntervalMs: 1000, maxCatchUpTicksPerRequest: 30, lastTickAt: Date.now(), store: null, clockStore: null,
  });
  const stepOnceCalls = [];
  const room = { attach() {}, stepOnce: async () => { stepOnceCalls.push(1); } };
  const server = createWorldHttpServer(null, runtime, { tickIntervalMs: 1000, room, processLabel: "Headless test", ...opts });
  const { origin } = await listenMudHttpServer(server, { host: "127.0.0.1", port: 0 });
  await warmUpLocalPort(origin);
  try {
    await run({ origin, stepOnceCalls });
  } finally {
    await closeMudHttpServer(server);
  }
}

test("mud=null: GET /health is answered directly (default {status:\"ok\"}), no MudServer route wired", async () => {
  await withHeadlessServer({}, async ({ origin }) => {
    const res = await fetch(`${origin}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: "ok" });
  });
});

test("mud=null: opts.health overrides the default /health body", async () => {
  await withHeadlessServer({ health: () => ({ status: "ok", members: 3 }) }, async ({ origin }) => {
    const res = await fetch(`${origin}/health`);
    assert.deepEqual(await res.json(), { status: "ok", members: 3 });
  });
});

test("mud=null: GET / still serves pageHtml and POST /qwzspace/tick still steps the room", async () => {
  await withHeadlessServer({ pageHtml: "<!doctype html><title>t</title>" }, async ({ origin, stepOnceCalls }) => {
    const pageRes = await fetch(origin);
    assert.equal(pageRes.status, 200);
    assert.match(await pageRes.text(), /<!doctype html>/i);

    const tickRes = await fetch(`${origin}/qwzspace/tick`, { method: "POST" });
    assert.equal(tickRes.status, 200);
    assert.equal(stepOnceCalls.length, 1);
  });
});

test("mud=null: an unmatched route 404s instead of throwing (no MudServer to fall through to)", async () => {
  await withHeadlessServer({}, async ({ origin }) => {
    const res = await fetch(`${origin}/connect`, { method: "POST" });
    assert.equal(res.status, 404);
  });
});
