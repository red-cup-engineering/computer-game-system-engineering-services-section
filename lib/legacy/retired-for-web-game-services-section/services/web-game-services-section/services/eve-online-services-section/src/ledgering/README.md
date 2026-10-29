# `src/ledgering/` — generic double-entry ledger engine

A dependency-free double-entry bookkeeping engine: validated transaction
construction plus Beancount and hledger plain-text serializers. This module
is domain-agnostic on purpose — see "Extraction note" below.

## Extraction note

This directory imports nothing from elsewhere in this package and nothing
EVE-specific: no character names, ref-types, ISK-only assumptions, or 561
branding. It is written to become a standalone
`@red-cup-engineering/ledgering` package with a purely mechanical move
(copy the directory, add a `package.json`) — no code changes anticipated.
The EVE wallet-journal → ledger mapping (which account a `ref_type` becomes,
how a character name is sanitized into an account segment, `humanizeRefType`
for narrations) lives in `src/records/` and app wiring, one layer up. If you
are tempted to add anything EVE-specific here, it belongs there instead.

## Contract

```js
import {
  makeTransaction,
  toBeancount,
  toHledger,
  extractIds,
  dedupeAgainst,
  LedgerError,
} from "./ledger.mjs";
```

- `makeTransaction({ date, payee?, narration, metadata?, postings })` →
  frozen, validated transaction. `date` is `"YYYY-MM-DD"` and must be a real
  calendar date. `postings` is `[{ account, amount, commodity }, ...]`,
  requires at least 2 entries, and — grouped by `commodity` — each group's
  amounts must sum to 0 within `1e-6` (float-summation slack, not real
  imbalance tolerance). `account` must be PascalCase segments joined by
  colons (e.g. `"Assets:Eve:Sennhauser:Wallet"`); `commodity` must be an
  uppercase code (e.g. `"ISK"`, `"USD"`, `"HOURS"`). `metadata`, if given,
  must be a flat object of string values (no nesting, no non-string values).
  Shape/type mistakes throw `TypeError`; domain violations (imbalance, bad
  account/commodity form, bad date, too few postings) throw `LedgerError`
  with a stable `.code` (`"unbalanced_transaction"`, `"invalid_account"`,
  `"invalid_commodity"`, `"invalid_date"`, `"too_few_postings"`).
- `toBeancount(transactions, { title?, operatingCurrency?, accountOpens?, commodityDecls? })`
  → a Beancount ledger file as a string (see "Serialization choices" below).
- `toHledger(transactions, { accountDecls? })` → an hledger journal as a
  string.
- `extractIds(ledgerText, format)` → `Set<string>` of `id` metadata values
  found in an already-serialized ledger (`format` is `"beancount"` or
  `"hledger"`).
- `dedupeAgainst(ledgerText, format, transactions)` → the subset of
  `transactions` whose `metadata.id` is **not** already present in
  `ledgerText`. Every transaction must carry a non-empty string
  `metadata.id`, or this throws `LedgerError("missing_id")` — dedup without
  an id is meaningless. This is the append-only, skip-on-replay convention
  used across the network (see "Serialization choices").

Both serializers validate their input transactions structurally (must look
like something `makeTransaction` produced) and throw `TypeError` otherwise —
they're independently callable, but not a way to smuggle unvalidated data
into a ledger file.

## Serialization choices

