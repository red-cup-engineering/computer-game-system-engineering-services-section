# records

The typed, versioned, provenance-enveloped interchange format for EVE Assist's own data (ROADMAP.md's ideas inbox: "a standardized serialization of EVE data, with real schemas, as the interchange layer for our own EVE app ecosystem").
Every retrieved or player-authored fact this application keeps around gets wrapped the same way, whether it came from ESI, zKillboard, or a player's own keyboard — so the web app, MCP clients, ledger export, and any future consumer read and write the same shapes.

## The interchange-format doctrine

1. **Typed.**
  Every record carries a `type` string naming what it is (`"EveWalletJournalEntry"`, `"PlayerNote"`, `"Decision"`, ...).
  A consumer decides how to handle a record by looking at `type`, never by sniffing its shape.
2. **Versioned.**
  `schemaVersion` (default `1`) names *which* shape of that type a record uses.
  Evolution is additive: a new optional field bumps nothing; a breaking change (renaming/removing/re-typing a field, or tightening a constraint an old record wouldn't satisfy) bumps `schemaVersion` and gets a new schema file (or a versioned variant) rather than mutating the old one out from under existing records.
  Old records at an old `schemaVersion` remain valid forever — this format has no "migrate in place" step.
3. **Provenance envelope.**
  `recordedAt` + `source` say when and from where the enclosed `data` was learned (`source.kind`: `"esi"` | `"zkillboard"` | `"player"` | `"derived"`, `source.path`/`source.expiresAt` for ESI-sourced facts).
  This is the aspirations note's "every retrieved fact carries provenance" and "different sources have different authority" principles, made structural rather than left to prose — see `../../ROADMAP.md`, "Product principles".
  A record's `data` never gets used without also being able to answer "how do we know this, and how fresh was it?"
4. **Validators reject unknown.**
  Every `lib/schemas/*.schema.json` file in this package sets `additionalProperties: false`.
  A schema is a strict contract, not a loose sketch: a record with an extra field the schema doesn't name fails validation rather than being silently accepted and silently dropped downstream.
  Widening a schema (adding an optional field) is a deliberate, reviewed edit to the schema file, not something that happens by a producer just starting to send more data.

## Module map

- `envelope.mjs` — `makeRecord`/`withIdentity`: builds and identifies the shared envelope.
  EVE-agnostic; validates only the envelope shape itself (source.kind, recordedAt, etc.), not any particular `data` payload.
  Depends only on `../addressing` (the one sibling `src/` dir the extraction rule allows).
- Schema admission is the house type authority's one evaluator, `validateJsonSchema` from `@red-cup-engineering/computer-data-engine` (interpretive, full Draft 2020-12, runs in the Worker); this directory carries no validator of its own.
- `eve-records.mjs` — the EVE-specific adapter layer.
  `makeWalletJournalRecord` wraps one ESI wallet-journal entry as a validated `EveWalletJournalEntry` record; `walletJournalToTransactions` maps a batch of those to `../ledgering` double-entry transactions per the house mapping in `../../content/text/documents/articles/notes/2026/08/05/2026-08-05-note-on-eve-ledger-export-conventions.md`.
  This file is *not* extraction-ready — it is exactly the app-specific glue the generic modules (`envelope.mjs`, `validate.mjs`, `../ledgering`, `../addressing`) are kept free of.
- `../../lib/schemas/*.schema.json` — one schema per record kind, each `$id`-named under `https://eve-assist.561.group/schemas/` and each describing a record's `data`, not the enclosing envelope (`record-envelope.schema.json` is the one exception — it describes the envelope itself, leaving `data` unconstrained since that's the per-kind schema's job).

## Record kinds shipped so far

| `type`                   | schema file                              | `source.kind` typically |
|---------------------------|-------------------------------------------|---------------------------|
| `EveWalletJournalEntry`   | `eve-wallet-journal-entry.schema.json`     | `esi`                     |
| `EveMarketOrderSnapshot`  | `eve-market-order-snapshot.schema.json`    | `esi`                     |
| `EveSkillQueueSnapshot`   | `eve-skill-queue-snapshot.schema.json`     | `esi`                     |
| `PlayerNote`              | `player-note.schema.json`                  | `player`                  |
| `Decision`                | `decision.schema.json`                     | `player` or `derived`     |
| `Outcome`                 | `outcome.schema.json`                      | `player` or `derived`     |

Only `EveWalletJournalEntry` has a builder (`makeWalletJournalRecord`) in this wave; the others ship as validated schemas ready for a builder once the corresponding tool/UI lands (`makeRecord` from `envelope.mjs` plus `validateJsonSchema` against the relevant schema is the whole recipe — see `makeWalletJournalRecord`'s body for the pattern to copy).

## Usage

```js
import { makeWalletJournalRecord, walletJournalToTransactions } from "./eve-records.mjs";

// entry: one element of get_wallet_journal's data.entries (character-tools.mjs)
// observation: the EsiObservation the wallet-journal call returned
const record = await makeWalletJournalRecord(entry, {
  characterName: "Sennhauser",
  observation,
});

const transactions = walletJournalToTransactions([record], { characterName: "Sennhauser" });
// -> src/ledgering transactions, ready for toBeancount/toHledger/dedupeAgainst
```

## Guarantees / limits

- `makeRecord` throws `TypeError` for a missing/invalid `type`, `schemaVersion`, `source`, or `data`; it does not validate `data` against any schema itself (validating a specific record kind's `data` is the caller's job — see `eve-records.mjs` for the pattern).
- `validateJsonSchema` accumulates every issue ({ path, keyword, message }, ajv-identical) rather than failing fast; `eve-records.mjs` folds them into one TypeError at its boundary.
- `withIdentity` never mutates its input; it returns a new frozen object with `id` attached (`"id:<declared id>"` if the record already has one, else `"rmn:<sha256 content hash>"` — see `../addressing/addressing.mjs`).
- `walletJournalToTransactions` does not resolve `payee` (no first/second party id → name lookup lives in this module); every produced transaction has `payee` unset.
  See `eve-records.mjs`'s doc comment for why.
- Zero dependencies beyond sibling `src/` modules; Web APIs only (no `node:fs`, no `node:http`) — runs identically under Node 24 and Cloudflare Workers.
  JSON Schema files are loaded via a static `import ... with { type: "json" }` attribute, not filesystem reads.

## Tests

`test/records.test.mjs` (run via `npm test` at the package root) covers: envelope construction/validation happy and sad paths, `withIdentity`'s id-vs-hash fallback, `validateJsonSchema` happy/sad paths including the JSON-pointer path of each issue, `makeWalletJournalRecord` end to end against a fake ESI observation, and `walletJournalToTransactions`'s mapping — civil-day date truncation, the sign convention on both an income and an expense entry (postings sum to zero either way), ref-type PascalCasing into the account path, and the metadata keys named in the ledger-conventions note.
