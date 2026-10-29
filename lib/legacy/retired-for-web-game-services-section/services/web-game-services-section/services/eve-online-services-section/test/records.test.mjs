// Exercises envelope.mjs/eve-records.mjs against the worked example in
// 2026-08-05-note-on-eve-ledger-export-conventions.md. Schema admission goes
// through the engine's interpretive validator
// (validateJsonSchema from @red-cup-engineering/computer-system-engine),
// not a package-local one — src/records/validate.mjs was deleted when EVE
// Assist migrated onto the Assist engine.

import { test } from "node:test";
import assert from "node:assert/strict";
import { validateJsonSchema as validateAgainstSchema } from "@red-cup-engineering/json-schema-services-section/validation";
import { makeRecord, withIdentity } from "../src/records/envelope.mjs";
import { makeWalletJournalRecord, walletJournalToTransactions } from "../src/records/eve-records.mjs";
import walletJournalEntrySchema from "../lib/schemas/eve-wallet-journal-entry.schema.json" with { type: "json" };
import recordEnvelopeSchema from "../lib/schemas/record-envelope.schema.json" with { type: "json" };
import playerNoteSchema from "../lib/schemas/player-note.schema.json" with { type: "json" };
import decisionSchema from "../lib/schemas/decision.schema.json" with { type: "json" };
import outcomeSchema from "../lib/schemas/outcome.schema.json" with { type: "json" };

const NI_URI_PATTERN = /^ni:\/\/\/sha-256;[A-Za-z0-9_-]{43}$/u;

// --- envelope.mjs: makeRecord ----------------------------------------------

test("makeRecord builds a frozen envelope with recordedAt from now()", () => {
  const record = makeRecord({
    type: "PlayerNote",
    source: { kind: "player" },
    data: { text: "lost a Venture to a gank in Tama", tags: ["loss"] },
    now: () => 1_700_000_000_000,
  });
  assert.equal(record.type, "PlayerNote");
  assert.equal(record.schemaVersion, 1);
  assert.equal(record.recordedAt, 1_700_000_000_000);
  assert.deepEqual(record.source, { kind: "player", expiresAt: null });
  assert.equal(record.data.text, "lost a Venture to a gank in Tama");
  assert.throws(() => {
    record.type = "Other";
  });
});

test("makeRecord carries source.path/expiresAt when provided", () => {
  const record = makeRecord({
    type: "EveWalletJournalEntry",
    source: { kind: "esi", path: "/characters/1/wallet/journal/", expiresAt: 123 },
    data: { id: 1 },
  });
  assert.equal(record.source.path, "/characters/1/wallet/journal/");
  assert.equal(record.source.expiresAt, 123);
});

test("makeRecord rejects missing/invalid type", () => {
  assert.throws(() => makeRecord({ source: { kind: "player" }, data: {} }), TypeError);
  assert.throws(() => makeRecord({ type: "", source: { kind: "player" }, data: {} }), TypeError);
});

test("makeRecord rejects a non-positive-integer schemaVersion", () => {
  assert.throws(
    () => makeRecord({ type: "PlayerNote", schemaVersion: 0, source: { kind: "player" }, data: {} }),
    TypeError,
  );
  assert.throws(
    () => makeRecord({ type: "PlayerNote", schemaVersion: 1.5, source: { kind: "player" }, data: {} }),
    TypeError,
  );
});

test("makeRecord rejects an invalid source.kind", () => {
  assert.throws(
    () => makeRecord({ type: "PlayerNote", source: { kind: "wiki" }, data: {} }),
    TypeError,
  );
  assert.throws(() => makeRecord({ type: "PlayerNote", source: null, data: {} }), TypeError);
});

test("makeRecord rejects undefined data", () => {
  assert.throws(
    () => makeRecord({ type: "PlayerNote", source: { kind: "player" }, data: undefined }),
    TypeError,
  );
});

// --- envelope.mjs: withIdentity ---------------------------------------------
// Every record's id is now semanticId(record) (an ni: URI over its
// canonical CBOR encoding, @red-cup-engineering/computer-system-engine) —
// there is no more "declared id wins, else sen:<hash>" precedence, and
// nothing persists these ids.

test("withIdentity attaches an ni: URI content id, and does not mutate the original record", async () => {
  const record = makeRecord({
    type: "PlayerNote",
    source: { kind: "player" },
    data: { text: "note", tags: [] },
    now: () => 1,
  });
  const withId = await withIdentity(record);
  assert.match(withId.id, NI_URI_PATTERN);
  assert.equal("id" in record, false);
});