Grounded in
`content/text/documents/articles/notes/2026/08/05/2026-08-05-note-on-eve-ledger-export-conventions.md`
(the network's ledger-tooling research), which found no live beancount/hledger
generator anywhere in the repo and recommended a mapping from a 2026-04-04
561-Group beancount chart of accounts. This module implements the
format-level half of that recommendation, generically:

- **Beancount header**: `option "title" "..."` / `option "operating_currency" "..."`,
  per the house style found in the 561-Group chart.
- **Commodity declarations**: `YYYY-MM-DD commodity CODE` followed by
  indented `name:` / `asset-class:` metadata lines — matches the house
  chart's commodity-declaration shape.
- **Account opens**: `YYYY-MM-DD open PascalCase:Colon:Account CODE`.
- **Transaction header**: `` YYYY-MM-DD * "payee" "narration" `` (payee
  omitted, along with its surrounding quotes, when not given). Flag is
  always `*` (cleared) — this module has no concept of a pending/unreconciled
  state.
- **Metadata lines**: `  key: "value"` (2-space indent), in the same order
  the caller supplied `metadata`, matching the note's worked example
  verbatim.
- **hledger transaction header**: slash dates (`YYYY/MM/DD`); payee/narration
  render as hledger's own `payee | note` split when a payee is present
  (otherwise just the narration); metadata renders once, as a
  ` ; key:value, key:value, ...` tag comment on the header line — not
  per-posting, since these are transaction-level facts (an ESI journal
  entry's id, source path, etc.), not posting-level ones.
- **Idempotency / dedup**: per the note's finding (citing
  `2026-07-19-event-contract-arbitrage-desk/src/ledger.mjs` and the
  semantic-record-journal convention) — prefer the source system's own id
  (ESI wallet-journal `id` is a stable CCP-issued integer) as the dedup key;
  append-only; an id already present is a replay and is skipped, never
  rewritten. `extractIds` + `dedupeAgainst` implement exactly this.

### Posting alignment

Both serializers align postings within a transaction so every amount's
*digits* start in the same column, regardless of sign — reproducing the
alignment in the note's worked bounty example, where a `-1250000.00` posting
and a `1250000.00` posting (different account-name lengths, one negative)
still line up:

```beancount
  Income:Eve:Sennhauser:BountyPrizes    -1250000.00 ISK
  Assets:Eve:Sennhauser:Wallet           1250000.00 ISK
```

The algorithm: for each posting, `columnDemand = indent + account.length +
(amount < 0 ? 1 : 0)` (the `+1` reserves a column for the sign). The shared
digit column for the transaction is `max(columnDemand) + POSTING_GAP` (a
4-space minimum gap). Each posting is then padded so its sign-or-first-digit
lands exactly on that column. `indent` is 2 for Beancount, 4 for hledger.

Amounts are always rendered to 2 decimal places (`toFixed(2)`, with `-0.00`
normalized to `0.00`); commodities render as a bare trailing code (no
currency-symbol prefix), matching the note's "bare commodity suffix"
description of the hledger variant and the plain `ISK` in the Beancount
example.

## Non-choices (deliberately out of scope here)

- **No file I/O, no `content/eve-wallet-journal/...` path layout.** The
  note's recommended file layout (one file per character per month, `content/`
  placement, gitignore rules) is an app-wiring / `src/records/` concern —
  this module only turns transactions into strings.
- **No ESI-shape awareness.** `metadata` is an opaque flat string map here;
  the specific keys the note recommends (`id`, `esi-path`,
  `esi-recorded-at`, `character`, `ref-type`, `first-party-id`,
  `second-party-id`, `reason`) are conventions the caller follows, not
  something this module validates or requires beyond `id` (needed only by
  `dedupeAgainst`).
- **No balance-assertion directives, no `include`, no multi-file layout.**
  Out of scope for a first cut; add as `toBeancount`/`toHledger` options if
  a consumer needs them, without breaking the existing shapes.

## Testing

`test/ledgering.test.mjs` covers: sum-zero validation and its rejection of
imbalance (including a single-commodity-of-many failing while others
balance); multi-commodity transactions; exact-string assertions against the
note's bounty example and an equivalent market-transaction example, in both
serializers, including a full multi-transaction file with options/commodity
decls/account opens; `extractIds` round-tripping this module's own output in
both formats; and `dedupeAgainst` skip-on-replay behavior, including its
`missing_id` guard.
