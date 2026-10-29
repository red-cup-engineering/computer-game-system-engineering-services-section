# Go Engine Services Section

`@red-cup-engineering/go-engine-services-section` speaks the two outside
protocols an external Go/weiqi engine (KataGo, GNU Go, or any other
GTP-conformant engine) is reached by: GTP for play, and KataGo's JSON
analysis protocol for review. It also derives the house readout envelope
— a per-point ownership reading carried as a FOUR charge, content-identified
through `@red-cup-engineering/cbor-ni-service` — from one KataGo analysis
response.

Per the weiqi services section's 2026-08-29 "Reframe and Standards" note
(`content/text/documents/articles/notes/2026-08-29-note-on-reframe-and-standards.md`
in that section): GTP and the KataGo JSON analysis protocol are outside
formats, read and written for interchange with the world's engines — never
canonical. This package is the engine-play and analysis boundary; it does
not touch RMN, the house's own weiqi notation.

`services/weiqi-content-validation-service/` holds executable link checks and
position-derived Chu-space/nerve tools; the Weiqi corpus those checks read
remains under Science.

## The two protocols

- **GTP — Go Text Protocol version 2.** Draft specification by Gunnar
  Farnebäck: <https://www.lysator.liu.se/~gunnar/gtp/gtp2-spec-draft2.html>.
  A line-oriented request/response protocol over a subprocess's stdin/stdout:
  `[id] command_name arg1 arg2\n` in, `("="|"?")[id][" "text]\n\n` out (a
  `"="` status is success, `"?"` is failure; the blank line terminates the
  response, so a multi-line result such as `showboard`'s diagram is legal).
  `src/go-engine.mjs`'s `createGtpSession(child)` opens a session over any
  object exposing `stdin`/`stdout` (a `node:child_process.spawn` result);
  `sendCommand(name, args)` sends one command and resolves its parsed
  `{status, id, result}`. Convenience wrappers cover the commands this
  package uses: `protocolVersion`, `engineName`, `engineVersion`,
  `boardsize`, `clearBoard`, `komi`, `play`, `genmove`, `showboard`, `quit`.
- **KataGo's JSON analysis engine protocol.** Documented at
  <https://github.com/lightvector/KataGo/blob/master/docs/Analysis_Engine.md>.
  One JSON query object per line to stdin (`id`, `moves`, `rules`, `komi`,
  `boardXSize`/`boardYSize`, `analyzeTurns`, `includeOwnership`,
  `includePolicy`, ...), one JSON response object per line from stdout, keyed
  by the query's `id` (`moveInfos`, `rootInfo`, `ownership`, ...).
  `createAnalysisSession(child)` matches responses to queries by `id`,
  assigning one when the caller omits it.

## The readout envelope

`scripts/derive-readout-envelope.mjs`'s `deriveReadoutEnvelope(analysisResponse,
options)` turns one KataGo analysis response's `ownership` array (and, when
present, `ownershipStdev`/`ownershipVariance`) into `{position, readout,
charge, source}`:

- `position` — the query's `id`, or `null`.
- `readout` — the per-point ownership value, each formatted as a
  fixed-precision decimal string (6 places by default —
  `DEFAULT_READOUT_PRECISION`). Decimal strings, not raw floats: the CBOR
  codec this package builds the identity from admits safe integers and typed
  decimal strings, never floating-point.
- `charge` — the parallel per-point [FOUR](https://en.wikipedia.org/wiki/Chu_space)
  charge, named as
  `@lenticule-science/articulating/predicating/positing/bilattice-charge` names
  the four bilattice values:
  - `potential` when the ownership value exceeds `+ownershipThreshold`
  - `active` when it is below `-ownershipThreshold`
  - otherwise, `absurd` when the reported spread (`ownershipVariance`, or the
    square of `ownershipStdev` when only that is present) is at or below
    `varianceThreshold` — settled near-neutral, low evidence of contest
  - otherwise (spread above `varianceThreshold`), `stable` — contested,
    high evidence on both sides
- `source` — where the reading came from (defaults to
  `{engine: "katago", boardXSize, boardYSize}` read off the response's
  `rootInfo`; pass `options.source` to override).

Defaults: `ownershipThreshold = 0.2`, `varianceThreshold = 0.05`
(`DEFAULT_OWNERSHIP_THRESHOLD`, `DEFAULT_VARIANCE_THRESHOLD` in
`src/go-engine.mjs`).

The envelope's content identity — `deriveReadoutEnvelope`'s returned
`identity` field — is the RFC 6920 `ni:` URI of the envelope's own RFC 8949
core-deterministic CBOR encoding (`@red-cup-engineering/cbor-codec-service`'s
`encodeCanonical`, named by `@red-cup-engineering/cbor-ni-service`'s
`canonicalCborToNiUri`). Deriving the envelope twice from the same input and
thresholds yields the same identity.

## Running against a real engine

None of this package's own code spawns a specific engine binary — the
scripts take an `engineCommand` (and optional `engineArgs`) and spawn
whatever the caller names:

```sh
# GTP play, against KataGo's own GTP mode
node scripts/play-gtp-move.mjs "katago gtp -config gtp.cfg -model model.bin.gz" black D4