test("withIdentity is deterministic: two structurally-equal records get the same id", async () => {
  const recordA = makeRecord({ type: "PlayerNote", source: { kind: "player" }, data: { text: "x", tags: [] }, now: () => 5 });
  const recordB = makeRecord({ type: "PlayerNote", source: { kind: "player" }, data: { text: "x", tags: [] }, now: () => 5 });
  const idA = (await withIdentity(recordA)).id;
  const idB = (await withIdentity(recordB)).id;
  assert.equal(idA, idB);
});

// --- the data engine's evaluator over this package's lib/schemas ----

test("validateAgainstSchema accepts a value matching the schema", () => {
  const value = { text: "hello", tags: ["a", "b"] };
  assert.deepEqual(validateAgainstSchema(value, playerNoteSchema), { valid: true, issues: [] });
});

test("validateAgainstSchema rejects a missing required property, naming its path", () => {
  const result = validateAgainstSchema({ tags: [] }, playerNoteSchema);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.path === "" && issue.keyword === "required" && issue.message.includes("'text'")));
});

test("validateAgainstSchema rejects a type mismatch at a nested path", () => {
  const result = validateAgainstSchema({ text: "ok", tags: ["fine", 5] }, playerNoteSchema);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.path === "/tags/1" && issue.keyword === "type"));
});

test("validateAgainstSchema rejects additionalProperties: false violations", () => {
  const result = validateAgainstSchema({ text: "ok", tags: [], extra: true }, playerNoteSchema);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.path === "" && issue.keyword === "additionalProperties"));
});

test("validateAgainstSchema enforces minLength/enum/const/minimum/maximum", () => {
  assert.equal(validateAgainstSchema({ text: "", tags: [] }, playerNoteSchema).valid, false);
  assert.equal(validateAgainstSchema({ kind: "wiki" }, recordEnvelopeSchema.properties.source).valid, false);
  assert.equal(
    validateAgainstSchema({ decisionId: "d1", observedAt: -1, result: "r", lesson: "l" }, outcomeSchema).valid,
    false,
  );
});

test("validateAgainstSchema round-trips the decision schema's happy path", () => {
  const decision = {
    question: "Which hauler for null-sec ratting?",
    optionsConsidered: ["Venture", "Prospect"],
    chosen: "Prospect",
    rationale: "cloak lets me disengage before tackle lands",
  };
  const result = validateAgainstSchema(decision, decisionSchema);
  assert.equal(result.valid, true);
  assert.deepEqual(result.issues, []);
});

test("validateAgainstSchema validates the full envelope shape via record-envelope.schema.json", () => {
  const record = makeRecord({
    type: "PlayerNote",
    source: { kind: "player" },
    data: { text: "note", tags: [] },
    now: () => 5,
  });
  assert.equal(validateAgainstSchema(record, recordEnvelopeSchema).valid, true);
});

// --- eve-records.mjs: makeWalletJournalRecord -------------------------------

function fakeObservation(overrides = {}) {
  return {
    type: "EsiObservation",
    path: "/characters/2118406090/wallet/journal/",
    query: { page: 1 },
    status: 200,
    expiresAt: 1_700_003_600_000,
    recordedAt: 1_700_000_000_000,
    etag: null,
    ...overrides,
  };
}

function bountyEntry(overrides = {}) {
  return {
    id: 34772918001,
    date: "2026-08-01T14:03:11Z",
    amount: 1250000,
    balance: 5000000,
    refType: "bounty_prizes",
    refTypeLabel: "Bounty Prizes",
    description: "Bounty payment",
    firstPartyId: 1000125,
    secondPartyId: 2118406090,
    reason: null,
    ...overrides,
  };
}

test("makeWalletJournalRecord builds a validated, identified envelope", async () => {
  const observation = fakeObservation();
  const record = await makeWalletJournalRecord(bountyEntry(), {
    characterName: "Sennhauser",
    observation,
  });
  assert.equal(record.type, "EveWalletJournalEntry");
  assert.equal(record.source.kind, "esi");
  assert.equal(record.source.path, observation.path);
  assert.equal(record.source.expiresAt, observation.expiresAt);
  assert.equal(record.recordedAt, observation.recordedAt);
  assert.equal(record.data.id, 34772918001);
  assert.equal(record.data.refTypeLabel, "Bounty Prizes");
  // characterName is not part of the schema-pinned data shape.
  assert.equal("characterName" in record.data, false);
  assert.match(record.id, NI_URI_PATTERN);
  assert.equal(validateAgainstSchema(record.data, walletJournalEntrySchema).valid, true);
  assert.equal(validateAgainstSchema(record, recordEnvelopeSchema).valid, true);
});

test("makeWalletJournalRecord rejects a missing characterName or observation", async () => {
  await assert.rejects(
    () => makeWalletJournalRecord(bountyEntry(), { observation: fakeObservation() }),
    TypeError,
  );
  await assert.rejects(
    () => makeWalletJournalRecord(bountyEntry(), { characterName: "Sennhauser" }),
    TypeError,
  );
});

