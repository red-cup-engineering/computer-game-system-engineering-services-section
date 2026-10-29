// test/application.test.mjs — exercises EVE Assist end to end as one call
// of createAssistEngine over eveAssistApplication (src/application.mjs), the
// way the engine's own test/assist-application.test.mjs exercises its demo
// record. Replaces test/worker.test.mjs (deleted): there is no more
// createEveAssistWorker, no src/web/worker.mjs, no src/db/store.mjs — every
// session, sealing, MCP, and store concern below is the engine's.

import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileText } from "@red-cup-engineering/file-services/read-file";
import { createSqliteD1 } from "@red-cup-engineering/cloudflare-d1-service/sqlite";
import { applyMigrations } from "@red-cup-engineering/cloudflare-d1-service/migrations";
import { createStore } from "@red-cup-engineering/personal-intelligence-systems-services-section/db";
import { createAssistEngine } from "@red-cup-engineering/personal-intelligence-systems-services-section/web";
import { eveAssistApplication } from "../src/application.mjs";

// EVE Assist's own migrations (0001_init, 0002_ai_provider, 0003_assist_platform)
// land on exactly the engine's six-table schema (0003 migrates onto it
// verbatim); a seat applies these three, in order, before any of the
// engine's own migrations, and so does this test.
const MIGRATIONS = ["0001_init.sql", "0002_ai_provider.sql", "0003_assist_platform.sql"].map((name) => ({
  name,
  path: new URL(`../migrations/${name}`, import.meta.url).pathname,
}));

