// src/application.mjs — EVE Assist as one Assist application record for the
// engine (@red-cup-engineering/personal-intelligence-systems-services-section).
// This is the one place EVE Assist's login adapter, tool registry, system
// instruction, tool-context builder, and domain routes are composed; the
// seat (sites/eve-assist.561.group/src/index.mjs) does nothing but call
// createAssistWorker(eveAssistApplication) — no Worker, store, session,
// sealing, or MCP server lives in this package anymore, all of that is the
// engine's.

import { assistToolSet } from "@red-cup-engineering/personal-intelligence-systems-services-section/tools";
import { buildAuthorizationUrl, exchangeAuthorizationCode, refreshAccessToken, decodeAccessToken } from "./sso/eve-sso.mjs";
import { createEsiClient } from "./esi/esi-client.mjs";
import { createNameResolver } from "./esi/name-resolver.mjs";
import { characterTools } from "./tools/character-tools.mjs";
import { marketTools } from "./tools/market-tools.mjs";
import { ledgerTools } from "./tools/ledger-tools.mjs";
import { buildSystemInstruction } from "./system-instruction.mjs";
import { renderLineChart, renderSparkline } from "./charting/charts.mjs";

// Pinned ESI scopes v1 (ROADMAP.md / cross-module contract) — order is not
// meaningful but is kept stable so authorization URLs are diff-stable.
// Moved here from src/web/worker.mjs (now deleted) unchanged.
const ESI_SCOPES = [
  "esi-wallet.read_character_wallet.v1",
  "esi-skills.read_skills.v1",
  "esi-skills.read_skillqueue.v1",
  "esi-location.read_location.v1",
  "esi-location.read_ship_type.v1",
  "esi-assets.read_assets.v1",
  "esi-markets.read_character_orders.v1",
  "esi-clones.read_clones.v1",
];

// How many recent wallet-journal entries GET /api/charts/wallet-sparkline
// pulls (via the get_wallet_journal tool) to plot a balance trend from.
const WALLET_SPARKLINE_LIMIT = 100;

// --- login adapter over src/sso/eve-sso.mjs -------------------------------

const login = {
  async start({ capabilities, state, publicUrl }) {
    const authorizationUrl = buildAuthorizationUrl({
      clientId: capabilities.EVE_SSO_CLIENT_ID,
      redirectUri: `${publicUrl}/auth/callback`,
      scopes: ESI_SCOPES,
      state,
    });
    return new Response(null, { status: 302, headers: { location: authorizationUrl } });
  },

  async callback({ capabilities, url, state, fetchImpl }) {
    const code = url.searchParams.get("code");
    const suppliedState = url.searchParams.get("state");
    if (!code || !state || suppliedState !== state) {
      return Response.json({ error: "invalid or expired state" }, { status: 400 });
    }
    const tokenResponse = await exchangeAuthorizationCode({
      code,
      clientId: capabilities.EVE_SSO_CLIENT_ID,
      clientSecret: capabilities.EVE_SSO_CLIENT_SECRET,
      fetchImpl,
    });
    const decoded = decodeAccessToken(tokenResponse.accessToken);
    return {
      principal: { subject: String(decoded.characterId), displayName: decoded.characterName },
      credential: {
        secret: { accessToken: tokenResponse.accessToken, refreshToken: tokenResponse.refreshToken },
        expiresAt: tokenResponse.expiresAt,
        scopes: decoded.scopes,
      },
      redirect: "/dashboard.html",
    };
  },

  async refresh({ capabilities, secret, fetchImpl }) {
    const refreshed = await refreshAccessToken({
      refreshToken: secret.refreshToken,
      clientId: capabilities.EVE_SSO_CLIENT_ID,
      clientSecret: capabilities.EVE_SSO_CLIENT_SECRET,
      fetchImpl,
    });
    return { secret: { accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken }, expiresAt: refreshed.expiresAt };
  },
};

// --- tools -----------------------------------------------------------------
// market-tools.mjs's own array already carries explain_term (the engine's
// explainTermTool bound to data/records/eve-newbie-glossary.json).
const tools = assistToolSet(characterTools, marketTools, ledgerTools);

// --- tool context ------------------------------------------------------------

async function buildToolCtx({ capabilities, store, principal, credential, fetchImpl, now }) {
  const esi = createEsiClient({ fetchImpl, userAgent: capabilities.EVE_USER_AGENT, now });
  // One resolver per ctx (per invocation): memoization and the observation
  // dedup rule in name-resolver.mjs are only correct scoped to a single
  // chat turn / MCP request, never shared across users or turns.
  const names = createNameResolver({ esi });
  const secret = await credential();
  return {
    esi,
    store,
    principalId: principal.id,
    userId: principal.id,
    characterId: Number(principal.subject),
    accessToken: secret?.accessToken ?? null,
    fetchImpl,
    now,
    names,
  };
}

