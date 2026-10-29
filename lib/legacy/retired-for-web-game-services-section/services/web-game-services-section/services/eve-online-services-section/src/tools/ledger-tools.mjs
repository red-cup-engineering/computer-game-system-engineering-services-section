// src/tools/ledger-tools.mjs — export_wallet_ledger: pulls the character's
// recent wallet journal from ESI, wraps each entry in a provenance
// envelope (src/records/eve-records.mjs), maps it to a double-entry
// transaction (src/ledgering/ledger.mjs), and serializes to Beancount or
// hledger per the 2026-08-05 ledger-export-conventions note. ToolError
// comes from the upstream generic registry package, not ./registry.mjs
// (which imports this file at top level — importing back would be circular).

import { ToolError, assistOperation } from "@red-cup-engineering/personal-intelligence-systems-services-section/tools";
import { EsiError } from "../esi/esi-client.mjs";
import { characterPublic as characterPublicInfo, walletJournal as characterWalletJournal } from "../esi/endpoints.mjs";
import { humanizeRefType } from "./character-tools.mjs";
import { makeWalletJournalRecord, walletJournalToTransactions } from "../records/eve-records.mjs";
import { toBeancount, toHledger } from "../ledgering/ledger.mjs";

const DEFAULT_DAYS = 30;
const MAX_DAYS = 90;
const MS_PER_DAY = 86_400_000;

// Same scope get_wallet_journal requires (esi-wallet.read_character_wallet.v1)
// plus the public /characters/{id}/ read this tool also makes to resolve the
// character's display name for account-path segments and ledger metadata —
// that endpoint needs no scope, so only the wallet-journal one is listed.
const REQUIRED_SCOPES = ["esi-wallet.read_character_wallet.v1"];

function requireContext(ctx, toolName) {
  if (!ctx || typeof ctx !== "object") {
    throw new TypeError(`${toolName}: ctx must be an object`);
  }
  if (!ctx.esi || typeof ctx.esi.get !== "function") {
    throw new TypeError(`${toolName}: ctx.esi must be an ESI client exposing get()`);
  }
  if (!Number.isInteger(ctx.characterId)) {
    throw new TypeError(`${toolName}: ctx.characterId must be an integer`);
  }
  if (typeof ctx.accessToken !== "string" || ctx.accessToken.length === 0) {
    throw new ToolError(
      `${toolName}: requires ctx.accessToken (no ESI access token on context)`,
      "missing_token",
    );
  }
}

// Mirrors character-tools.mjs's esiGet: translates a 401/403 into
// ToolError("missing_scope", ...) and lets every other EsiError propagate.
async function esiGet(ctx, toolName, descriptor) {
  try {
    return await ctx.esi.get(descriptor.path, { token: ctx.accessToken, query: descriptor.query });
  } catch (err) {
    if (err instanceof EsiError && (err.status === 401 || err.status === 403)) {
      throw new ToolError(
        `${toolName}: ESI rejected the request (status ${err.status}) at ${descriptor.path} — required scope(s): ${REQUIRED_SCOPES.join(", ")}`,
        "missing_scope",
      );
    }
    throw err;
  }
}

function validateFormat(args) {
  const format = args?.format;
  if (format !== "beancount" && format !== "hledger") {
    throw new ToolError('export_wallet_ledger: format must be "beancount" or "hledger"', "invalid_args");
  }
  return format;
}

function validateDays(args) {
  if (args?.days === undefined) return DEFAULT_DAYS;
  const { days } = args;
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
    throw new ToolError(`export_wallet_ledger: days must be an integer between 1 and ${MAX_DAYS}`, "invalid_args");
  }
  return days;
}

function rawEntryToJournalEntry(row) {
  return {
    id: row.id,
    date: row.date,
    amount: row.amount ?? null,
    balance: row.balance ?? null,
    refType: row.ref_type ?? null,
    refTypeLabel: humanizeRefType(row.ref_type),
    description: row.description ?? null,
    firstPartyId: row.first_party_id ?? null,
    secondPartyId: row.second_party_id ?? null,
    reason: row.reason ?? null,
  };
}

async function exportWalletLedgerHandler(ctx, args) {
  requireContext(ctx, "export_wallet_ledger");
  const format = validateFormat(args);
  const days = validateDays(args);
  const observations = [];

  const pub = await esiGet(ctx, "export_wallet_ledger", characterPublicInfo(ctx.characterId));
  observations.push(pub.observation);
  const characterName = pub.data?.name;
  if (typeof characterName !== "string" || characterName.length === 0) {
    throw new ToolError("export_wallet_ledger: ESI returned no character name to resolve", "tool_failed");
  }

  // Wallet journal, page 1 only — matches get_wallet_journal's own fetch
  // (see character-tools.mjs); ESI's wallet journal has no documented
  // multi-page contract for a single character's recent history.
  const page = await esiGet(ctx, "export_wallet_ledger", characterWalletJournal(ctx.characterId, { page: 1 }));
  observations.push(page.observation);
  const rows = Array.isArray(page.data) ? page.data : [];

  const now = typeof ctx.now === "function" ? ctx.now() : Date.now();
  const cutoffMs = now - days * MS_PER_DAY;
  const withinWindow = rows.filter((row) => {
    const ms = Date.parse(row.date);
    return Number.isFinite(ms) && ms >= cutoffMs;
  });

  const entries = withinWindow.map(rawEntryToJournalEntry);
  const records = await Promise.all(
    entries.map((entry) => makeWalletJournalRecord(entry, { characterName, observation: page.observation })),
  );
  const transactions = walletJournalToTransactions(records, { characterName });

  // The ISK commodity declaration needs some real calendar date to open on;
  // the earliest transaction in this export is the natural choice (entries
  // are not guaranteed sorted, so take the min explicitly), falling back to
  // "today" (per ctx.now, civil day) when the window is empty.
  const commodityDate =
    entries.length > 0
      ? entries.reduce((min, e) => (e.date < min ? e.date : min), entries[0].date).slice(0, 10)
      : new Date(now).toISOString().slice(0, 10);

  const text =
    format === "beancount"
      ? toBeancount(transactions, {
          title: `EVE wallet journal — ${characterName}`,
          operatingCurrency: "ISK",
          commodityDecls: [
            { date: commodityDate, commodity: "ISK", name: "Interstellar Kredits", assetClass: "Cash" },
          ],
        })
      : toHledger(transactions);

  return {
    data: { format, text, transactionCount: transactions.length },
    observations,
  };
}

export const ledgerTools = [
  assistOperation({
    id: "export_wallet_ledger",
    description:
      "Export the authenticated character's recent wallet journal as a double-entry " +
      "Beancount or hledger ledger file, mapped per the house EVE-ledger convention.",
    parameters: {
      type: "object",
      properties: {
        format: {
          type: "string",
          enum: ["beancount", "hledger"],
          description: "Output ledger format.",
        },
        days: {
          type: "integer",
          minimum: 1,
          maximum: MAX_DAYS,
          description: `How many days of wallet history to include (default ${DEFAULT_DAYS}, max ${MAX_DAYS}).`,
        },
      },
      required: ["format"],
      additionalProperties: false,
    },
    effects: ["network"],
    handler: exportWalletLedgerHandler,
  }),
];
