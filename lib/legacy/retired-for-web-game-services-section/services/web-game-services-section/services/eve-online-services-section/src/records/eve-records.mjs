// src/records/eve-records.mjs
//
// EVE-specific glue between the generic envelope/schema machinery in this
// directory and the generic ledgering engine in src/ledgering: builds a
// provenance-enveloped, schema-validated record from one ESI wallet-journal
// entry, and maps a batch of such records to double-entry ledger
// transactions per the house mapping documented in
// content/text/documents/articles/notes/2026/08/05/2026-08-05-note-on-eve-ledger-export-conventions.md.
//
// This file (unlike ./envelope.mjs) is deliberately EVE-specific and is NOT
// a future standalone package — it is exactly the kind of "EVE adapter"
// ROADMAP.md's wave-2 entry says belongs outside the generic
// extraction-ready modules. Per-kind schema admission goes through the
// house type authority's one evaluator (validateJsonSchema, from
// @red-cup-engineering/computer-system-engine), not a package-local validator.
//
// JSON Schema files are loaded via a static import attribute (`with { type:
// "json" }`), not node:fs — this is a language-level import, not a Node
// builtin API, so it bundles identically under Cloudflare Workers (esbuild
// inlines the JSON) and runs unmodified under Node 24 (native ESM JSON
// import support). No filesystem access happens at runtime.

import { makeRecord, withIdentity } from "./envelope.mjs";
import { validateJsonSchema } from "@red-cup-engineering/json-schema-services-section/validation";

/** Admit `value` against `schema` at a programming boundary: return it, or throw a TypeError naming every issue. */
function admit(value, schema, label) {
  const result = validateJsonSchema(value, schema);
  if (!result.valid) throw new TypeError(`${label}: ${result.issues.map((issue) => `${issue.path || "/"} ${issue.message}`).join("; ")}`);
  return value;
}
import { makeTransaction } from "../ledgering/ledger.mjs";
import recordEnvelopeSchema from "../../lib/schemas/record-envelope.schema.json" with { type: "json" };
import walletJournalEntrySchema from "../../lib/schemas/eve-wallet-journal-entry.schema.json" with { type: "json" };

const WALLET_JOURNAL_ENTRY_FIELDS = [
  "id",
  "date",
  "amount",
  "balance",
  "refType",
  "refTypeLabel",
  "description",
  "firstPartyId",
  "secondPartyId",
  "reason",
];

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

// Sanitizes a free-form label (an ESI ref_type or an EVE character name,
// which may contain spaces, apostrophes, or hyphens) into a single
// PascalCase account-path segment: split on runs of non-alphanumeric
// characters, title-case each surviving chunk, join with no separator.
// "bounty_prizes" -> "BountyPrizes"; "Jean Grey" -> "JeanGrey". Assumed
// account-segment shape per the ledgering module's pinned contract
// ("account segments PascalCase colon-joined, validated by ACCOUNT_RE") —
// src/ledgering/ledger.mjs owns the actual regex; if its ACCOUNT_RE ever
// rejects a shape this produces, that is a cross-module contract mismatch
// to reconcile, not something to silently work around here.
function toPascalSegment(raw, label) {
  requireNonEmptyString(raw, label);
  const words = raw.trim().split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (words.length === 0) {
    throw new TypeError(`${label}: ${JSON.stringify(raw)} contains no usable characters for an account segment`);
  }
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join("");
}

function walletJournalDataFromEntry(entry) {
  if (typeof entry !== "object" || entry === null) {
    throw new TypeError("makeWalletJournalRecord: entry must be an object");
  }
  const data = {};
  for (const field of WALLET_JOURNAL_ENTRY_FIELDS) {
    data[field] = entry[field] === undefined ? null : entry[field];
  }
  // refTypeLabel is schema-required non-null; unlike the other nullable
  // fields it must not silently become null when the caller omits it.
  if (typeof data.refTypeLabel !== "string" || data.refTypeLabel.length === 0) {
    throw new TypeError("makeWalletJournalRecord: entry.refTypeLabel must be a non-empty string");
  }
  return data;
}

/**
 * Wraps one get_wallet_journal-shaped entry (see
 * src/tools/character-tools.mjs) in a provenance envelope (record type
 * "EveWalletJournalEntry"), validating the payload against
 * eve-wallet-journal-entry.schema.json and the finished envelope against
 * record-envelope.schema.json before returning.
 *
 * `observation` is the pinned EsiObservation the entry came from
 * ({ path, expiresAt, recordedAt, ... } — see src/esi/esi-client.mjs); its
 * `recordedAt` becomes the envelope's own `recordedAt` (when this fact was
 * learned from ESI, not when this function happened to run), and its
 * `path`/`expiresAt` populate `source`. `characterName` is carried by the
 * caller for the ledger-mapping step (walletJournalToTransactions) — it is
 * deliberately NOT stored in the record's `data`, because
 * eve-wallet-journal-entry.schema.json's shape is pinned to exactly the
 * get_wallet_journal entry fields (no characterName among them).
 */
