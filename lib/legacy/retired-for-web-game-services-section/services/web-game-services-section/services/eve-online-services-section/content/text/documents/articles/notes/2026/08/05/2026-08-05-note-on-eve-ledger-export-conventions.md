# Note on EVE ledger export conventions (Beancount / hledger)

Provenance: research subagent, 2026-08-05, commissioned to find the network's
existing ledger tooling so the EVE wallet exporter matches house conventions.
Epistemic status: survey of existing artifacts (paths cited) plus a concrete
recommended mapping; the mapping is a design, not yet implemented.

## Findings

1. **No live beancount/hledger tooling exists on the network.** All 47 ledger
   files found are archival (`lib/**/lib/legacy/**`, `.../triage/**`): Morgan's
   personal 2021–2023 ledger-cli → beancount migration, and a 2026-04-04
   561-Group chart of accounts
   (`.../rsc-quiescent/triage/accounting/texts/{main,accounts,2026-04-04-opening}.beancount`).
   No generator code, no bean-check/fava/hledger invocation anywhere in
   Makefiles, package.json scripts, hooks, or CI. Beancount is the more
   recent, deliberate format; the 561-Group chart is the house style to match.
2. **House beancount style** (from the 561-Group chart): `option "title"` /
   `option "operating_currency"`; commodities declared with `name:` /
   `asset-class:` metadata; `YYYY-MM-DD open PascalCase:Colon:Accounts CUR`
   with single-currency constraint; `include`-by-concern file split (main →
   accounts → opening), not per-year; `;` comments with section dividers;
   non-USD commodities are first-class (`TOKENS`, `HOURS`) — precedent for
   `ISK`.
3. **Idempotency convention** (from `2026-07-19-event-contract-arbitrage-desk/src/ledger.mjs`
   and `witness-journal-store.mjs` / `@red-cup-engineering/semantic-record-journal-service`):
   prefer the source system's own id, else content-hash
   (`urn:sha256:` over key-sorted JSON); append-only; an id already present is
   a replay and is skipped, never rewritten. ESI wallet-journal `id` is a
   stable CCP-issued integer — use it directly as the dedup key.

## Recommended mapping (implement in src/records/)

- Commodity `ISK` declared with name/asset-class metadata. Accounts:
  `Assets:Eve:<Character>:Wallet`, `Income:Eve:<Character>:<RefTypePascal>`,
  `Expenses:Eve:<Character>:<RefTypePascal>` (currency-constrained to ISK).
- Transaction date = ESI `date` truncated to civil day; the full timestamp
  goes to `esi-recorded-at:` metadata. Payee = resolvable counterparty name,
  else source label (CONCORD, hub). Narration = `humanizeRefType` output
  (already implemented in `src/tools/character-tools.mjs`).
- Metadata keys, identical across both formats (beancount metadata lines /
  hledger `; key:value` comment tags): `id`, `esi-path`, `esi-recorded-at`,
  `esi-etag`, `character`, `ref-type`, `first-party-id`, `second-party-id`,
  `reason` — taken verbatim from the pinned `EsiObservation` shape in
  `src/esi/esi-client.mjs`; no invented provenance vocabulary.
- Sign convention: double-entry — Income accounts negative on receipt,
  Assets wallet positive; Expenses positive on spend, wallet negative.
  Running balance is computed by the ledger tool; ESI's `balance` field is
  used only for periodic `balance` reconciliation assertions.
- hledger variant: slash dates (`YYYY/MM/DD`), bare `ISK` amount suffix,
  plain `account` declarations, same tags in the comment.
- File layout: one file per character per month,
  `eve-wallet-journal/<character>/<yyyy>/<yyyy>-<mm>.beancount|.journal`,
  plus a generated accounts file; append-only with skip-on-existing-id, per
  the network record convention.

## Example (beancount)

```beancount
2026-08-01 * "CONCORD" "Bounty Prizes"
  id: "34772918001"
  esi-path: "/characters/2118406090/wallet/journal/"
  esi-recorded-at: "2026-08-01T14:03:11Z"
  character: "Sennhauser"
  ref-type: "bounty_prizes"
  Income:Eve:Sennhauser:BountyPrizes    -1250000.00 ISK
  Assets:Eve:Sennhauser:Wallet           1250000.00 ISK
```

(Full three-example set for both formats in the research transcript; the
implementation's tests should encode these shapes.)