// --- domain routes -----------------------------------------------------------
// Moved from src/web/worker.mjs (now deleted) verbatim in behavior, wired
// through assist.execute (the engine's arg-validating, ToolError-wrapping
// dispatch) instead of a private runTool/buildToolCtx pair, and ctx.url in
// place of a hand-parsed `new URL(request.url)`.

async function apiDashboard(ctx, assist) {
  const [character, skillQueue, serverStatus] = await Promise.all([
    assist.execute("get_character_overview", {}),
    assist.execute("get_skill_queue", {}),
    assist.execute("get_server_status", {}),
  ]);
  return Response.json({
    character: character.data,
    skillQueue: skillQueue.data,
    serverStatus: serverStatus.data,
    generatedAt: Date.now(),
  });
}

// Renders a line chart of a type's recent daily average price in a region.
// Goes through the get_market_history tool (not a raw ESI call) so this
// route sees exactly the same series a chat/MCP caller of that tool would.
async function chartMarketHistory(ctx, assist) {
  const regionId = Number(ctx.url.searchParams.get("regionId"));
  const typeId = Number(ctx.url.searchParams.get("typeId"));
  if (!Number.isInteger(regionId) || regionId <= 0 || !Number.isInteger(typeId) || typeId <= 0) {
    return Response.json({ error: "regionId and typeId query params are required positive integers" }, { status: 400 });
  }
  const result = await assist.execute("get_market_history", { regionId, typeId });
  const series = Array.isArray(result.data?.series) ? result.data.series : [];
  if (series.length < 2) {
    return Response.json({ error: "not enough market history to render a chart" }, { status: 404 });
  }
  const svg = renderLineChart({
    series: [{ label: "Average price", points: series.map((row) => ({ x: row.date, y: row.average })) }],
    xIsTime: true,
    yLabel: "ISK",
  });
  return new Response(svg, { status: 200, headers: { "content-type": "image/svg+xml", "cache-control": "private, max-age=300" } });
}

// Renders a sparkline of the character's wallet balance across their most
// recent journal entries (oldest -> newest, per renderSparkline's contract).
async function chartWalletSparkline(ctx, assist) {
  const result = await assist.execute("get_wallet_journal", { limit: WALLET_SPARKLINE_LIMIT });
  const entries = Array.isArray(result.data?.entries) ? result.data.entries : [];
  // get_wallet_journal's entries are newest-first; a sparkline reads
  // left-to-right as oldest-to-newest, so reverse before extracting.
  const points = [...entries]
    .reverse()
    .map((entry) => entry.balance)
    .filter((value) => typeof value === "number" && Number.isFinite(value));
  if (points.length < 2) {
    return Response.json({ error: "not enough wallet history to render a sparkline" }, { status: 404 });
  }
  const svg = renderSparkline({ points });
  return new Response(svg, { status: 200, headers: { "content-type": "image/svg+xml", "cache-control": "private, max-age=300" } });
}

async function ledgerExport(ctx, assist) {
  const format = ctx.url.searchParams.get("format");
  if (format !== "beancount" && format !== "hledger") {
    return Response.json({ error: 'format query param must be "beancount" or "hledger"' }, { status: 400 });
  }
  const result = await assist.execute("export_wallet_ledger", { format });
  const filename = `eve-wallet.${format === "beancount" ? "beancount" : "journal"}`;
  return new Response(result.data.text, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8", "content-disposition": `attachment; filename="${filename}"` },
  });
}

/** The EVE Assist application record: one call of createAssistWorker over this is the whole seat. */
export const eveAssistApplication = {
  brand: { id: "eve-assist", name: "EVE Assist", serverInfo: { name: "eve-assist", version: "0.2.0" } },
  principalKind: "eve-character",
  credentialProvider: "eve-esi",
  requiredCapabilities: ["EVE_SSO_CLIENT_ID", "EVE_SSO_CLIENT_SECRET", "PUBLIC_URL", "EVE_USER_AGENT"],
  login,
  tools,
  systemInstruction: (principal) => buildSystemInstruction({ characterName: principal.displayName }),
  buildToolCtx,
  routes: [
    { match: "/api/dashboard", handler: apiDashboard },
    { match: "/api/charts/market-history", handler: chartMarketHistory },
    { match: "/api/charts/wallet-sparkline", handler: chartWalletSparkline },
    { match: "/api/ledger/export", handler: ledgerExport },
  ],
};