function base64UrlJson(obj) {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

// A JWT-shaped (but unsigned) access token, exactly as much as
// decodeAccessToken (src/sso/eve-sso.mjs) needs — it deliberately does not
// verify signatures (see that module's why-comment), so a fake signature
// segment is fine here.
function fakeEveAccessToken(payload) {
  const header = base64UrlJson({ alg: "RS256", typ: "JWT" });
  const body = base64UrlJson(payload);
  return `${header}.${body}.fake-signature`;
}

// Routes a fake ESI response by exact pathname (ignoring query string).
function fakeEsiFetch(routesByPath) {
  return async (input) => {
    const href = input instanceof URL ? input.href : typeof input === "string" ? input : input.url;
    const url = new URL(href);
    const entry = routesByPath[url.pathname];
    if (!entry) throw new Error(`unexpected ESI fetch in test: ${url.pathname}${url.search}`);
    return new Response(JSON.stringify(entry), { status: 200, headers: { "content-type": "application/json" } });
  };
}

async function capabilities() {
  const d1 = createSqliteD1();
  await applyMigrations(d1, await Promise.all(MIGRATIONS.map(async ({ name, path }) => ({ name, sql: await readFileText(path) }))));
  return {
    DB: d1,
    SESSION_SECRET: "session-secret",
    SEAL_KEY: randomBytes(32).toString("base64"),
    EVE_SSO_CLIENT_ID: "test-client-id",
    EVE_SSO_CLIENT_SECRET: "test-client-secret",
    PUBLIC_URL: "https://eve-assist.561.group",
    EVE_USER_AGENT: "EVE Assist (test; contact: morgan.sennhauser@gmail.com)",
    ASSETS: { fetch: async (request) => new Response(`asset ${new URL(request.url).pathname}`) },
  };
}

// Drives the full EVE SSO login round trip (GET /auth/login, GET
// /auth/callback with a fake token exchange) and returns the session cookie
// header plus the admitted eve-character principal.
async function loggedIn(engine, caps, { characterId = 2118406090, characterName = "Morgan Sennhauser" } = {}) {
  const login = await engine.fetch(new Request("https://eve-assist.561.group/auth/login"));
  assert.equal(login.status, 302);
  const state = new URL(login.headers.get("location")).searchParams.get("state");
  const stateCookie = login.headers.getSetCookie().find((cookie) => cookie.startsWith("eve_assist_session_state=")).split(";")[0];

  const accessToken = fakeEveAccessToken({
    sub: `CHARACTER:EVE:${characterId}`,
    name: characterName,
    scp: ["esi-wallet.read_character_wallet.v1"],
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const href = typeof input === "string" ? input : input.url;
    if (href === "https://login.eveonline.com/v2/oauth/token") {
      return new Response(
        JSON.stringify({ access_token: accessToken, refresh_token: "refresh-token-stub", expires_in: 1200 }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    throw new Error(`unexpected fetch in test (login): ${href}`);
  };
  let callback;
  try {
    callback = await engine.fetch(
      new Request(`https://eve-assist.561.group/auth/callback?code=test-auth-code&state=${state}`, {
        headers: { cookie: stateCookie },
      }),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get("location"), "/dashboard.html");
  const cookie = callback.headers.getSetCookie().find((c) => c.startsWith("eve_assist_session=")).split(";")[0];
  const principal = await createStore(caps.DB).getPrincipal({ kind: "eve-character", subject: String(characterId) });
  return { cookie, principal, characterId, characterName };
}

test("login exchanges the EVE SSO code, establishes an eve-character principal, seals the credential, and sets the brand's session cookie", async () => {
  const caps = await capabilities();
  const engine = createAssistEngine(eveAssistApplication, caps);
  const { cookie, principal } = await loggedIn(engine, caps);

  assert.equal(principal.kind, "eve-character");
  assert.equal(principal.subject, "2118406090");
  assert.equal(principal.displayName, "Morgan Sennhauser");

  const credential = await createStore(caps.DB).getCredential({ principalId: principal.id, provider: "eve-esi" });
  assert.ok(credential, "expected a sealed eve-esi credential row");
});

test("GET /api/me reports the eve-assist brand and no session is a clear 401", async () => {
  const caps = await capabilities();
  const engine = createAssistEngine(eveAssistApplication, caps);
  const { cookie, principal } = await loggedIn(engine, caps);

  const me = await engine.fetch(new Request("https://eve-assist.561.group/api/me", { headers: { cookie } }));
  assert.equal(me.status, 200);
  const body = await me.json();
  assert.equal(body.principalId, principal.id);
  assert.equal(body.principal.displayName, "Morgan Sennhauser");
  assert.equal(body.hasAiKey, false);
  assert.deepEqual(body.brand, { id: "eve-assist", name: "EVE Assist", mcpUrl: "https://eve-assist.561.group/mcp" });

  assert.equal((await engine.fetch(new Request("https://eve-assist.561.group/api/me"))).status, 401);
});

test("GET /api/dashboard composes get_character_overview, get_skill_queue, and get_server_status through assist.execute", async () => {
  const caps = await capabilities();
  const engine = createAssistEngine(eveAssistApplication, caps);
  const { cookie, characterId } = await loggedIn(engine, caps);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = fakeEsiFetch({
    [`/latest/characters/${characterId}/`]: { name: "Morgan Sennhauser", corporation_id: 98000001, security_status: 0.5 },
    [`/latest/characters/${characterId}/location/`]: {},
    [`/latest/characters/${characterId}/ship/`]: {},
    [`/latest/characters/${characterId}/wallet/`]: 5_000_000,
    [`/latest/characters/${characterId}/skillqueue/`]: [],
    "/latest/status/": { players: 12345, server_version: "1.0", start_time: "2026-08-05T00:00:00Z" },
  });
  try {
    const response = await engine.fetch(new Request("https://eve-assist.561.group/api/dashboard", { headers: { cookie } }));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.character.name, "Morgan Sennhauser");
    assert.equal(body.character.walletBalance, 5_000_000);
    assert.deepEqual(body.skillQueue, { entries: [], totalTimeRemainingMs: null, isPaused: false });
    assert.equal(body.serverStatus.players, 12345);
  } finally {
    globalThis.fetch = originalFetch;
  }

  const unauthorized = await engine.fetch(new Request("https://eve-assist.561.group/api/dashboard"));
  assert.equal(unauthorized.status, 401);
});

test("POST /api/tools/get_server_status runs a public tool through the generic tool route", async () => {
  const caps = await capabilities();
  const engine = createAssistEngine(eveAssistApplication, caps);
  const { cookie } = await loggedIn(engine, caps);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = fakeEsiFetch({ "/latest/status/": { players: 42, server_version: "2.0", start_time: "2026-09-01T00:00:00Z" } });
  try {
    const response = await engine.fetch(
      new Request("https://eve-assist.561.group/api/tools/get_server_status", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ args: {} }),
      }),
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.players, 42);
    assert.ok(Array.isArray(body.observations));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("GET /api/charts/market-history renders an SVG line chart with a private cache header", async () => {
  const caps = await capabilities();
  const engine = createAssistEngine(eveAssistApplication, caps);
  const { cookie } = await loggedIn(engine, caps);

  const rows = [];
  for (let i = 1; i <= 10; i += 1) {
    rows.push({ date: `2026-07-${String(i).padStart(2, "0")}`, average: 100 + i, lowest: 90 + i, highest: 110 + i, order_count: 5, volume: 1000 });
  }
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fakeEsiFetch({ "/latest/markets/10000002/history/": rows });
  try {
    const response = await engine.fetch(
      new Request("https://eve-assist.561.group/api/charts/market-history?regionId=10000002&typeId=34", { headers: { cookie } }),
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/svg+xml");
    assert.equal(response.headers.get("cache-control"), "private, max-age=300");
    assert.match(await response.text(), /^<svg/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("GET /api/charts/market-history without regionId/typeId returns 400", async () => {
  const caps = await capabilities();
  const engine = createAssistEngine(eveAssistApplication, caps);
  const { cookie } = await loggedIn(engine, caps);
  const response = await engine.fetch(new Request("https://eve-assist.561.group/api/charts/market-history", { headers: { cookie } }));
  assert.equal(response.status, 400);
});

test("GET /api/charts/wallet-sparkline renders an SVG from wallet journal balances", async () => {
  const caps = await capabilities();
  const engine = createAssistEngine(eveAssistApplication, caps);
  const { cookie, characterId } = await loggedIn(engine, caps);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = fakeEsiFetch({
    [`/latest/characters/${characterId}/wallet/journal/`]: [
      { id: 1, date: "2026-08-01T00:00:00Z", amount: 100, balance: 1000, ref_type: "bounty_prizes" },
      { id: 2, date: "2026-08-02T00:00:00Z", amount: -50, balance: 950, ref_type: "market_transaction" },
      { id: 3, date: "2026-08-03T00:00:00Z", amount: 200, balance: 1150, ref_type: "bounty_prizes" },
    ],
  });
  try {
    const response = await engine.fetch(new Request("https://eve-assist.561.group/api/charts/wallet-sparkline", { headers: { cookie } }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/svg+xml");
    assert.match(await response.text(), /^<svg/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// The wallet-journal entry's date is computed relative to "now" (rather
// than a hardcoded calendar date) so this test keeps passing regardless of
// when it runs — export_wallet_ledger's default 30-day window is relative
// to ctx.now, and a fixed past date eventually falls outside that window
// and starts filtering the entry out (this was the one pre-existing
// failing test ported from test/worker.test.mjs: its fixture date,
// 2026-08-01, was inside the 30-day window when written and fell outside
// it by the time this migration ran).
test("GET /api/ledger/export?format=beancount returns an attachment with the rendered ledger", async () => {
  const caps = await capabilities();
  const engine = createAssistEngine(eveAssistApplication, caps);
  const { cookie, characterId } = await loggedIn(engine, caps);

  const recentDate = new Date(Date.now() - 5 * 86_400_000).toISOString();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fakeEsiFetch({
    [`/latest/characters/${characterId}/`]: { name: "Morgan Sennhauser" },
    [`/latest/characters/${characterId}/wallet/journal/`]: [
      { id: 34772918001, date: recentDate, amount: 1250000, balance: 5000000, ref_type: "bounty_prizes" },
    ],
  });
  try {
    const response = await engine.fetch(
      new Request("https://eve-assist.561.group/api/ledger/export?format=beancount", { headers: { cookie } }),
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "text/plain; charset=utf-8");
    assert.equal(response.headers.get("content-disposition"), 'attachment; filename="eve-wallet.beancount"');
    const text = await response.text();
    assert.match(text, /id: "34772918001"/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("GET /api/ledger/export with a bad format returns 400, and without a session returns 401", async () => {
  const caps = await capabilities();
  const engine = createAssistEngine(eveAssistApplication, caps);
  const { cookie } = await loggedIn(engine, caps);
  const badFormat = await engine.fetch(new Request("https://eve-assist.561.group/api/ledger/export?format=csv", { headers: { cookie } }));
  assert.equal(badFormat.status, 400);
  const noSession = await engine.fetch(new Request("https://eve-assist.561.group/api/ledger/export?format=hledger"));
  assert.equal(noSession.status, 401);
});

test("POST /mcp runs a tool with a minted bearer token, and refuses without one", async () => {
  const caps = await capabilities();
  const engine = createAssistEngine(eveAssistApplication, caps);
  const { cookie } = await loggedIn(engine, caps);

  const minted = await (
    await engine.fetch(
      new Request("https://eve-assist.561.group/api/settings/mcp-tokens", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ label: "laptop" }),
      }),
    )
  ).json();
  assert.match(minted.token, /^eveassist_[A-Za-z0-9_-]+$/u);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = fakeEsiFetch({ "/latest/status/": { players: 7, server_version: "1", start_time: "2026-01-01T00:00:00Z" } });
  try {
    const response = await engine.fetch(
      new Request("https://eve-assist.561.group/mcp", {
        method: "POST",
        headers: { authorization: `Bearer ${minted.token}`, "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_server_status", arguments: {} } }),
      }),
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(JSON.parse(body.result.content[0].text).data.players, 7);
  } finally {
    globalThis.fetch = originalFetch;
  }

  const unauthorized = await engine.fetch(new Request("https://eve-assist.561.group/mcp", { method: "POST", body: "{}" }));
  assert.equal(unauthorized.status, 401);
});

test("unmatched paths fall through to the ASSETS binding", async () => {
  const caps = await capabilities();
  const engine = createAssistEngine(eveAssistApplication, caps);
  const response = await engine.fetch(new Request("https://eve-assist.561.group/dashboard.html"));
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "asset /dashboard.html");
});