export async function makeWalletJournalRecord(entry, { characterName, observation }) {
  requireNonEmptyString(characterName, "makeWalletJournalRecord: characterName");
  if (typeof observation !== "object" || observation === null) {
    throw new TypeError("makeWalletJournalRecord: observation must be an object");
  }
  requireNonEmptyString(observation.path, "makeWalletJournalRecord: observation.path");
  if (typeof observation.recordedAt !== "number" || !Number.isFinite(observation.recordedAt)) {
    throw new TypeError("makeWalletJournalRecord: observation.recordedAt must be a finite number");
  }

  const data = walletJournalDataFromEntry(entry);
  admit(data, walletJournalEntrySchema, "eve-wallet-journal-entry");

  const record = makeRecord({
    type: "EveWalletJournalEntry",
    source: {
      kind: "esi",
      path: observation.path,
      expiresAt: observation.expiresAt ?? null,
    },
    data,
    now: () => observation.recordedAt,
  });
  admit(record, recordEnvelopeSchema, "record-envelope");

  return withIdentity(record);
}

// Uniform sign rule derived from the note's mapping (verified against its
// worked example): the counter account (Income when amount >= 0, Expenses
// when amount < 0) always posts -amount, and the wallet always posts
// +amount. The two postings therefore always sum to exactly zero
// regardless of branch, satisfying makeTransaction's balance check without
// special-casing income vs. expense beyond which account name is used.
function postingsForEntry(entry, characterName) {
  const isIncome = entry.amount >= 0;
  const refTypePascal = toPascalSegment(entry.refType ?? "unknown", "walletJournalToTransactions: entry.refType");
  const characterSegment = toPascalSegment(characterName, "walletJournalToTransactions: characterName");
  const counterAccount = `${isIncome ? "Income" : "Expenses"}:Eve:${characterSegment}:${refTypePascal}`;
  const walletAccount = `Assets:Eve:${characterSegment}:Wallet`;
  return [
    { account: counterAccount, amount: -entry.amount, commodity: "ISK" },
    { account: walletAccount, amount: entry.amount, commodity: "ISK" },
  ];
}

function metadataForEntry(record, entry, characterName) {
  const metadata = {
    id: String(entry.id),
    "esi-path": record.source.path,
    "esi-recorded-at": new Date(record.recordedAt).toISOString(),
    character: characterName,
    "ref-type": entry.refType ?? "unknown",
  };
  if (entry.firstPartyId != null) metadata["first-party-id"] = String(entry.firstPartyId);
  if (entry.secondPartyId != null) metadata["second-party-id"] = String(entry.secondPartyId);
  if (entry.reason != null) metadata.reason = entry.reason;
  return metadata;
}

/**
 * Maps a batch of EveWalletJournalEntry envelope records (as produced by
 * makeWalletJournalRecord) to src/ledgering transactions, per the pinned
 * wallet-journal ledger mapping: date is the entry's civil day, narration
 * is refTypeLabel, metadata carries id/esi-path/esi-recorded-at/character/
 * ref-type/first-party-id/second-party-id/reason, and postings follow the
 * double-entry sign convention (Income negative / Expenses positive on the
 * counter account, wallet the mirror amount) — see postingsForEntry above.
 *
 * `payee` is deliberately left unset: the note's worked example shows a
 * resolved counterparty name ("CONCORD"), but no first/second-party
 * id-to-name resolution is available inside src/records (that lookup lives
 * in src/tools/character-tools.mjs, over ESI's /characters/{id}/ and
 * /corporations/{id}/ endpoints, which this generic-adjacent module does
 * not depend on). Reported as a contract ambiguity — see this assignment's
 * final report — rather than silently inventing a resolver here.
 *
 * Throws if any record's `type` is not "EveWalletJournalEntry" or its
 * `data` fails eve-wallet-journal-entry.schema.json.
 */
export function walletJournalToTransactions(records, { characterName }) {
  requireNonEmptyString(characterName, "walletJournalToTransactions: characterName");
  if (!Array.isArray(records)) {
    throw new TypeError("walletJournalToTransactions: records must be an array");
  }
  return records.map((record, index) => {
    if (typeof record !== "object" || record === null) {
      throw new TypeError(`walletJournalToTransactions: records[${index}] must be an object`);
    }
    if (record.type !== "EveWalletJournalEntry") {
      throw new TypeError(
        `walletJournalToTransactions: records[${index}].type must be "EveWalletJournalEntry", got ${JSON.stringify(record.type)}`,
      );
    }
    admit(record.data, walletJournalEntrySchema, "eve-wallet-journal-entry");
    const entry = record.data;
    if (typeof entry.amount !== "number" || !Number.isFinite(entry.amount)) {
      throw new TypeError(
        `walletJournalToTransactions: records[${index}].data.amount must be a finite number to post a transaction`,
      );
    }
    const civilDate = String(entry.date).slice(0, 10);
    return makeTransaction({
      date: civilDate,
      narration: entry.refTypeLabel,
      metadata: metadataForEntry(record, entry, characterName),
      postings: postingsForEntry(entry, characterName),
    });
  });
}