test("makeWalletJournalRecord rejects an entry that fails the schema (bad refTypeLabel)", async () => {
  await assert.rejects(
    () =>
      makeWalletJournalRecord(bountyEntry({ refTypeLabel: "" }), {
        characterName: "Sennhauser",
        observation: fakeObservation(),
      }),
    TypeError,
  );
});

// --- eve-records.mjs: walletJournalToTransactions ---------------------------

async function walletRecord(entryOverrides, observationOverrides) {
  return makeWalletJournalRecord(bountyEntry(entryOverrides), {
    characterName: "Sennhauser",
    observation: fakeObservation(observationOverrides),
  });
}

test("walletJournalToTransactions maps an income entry per the ledger-conventions note example", async () => {
  const record = await walletRecord();
  const [tx] = walletJournalToTransactions([record], { characterName: "Sennhauser" });

  assert.equal(tx.date, "2026-08-01"); // civil day, full timestamp moved to metadata
  assert.equal(tx.narration, "Bounty Prizes");
  assert.equal(tx.metadata.id, "34772918001");
  assert.equal(tx.metadata["esi-path"], "/characters/2118406090/wallet/journal/");
  assert.equal(tx.metadata["esi-recorded-at"], new Date(1_700_000_000_000).toISOString());
  assert.equal(tx.metadata.character, "Sennhauser");
  assert.equal(tx.metadata["ref-type"], "bounty_prizes");
  assert.equal(tx.metadata["first-party-id"], "1000125");
  assert.equal(tx.metadata["second-party-id"], "2118406090");
  assert.equal("reason" in tx.metadata, false); // null reason omitted, not stringified to "null"

  assert.equal(tx.postings.length, 2);
  const income = tx.postings.find((p) => p.account.startsWith("Income:"));
  const wallet = tx.postings.find((p) => p.account.startsWith("Assets:"));
  assert.equal(income.account, "Income:Eve:Sennhauser:BountyPrizes");
  assert.equal(income.amount, -1250000);
  assert.equal(wallet.account, "Assets:Eve:Sennhauser:Wallet");
  assert.equal(wallet.amount, 1250000);
  assert.equal(income.commodity, "ISK");
  assert.equal(wallet.commodity, "ISK");

  const total = tx.postings.reduce((sum, p) => sum + p.amount, 0);
  assert.ok(Math.abs(total) < 1e-6);
});

test("walletJournalToTransactions maps an expense entry with the mirrored sign convention", async () => {
  const record = await walletRecord({
    id: 34772918002,
    amount: -500.5,
    refType: "broker_fee",
    refTypeLabel: "Broker Fee",
    firstPartyId: 2118406090,
    secondPartyId: null,
    reason: null,
  });
  const [tx] = walletJournalToTransactions([record], { characterName: "Sennhauser" });

  const expense = tx.postings.find((p) => p.account.startsWith("Expenses:"));
  const wallet = tx.postings.find((p) => p.account.startsWith("Assets:"));
  assert.equal(expense.account, "Expenses:Eve:Sennhauser:BrokerFee");
  assert.equal(expense.amount, 500.5);
  assert.equal(wallet.account, "Assets:Eve:Sennhauser:Wallet");
  assert.equal(wallet.amount, -500.5);
  assert.equal("second-party-id" in tx.metadata, false); // null secondPartyId omitted

  const total = tx.postings.reduce((sum, p) => sum + p.amount, 0);
  assert.ok(Math.abs(total) < 1e-6);
});

test("walletJournalToTransactions carries a reason through metadata when present", async () => {
  const record = await walletRecord({ reason: "for the fleet" });
  const [tx] = walletJournalToTransactions([record], { characterName: "Sennhauser" });
  assert.equal(tx.metadata.reason, "for the fleet");
});

test("walletJournalToTransactions PascalCases multi-word character names into one account segment", async () => {
  const record = await makeWalletJournalRecord(bountyEntry(), {
    characterName: "Jean Grey",
    observation: fakeObservation(),
  });
  const [tx] = walletJournalToTransactions([record], { characterName: "Jean Grey" });
  const wallet = tx.postings.find((p) => p.account.startsWith("Assets:"));
  assert.equal(wallet.account, "Assets:Eve:JeanGrey:Wallet");
});

test("walletJournalToTransactions rejects a record of the wrong type", async () => {
  const notWalletJournal = await withIdentity(
    makeRecord({ type: "PlayerNote", source: { kind: "player" }, data: { text: "x", tags: [] } }),
  );
  assert.throws(
    () => walletJournalToTransactions([notWalletJournal], { characterName: "Sennhauser" }),
    TypeError,
  );
});

test("walletJournalToTransactions requires characterName", async () => {
  const record = await walletRecord();
  assert.throws(() => walletJournalToTransactions([record], {}), TypeError);
});
