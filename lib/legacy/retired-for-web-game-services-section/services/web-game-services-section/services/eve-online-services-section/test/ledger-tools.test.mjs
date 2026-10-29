import test from "node:test";
import assert from "node:assert/strict";
import { ledgerTools } from "../src/tools/ledger-tools.mjs";
import { ToolError } from "@red-cup-engineering/personal-intelligence-systems-services-section/tools";
import { EsiError } from "../src/esi/esi-client.mjs";

function getTool(name) {
  const tool = ledgerTools.find((t) => t.operation.id === name);
  assert.ok(tool, `expected ledgerTools to contain ${name}`);
  return tool;
}

function observationFor(path, query, data) {
  return {
    data,
    observation: {
      type: "EsiObservation",
      path,
      query: query ?? null,
      status: 200,
      expiresAt: null,
      recordedAt: 1000,
      etag: null,
    },
  };
}

// Same fake-ESI shape test/character-tools.test.mjs uses: routes keyed by
// exact path (or path?page=N), records every call.
function createFakeEsi(routes) {
  const calls = [];
  return {
    calls,
    async get(path, { token, query } = {}) {
      calls.push({ path, token, query });
      const key = query?.page !== undefined ? `${path}?page=${query.page}` : path;
      const entry = routes[key] ?? routes[path];
      if (!entry) throw new Error(`fake esi: no route configured for ${key}`);
      if (entry instanceof Error) throw entry;
      return observationFor(path, query ?? null, entry);
    },
  };
}

function baseCtx(esi, overrides = {}) {
  return {
    esi,
    store: {},
    userId: 1,
    characterId: 12345,
    accessToken: "test-token",
    fetchImpl: async () => {
      throw new Error("fetchImpl should not be called directly by this tool");
    },
    now: () => Date.parse("2026-08-05T12:00:00Z"),
    ...overrides,
  };
}

const NOW_ISO = "2026-08-05T12:00:00Z";

function journalRoute(entries) {
  return { "/characters/12345/wallet/journal/?page=1": entries };
}

test("export_wallet_ledger builds a valid beancount file from ESI wallet journal entries", async () => {
  const esi = createFakeEsi({
    "/characters/12345/": { name: "Morgan Sennhauser" },
    ...journalRoute([
      {
        id: 34772918001,
        date: "2026-08-01T14:03:11Z",
        amount: 1250000,
        balance: 5000000,
        ref_type: "bounty_prizes",
        first_party_id: 1000125,
        second_party_id: 2118406090,
      },
      {
        id: 34772918002,
        date: "2026-08-02T09:00:00Z",
        amount: -300000,
        balance: 4700000,
        ref_type: "market_transaction",
        first_party_id: 2118406090,
        second_party_id: 60003760,
      },
    ]),
  });
  const ctx = baseCtx(esi);

  const { data, observations } = await getTool("export_wallet_ledger").handler(ctx, { format: "beancount" });

  assert.equal(data.format, "beancount");
  assert.equal(data.transactionCount, 2);
  assert.match(data.text, /option "title" "EVE wallet journal — Morgan Sennhauser"/);
  assert.match(data.text, /option "operating_currency" "ISK"/);
  assert.match(data.text, /commodity ISK/);
  assert.match(data.text, /2026-08-01 \* "Bounty Prizes"/);
  assert.match(data.text, /id: "34772918001"/);
  assert.match(data.text, /Income:Eve:MorganSennhauser:BountyPrizes\s+-1250000\.00 ISK/);
  assert.match(data.text, /Assets:Eve:MorganSennhauser:Wallet\s+1250000\.00 ISK/);
  assert.match(data.text, /Expenses:Eve:MorganSennhauser:MarketTransaction\s+300000\.00 ISK/);
  // One observation for the character-name lookup, one for the journal page.
  assert.equal(observations.length, 2);
});

test("export_wallet_ledger builds a valid hledger journal", async () => {
  const esi = createFakeEsi({
    "/characters/12345/": { name: "Morgan Sennhauser" },
    ...journalRoute([
      { id: 1, date: "2026-08-01T00:00:00Z", amount: 100, balance: 100, ref_type: "bounty_prizes" },
    ]),
  });
  const ctx = baseCtx(esi);

  const { data } = await getTool("export_wallet_ledger").handler(ctx, { format: "hledger" });

  assert.equal(data.format, "hledger");
  assert.match(data.text, /^2026\/08\/01 Bounty Prizes ; id:1/m);
  assert.match(data.text, /Assets:Eve:MorganSennhauser:Wallet\s+100\.00 ISK/);
});

test("export_wallet_ledger filters entries outside the requested day window", async () => {
  const esi = createFakeEsi({
    "/characters/12345/": { name: "Morgan Sennhauser" },
    ...journalRoute([
      { id: 1, date: "2026-08-05T00:00:00Z", amount: 1, balance: 1, ref_type: "bounty_prizes" }, // in window
      { id: 2, date: "2026-06-01T00:00:00Z", amount: 1, balance: 1, ref_type: "bounty_prizes" }, // stale
    ]),
  });
  const ctx = baseCtx(esi, { now: () => Date.parse(NOW_ISO) });

  const { data } = await getTool("export_wallet_ledger").handler(ctx, { format: "beancount", days: 7 });
  assert.equal(data.transactionCount, 1);
});

test("export_wallet_ledger defaults to 30 days and rejects an out-of-range days value", async () => {
  const tool = getTool("export_wallet_ledger");
  const esi = createFakeEsi({
    "/characters/12345/": { name: "Morgan Sennhauser" },
    ...journalRoute([]),
  });
  const ctx = baseCtx(esi);

  const { data } = await tool.handler(ctx, { format: "beancount" });
  assert.equal(data.transactionCount, 0);

  await assert.rejects(
    () => tool.handler(ctx, { format: "beancount", days: 91 }),
    (err) => err instanceof ToolError && err.code === "invalid_args",
  );
  await assert.rejects(
    () => tool.handler(ctx, { format: "beancount", days: 0 }),
    (err) => err instanceof ToolError && err.code === "invalid_args",
  );
});

test("export_wallet_ledger rejects an unknown format", async () => {
  const esi = createFakeEsi({ "/characters/12345/": { name: "X" }, ...journalRoute([]) });
  const ctx = baseCtx(esi);
  await assert.rejects(
    () => getTool("export_wallet_ledger").handler(ctx, { format: "csv" }),
    (err) => err instanceof ToolError && err.code === "invalid_args",
  );
});

test("export_wallet_ledger requires ctx.accessToken", async () => {
  const esi = createFakeEsi({ "/characters/12345/": { name: "X" }, ...journalRoute([]) });
  const ctx = baseCtx(esi, { accessToken: "" });
  await assert.rejects(
    () => getTool("export_wallet_ledger").handler(ctx, { format: "beancount" }),
    (err) => err instanceof ToolError && err.code === "missing_token",
  );
});

test("export_wallet_ledger translates a 401/403 from ESI into missing_scope", async () => {
  const esi = createFakeEsi({
    "/characters/12345/": { name: "X" },
    "/characters/12345/wallet/journal/?page=1": new EsiError({
      status: 403,
      path: "/characters/12345/wallet/journal/",
      message: "forbidden",
    }),
  });
  const ctx = baseCtx(esi);
  await assert.rejects(
    () => getTool("export_wallet_ledger").handler(ctx, { format: "beancount" }),
    (err) => err instanceof ToolError && err.code === "missing_scope",
  );
});