# GTP play, against GNU Go
node scripts/play-gtp-move.mjs "gnugo --mode gtp" black D4

# KataGo analysis
node scripts/query-analysis.mjs "katago analysis -config analysis.cfg -model model.bin.gz" \
  '{"moves":[["B","D4"]],"rules":"chinese","komi":7.5,"boardXSize":19,"boardYSize":19,"analyzeTurns":[1],"includeOwnership":true}'

# Or the composed CLI face
node apps/go-engine-cli.mjs play "katago gtp -config gtp.cfg -model model.bin.gz" black D4
node apps/go-engine-cli.mjs envelope '{"id":"q1","ownership":[0.9,-0.9],"rootInfo":{"boardXSize":1,"boardYSize":2}}'
```

The scripts and the CLI split the quoted engine string on whitespace into
the command and its arguments before `node:child_process.spawn` (no shell is
involved); JS callers pass `engineCommand` and `engineArgs` separately for
exact argv control.

## Testing the external protocol boundary

```sh
npm test              # syntax-check src, CLI, tests and test helpers; run all cases
npm run test:protocol # GTP and KataGo JSON subprocess protocol integration
npm run test:readout  # pure derived readout and content-identity tests
```

**Live verification against a real engine is a separate gate from this
package's own test suite.** Test processes communicate with the deterministic
`test/stub-engine.mjs`, not an installed KataGo or GNU Go. GTP and analysis
tests share the test-only `test/helpers/stub-session.mjs` lifecycle fixture:
each case spawns its own child, uses a real stdin/stdout exchange, and
always closes and awaits the child, even on assertion failure. An explicit
failure-path test covers cleanup; none of these tests starts a network
service, uses arbitrary sleeps, or shares one mutable engine across cases.
The readout tests instead remain pure and make no subprocess.
These tests verify the adapter's framing, session and readout-derivation
contracts, not the tactical quality of any installed engine.

GTP is verified live against GNU Go 3.8, supplied by Guix (the repository's
`manifest.scm` lists `gnugo`), on 2026-09-04:

```sh
guix shell gnugo -- node scripts/play-gtp-move.mjs "gnugo --mode gtp --boardsize 9" B D4   # prints nothing: play succeeded
guix shell gnugo -- node scripts/play-gtp-move.mjs "gnugo --mode gtp --boardsize 9" W      # printed E5
```

The KataGo JSON analysis protocol is verified live against KataGo itself,
built from its v1.18.2 GitHub release source with the portable Eigen (CPU)
backend and run against the smallest official kata1 network
(`kata1-b6c96-s175395328-d26788732`, 6 residual blocks, 96 channels) —
both packaged beside this section (`go-engine.scm`,
`katago-eigen-package` and `katago-network-b6c96-package`,
`guix build -L <repository root> -f go-engine.scm`) — on 2026-09-04, one
9x9 position (`{"id":"9x9-d4","moves":[["B","D4"]],"rules":"chinese",
"komi":7.5,"boardXSize":9,"boardYSize":9,"analyzeTurns":[1],
"includeOwnership":true}`) through `scripts/query-analysis.mjs`:

```sh
# analysis_example.cfg sets logDir=analysis_logs, relative to the working
# directory; override it so the engine never writes into the checkout.
node scripts/query-analysis.mjs \
  "<store>/bin/katago analysis -config <store>/share/katago/configs/analysis_example.cfg -model <net-store>/share/katago/networks/kata1-b6c96-s175395328-d26788732.txt.gz -override-config logDir=/tmp/katago-analysis-logs" \
  '{"id":"9x9-d4","moves":[["B","D4"]],"rules":"chinese","komi":7.5,"boardXSize":9,"boardYSize":9,"analyzeTurns":[1],"includeOwnership":true}' \
  > analysis-response.json
node scripts/derive-readout-envelope.mjs "$(cat analysis-response.json)"
```

The response carried an 81-entry `ownership` array (9×9); the derived
readout envelope's FOUR charge classified those 81 points `t`: 32, `f`: 18,
`bot`: 31, `top`: 0, and its `identity` (the RFC 6920 `ni:` URI of the
envelope's own canonical-CBOR encoding) came out
`ni:///sha-256;bKod4SGp8qOYlcAh7rfFj4Pshst_jsa4_bAdB9ttq0g` — reproduced
byte-identically deriving the envelope a second time from the same
response.
