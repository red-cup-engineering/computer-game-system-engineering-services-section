# @red-cup-engineering/cartridge

The game manifest schema and the intent-log/replay contract every 561 Group game
implements: **seed in, deterministic engine, intent log out, replay to verify.** This
package is the shared substrate for that shape — it does not define any game's `State`,
`Intent`, or `GameEvent` payloads, only the function signatures, log envelope, and manifest
schema around them.

Implements the interfaces specified in `cartridge-and-energy-bank-spec.md` (§1,
"`@red-cup-engineering/cartridge`"). This package covers only the cartridge half of that
spec — `@561-group/energy-bank` (identity + double-entry ledger) is a separate package and
is not implemented here.

Zero runtime dependencies. Every module has a co-located `<name>.test.mts` run under
`node --test`.

Runtime source is `.mjs`, not `.mts`, with hand-written `.d.ts` files alongside: current
Node refuses to type-strip `.mts`/`.ts` files once they are resolved from inside a
`node_modules` directory, so a package meant to be `npm install`ed by other games cannot
ship `.mts` as its actual entry points. The `.test.mts` files are unaffected — they run via
`node --test` from this package's own directory, never resolved through a consumer's
`node_modules` — so they stay `.mts` and import the `.mjs` runtime modules plus
`import type` from the co-located `.d.ts` files.

## Install

```sh
npm install @red-cup-engineering/cartridge --registry http://127.0.0.1:4873/
```

## What's here

- **`@red-cup-engineering/cartridge/manifest`** — the `CartridgeManifest` type and a
  hand-rolled, dependency-free validator (`validateManifest`, `isCartridgeManifest`,
  `assertManifest`). Collects every error found in one pass rather than failing on the
  first.
- **`@red-cup-engineering/cartridge/intent-log`** — the `Intent`/`GameEvent`/`LogEntry`/
  `IntentLog` types, a persisted-v1 stringifier (`canonicalStringify`), log
  encode/decode (`encodeIntentLog`/`decodeIntentLog`), validation (`validateIntentLog`),
  and a pure, monotonic-`seq`-enforcing `appendEntry`.
- **`@red-cup-engineering/cartridge/replay`** — the `Cartridge<State, TIntent>` interface, a
  reference `defaultReplay` implementation (given only `createEngine` + `applyIntent`, it
  rebuilds final state from a seed and an intent list), `hashState` (a stable SHA-256
  digest of a value's JSON, for comparing two replays without deep-equaling state
  objects), and `createVerifier`, which builds the `(seed, configId, IntentLog) => { valid,
  finalState, events, stateHash }` function named by a manifest's `replayVerifier` field.
- **`@red-cup-engineering/cartridge/seed`** — `utcDateString` and `dailySeed` for the
  `daily-utc` `SeedPolicy` (a pure function of a UTC calendar day and a game/config id —
  every player worldwide resolves the same seed on the same day, regardless of local
  timezone), and `clientSuppliedSeed` for the `client-supplied` policy. The clock is always
  an injected `Date` parameter; nothing in this module reads the ambient clock. There is no
  helper for `on-demand` seeds — the spec is explicit that cartridge does not mandate how an
  on-demand seed is chosen.
- **`@red-cup-engineering/cartridge/fixtures/toy-engine`** — a small reference `Cartridge`
  implementation (a "stone pile" game: add/remove/rename intents over a seed-derived
  starting count) used by this package's own tests to prove the whole contract round-trips
  end to end, and available for any implementer's own tests to import as a known-good
  fixture.
- **`@red-cup-engineering/cartridge`** (bare) — re-exports all of the above from one module.

## What this package deliberately does not do

- It does not implement `@561-group/energy-bank` (identity, the double-entry ledger, or
  settlement backends) — that is a separate package per the spec.
- It does not choose an RNG for any game. `createEngine(seed, configId)` must be a pure,
  deterministic function of its inputs, but how a game turns `seed` into random numbers is
  entirely its own internal — this package never mandates mulberry32 or any other PRNG.
- It does not validate a game's own `Intent`/`GameEvent` union beyond the shared envelope
  (`{ kind: string, ...data }`) — the payload shape under `kind` is opaque to this package
  by design.
- It does not silently replace persisted log/replay bytes with a newer generic JSON
  algorithm. `canonicalStringify` is explicitly `red-cup.cartridge.canonical-hash/1`; it
  preserves the historical omission of undefined object members and nulling of undefined array
  members. A strict JSON hash requires a manifest-versioned migration.

## Development

```sh
npm test        # node --test over every *.test.mts file
npm run check   # node --check over every source .mjs file
npm run check && npm test  # both
```

## License

No `license` field is declared. Published only to the private Verdaccio registry at
`http://127.0.0.1:4873/`, not to the public npm registry.
